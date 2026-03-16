import asyncio
import hashlib
import ipaddress
import logging
import xml.etree.ElementTree as ET
from typing import List
from urllib.parse import quote, urlparse
import httpx
from bs4 import BeautifulSoup
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json

logger = logging.getLogger(__name__)


_BLOCKED_HOSTS = {"localhost", "0.0.0.0", "::1"}
_BLOCKED_PREFIXES = ("169.254.", "100.64.")  # link-local, CGN


def _is_safe_url(url: str) -> bool:
    """Block SSRF targets: private IPs, loopback, link-local."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        host = parsed.hostname or ""
        if host in _BLOCKED_HOSTS:
            return False
        if any(host.startswith(p) for p in _BLOCKED_PREFIXES):
            return False
        try:
            addr = ipaddress.ip_address(host)
            if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
                return False
        except ValueError:
            pass  # hostname, not an IP — allow
        return True
    except Exception:
        return False


async def collect_arxiv(query: str, max_results: int = 5) -> List[EvidenceItem]:
    url = f"https://export.arxiv.org/api/query?search_query=all:{quote(query)}&max_results={max_results}&sortBy=relevance"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
        root = ET.fromstring(resp.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = []
        for entry in root.findall("atom:entry", ns):
            title_el = entry.find("atom:title", ns)
            summary_el = entry.find("atom:summary", ns)
            link_el = entry.find("atom:id", ns)
            if not (title_el is not None and summary_el is not None and link_el is not None):
                continue
            title = title_el.text.strip().replace("\n", " ")
            snippet = summary_el.text.strip().replace("\n", " ")[:500]
            url_str = link_el.text.strip()
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="arxiv",
                snippet=snippet,
                credibility_score=0.9,
                relevance_score=0.7,
            ))
        return items
    except Exception as e:
        logger.warning("arxiv collection failed: %s", e)
        return []


async def collect_hn(query: str, max_results: int = 5) -> List[EvidenceItem]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            search_resp = await client.get(
                f"https://hn.algolia.com/api/v1/search?query={quote(query)}&hitsPerPage={max_results}&tags=story"
            )
        data = search_resp.json()
        items = []
        for hit in data.get("hits", []):
            title = hit.get("title", "")
            url_str = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            snippet = hit.get("story_text") or hit.get("comment_text") or title
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="hn",
                snippet=str(snippet)[:500],
                credibility_score=0.7,
                relevance_score=0.65,
            ))
        return items
    except Exception as e:
        logger.warning("HN collection failed: %s", e)
        return []


async def collect_reddit(query: str, max_results: int = 5) -> List[EvidenceItem]:
    try:
        headers = {"User-Agent": "PREDECT/1.0"}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(
                f"https://www.reddit.com/search.json?q={quote(query)}&limit={max_results}&sort=relevance"
            )
        data = resp.json()
        items = []
        for post in data.get("data", {}).get("children", []):
            d = post["data"]
            title = d.get("title", "")
            url_str = f"https://reddit.com{d.get('permalink', '')}"
            snippet = d.get("selftext", title)[:500]
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="reddit",
                snippet=snippet,
                credibility_score=0.5,
                relevance_score=0.6,
            ))
        return items
    except Exception as e:
        logger.warning("Reddit collection failed: %s", e)
        return []


async def scrape_url(url: str) -> str:
    if not _is_safe_url(url):
        return ""
    try:
        headers = {"User-Agent": "Mozilla/5.0 PREDECT/1.0"}
        async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = " ".join(soup.get_text().split())
        return text[:3000]
    except Exception:
        return ""


async def _enrich_batch(
    batch: List[EvidenceItem],
    offset: int,
    query: str,
    domain: str = "general",
) -> List[tuple[int, dict]]:
    """Enrich a single batch; returns list of (global_index, scores) pairs."""
    batch_text = "\n\n".join([
        f"[{i}] [{item.source}] {item.title}: {(item.snippet or '')[:300]}"
        for i, item in enumerate(batch)
    ])
    try:
        result = await llm_call_json(
            "evidence_summarization",
            system_prompt=(
                "You are an evidence analyst. Score each evidence item for a prediction query. "
                "Be discriminating: most items should score 0.3-0.7; only directly relevant, high-quality items score above 0.8."
            ),
            user_prompt=f"""Query: {query}
Domain: {domain}

Evidence items:
{batch_text}

Return JSON with key "items", one entry per item:
- index: int (0-based within this batch)
- relevance: float 0-1 (how directly the item informs the SPECIFIC query outcome for {domain}; off-topic items ≤ 0.3)
- credibility: float 0-1 (academic/official=0.85-0.95, established news=0.70-0.84, blogs/social=0.35-0.65)
- sentiment: float -1 to 1 (bearish/negative to bullish/positive about the query outcome)
- entities: array of up to 5 key named entities (people, orgs, places, events)

Return only valid JSON.""",
        )
        return [(offset + item_data["index"], item_data) for item_data in result.get("items", []) if "index" in item_data]
    except Exception:
        return []


async def enrich_evidence(items: List[EvidenceItem], query: str, domain: str = "general") -> List[EvidenceItem]:
    if not items:
        return items

    BATCH_SIZE = 8
    batches = [items[i:i + BATCH_SIZE] for i in range(0, len(items), BATCH_SIZE)]

    batch_results = await asyncio.gather(
        *[_enrich_batch(batch, i * BATCH_SIZE, query, domain) for i, batch in enumerate(batches)],
        return_exceptions=True,
    )

    enriched = list(items)
    for outcome in batch_results:
        if isinstance(outcome, Exception):
            continue
        for global_idx, item_data in outcome:
            if 0 <= global_idx < len(enriched):
                enriched[global_idx].relevance_score = float(item_data.get("relevance", enriched[global_idx].relevance_score))
                if "credibility" in item_data:
                    # Blend LLM credibility with source-default (60% LLM, 40% source default)
                    llm_cred = float(item_data["credibility"])
                    src_cred = enriched[global_idx].credibility_score or 0.7
                    enriched[global_idx].credibility_score = round(llm_cred * 0.6 + src_cred * 0.4, 3)
                enriched[global_idx].sentiment = item_data.get("sentiment", 0.0)
                enriched[global_idx].entities = (item_data.get("entities") or [])[:5]

    return enriched


async def collect_google_news(query: str, max_results: int = 8) -> List[EvidenceItem]:
    """Collect from Google News RSS — no API key needed."""
    url = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-US&gl=US&ceid=US:en"
    try:
        headers = {"User-Agent": "Mozilla/5.0 PREDECT/1.0"}
        async with httpx.AsyncClient(timeout=12.0, headers=headers) as client:
            resp = await client.get(url)
        root = ET.fromstring(resp.text)
        items = []
        for item in root.findall(".//item")[:max_results]:
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            pub_el = item.find("pubDate")
            if title_el is None or link_el is None:
                continue
            title = title_el.text or ""
            url_str = link_el.text or ""
            snippet = ""
            if desc_el is not None and desc_el.text:
                from html import unescape
                raw = unescape(desc_el.text)
                soup = BeautifulSoup(raw, "html.parser")
                snippet = soup.get_text()[:500]
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title.strip(),
                url=url_str,
                source="google_news",
                snippet=snippet or title,
                credibility_score=0.75,
                relevance_score=0.8,
                published_at=pub_el.text if pub_el is not None else None,
            ))
        return items
    except Exception as e:
        logger.warning("Google News collection failed: %s", e)
        return []


async def collect_wikipedia(query: str) -> List[EvidenceItem]:
    """Collect Wikipedia summary — searches for best-match article first."""
    try:
        # Search for the most relevant Wikipedia article
        search_url = (
            f"https://en.wikipedia.org/w/api.php"
            f"?action=query&list=search&srsearch={quote(query)}&srlimit=2&format=json"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            search_resp = await client.get(search_url)
        search_data = search_resp.json()
        search_results = search_data.get("query", {}).get("search", [])
        if not search_results:
            return []

        items = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            for hit in search_results[:2]:
                article_title = hit["title"]
                summary_url = (
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/"
                    f"{quote(article_title.replace(' ', '_'))}"
                )
                try:
                    resp = await client.get(summary_url)
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    title = data.get("title", "")
                    extract = data.get("extract", "")[:600]
                    page_url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
                    if extract and page_url:
                        items.append(EvidenceItem(
                            id=hashlib.md5(page_url.encode()).hexdigest(),
                            title=f"Wikipedia: {title}",
                            url=page_url,
                            source="wikipedia",
                            snippet=extract,
                            credibility_score=0.85,
                            relevance_score=0.7,
                        ))
                except Exception:
                    continue
        return items
    except Exception as e:
        logger.warning("Wikipedia collection failed: %s", e)
    return []


async def collect_newsapi(query: str, api_key: str, max_results: int = 5) -> List[EvidenceItem]:
    """Collect from NewsAPI.org — only runs when caller provides an API key."""
    try:
        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={quote(query)}&pageSize={max_results}&sortBy=relevancy&language=en"
        )
        headers = {"X-Api-Key": api_key}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
        data = resp.json()
        items = []
        for article in data.get("articles", []):
            url_str = article.get("url", "")
            if not url_str:
                continue
            title = article.get("title") or ""
            snippet = article.get("description") or article.get("content") or title
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="newsapi",
                snippet=str(snippet)[:500],
                credibility_score=0.8,
                relevance_score=0.75,
                published_at=article.get("publishedAt"),
            ))
        return items
    except Exception:
        return []


async def collect_gnews(query: str, api_key: str, max_results: int = 5) -> List[EvidenceItem]:
    """Collect from GNews.io — only runs when caller provides an API key."""
    try:
        url = (
            f"https://gnews.io/api/v4/search"
            f"?q={quote(query)}&max={max_results}&lang=en&token={api_key}"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
        data = resp.json()
        items = []
        for article in data.get("articles", []):
            url_str = article.get("url", "")
            if not url_str:
                continue
            title = article.get("title") or ""
            snippet = article.get("description") or title
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="gnews",
                snippet=str(snippet)[:500],
                credibility_score=0.75,
                relevance_score=0.75,
                published_at=article.get("publishedAt"),
            ))
        return items
    except Exception:
        return []


async def collect_alpha_vantage(query: str, api_key: str, max_results: int = 5) -> List[EvidenceItem]:
    """Collect financial news sentiment from Alpha Vantage NEWS_SENTIMENT endpoint."""
    try:
        url = (
            f"https://www.alphavantage.co/query"
            f"?function=NEWS_SENTIMENT&q={quote(query)}&limit={max_results}&sort=RELEVANCE&apikey={api_key}"
        )
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(url)
        data = resp.json()
        items = []
        for article in data.get("feed", [])[:max_results]:
            url_str = article.get("url", "")
            if not url_str:
                continue
            title = article.get("title", "")
            snippet = article.get("summary", title)[:500]
            sentiment_score = float(article.get("overall_sentiment_score", 0.0))
            published = article.get("time_published", "")
            # Convert AV timestamp 20250101T120000 → ISO 8601
            if published and len(published) >= 15:
                try:
                    from datetime import datetime
                    published = datetime.strptime(published[:15], "%Y%m%dT%H%M%S").isoformat()
                except Exception:
                    pass
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="alpha_vantage",
                snippet=snippet,
                credibility_score=0.8,
                relevance_score=0.8,
                sentiment=round(sentiment_score, 3),
                published_at=published or None,
            ))
        return items
    except Exception as e:
        logger.warning("Alpha Vantage collection failed: %s", e)
        return []


async def collect_evidence(
    query: str,
    max_items: int = 20,
    news_api_key: str | None = None,
    gnews_api_key: str | None = None,
    alpha_vantage_key: str | None = None,
    domain: str = "general",
) -> List[EvidenceItem]:
    tasks = [
        collect_arxiv(query, max_results=5),
        collect_hn(query, max_results=5),
        collect_reddit(query, max_results=5),
        collect_google_news(query, max_results=8),
        collect_wikipedia(query),
    ]
    if news_api_key:
        tasks.append(collect_newsapi(query, news_api_key, max_results=5))
    if gnews_api_key:
        tasks.append(collect_gnews(query, gnews_api_key, max_results=5))
    if alpha_vantage_key:
        tasks.append(collect_alpha_vantage(query, alpha_vantage_key, max_results=5))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    items: List[EvidenceItem] = []
    for r in results:
        if isinstance(r, list):
            items.extend(r)

    seen_urls = set()
    unique = []
    for item in items:
        if item.url not in seen_urls:
            seen_urls.add(item.url)
            unique.append(item)

    # Second pass: deduplicate by title prefix (same story, different outlets)
    seen_title_keys = set()
    deduped = []
    for item in unique:
        title_key = item.title.lower().strip()[:60]
        if title_key not in seen_title_keys:
            seen_title_keys.add(title_key)
            deduped.append(item)
    unique = deduped

    try:
        unique = await enrich_evidence(unique[:max_items], query, domain)
    except Exception:
        pass

    unique.sort(key=lambda x: x.relevance_score * x.credibility_score, reverse=True)
    return unique[:max_items]
