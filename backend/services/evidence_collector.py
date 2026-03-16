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


async def enrich_evidence(items: List[EvidenceItem], query: str) -> List[EvidenceItem]:
    if not items:
        return items

    batch_text = "\n\n".join([f"[{i}] {item.title}: {item.snippet}" for i, item in enumerate(items)])

    try:
        result = await llm_call_json(
            "evidence_summarization",
            system_prompt="You are an evidence analyst. Given a query and evidence items, score each item.",
            user_prompt=f"""Query: {query}

Evidence items:
{batch_text}

Return a JSON object with key "items" containing an array where each element has:
- index: int (0-based)
- relevance: float 0-1
- sentiment: float -1 to 1
- entities: array of strings (key named entities)

Return only valid JSON."""
        )
    except Exception:
        return items

    enriched = list(items)
    for item_data in result.get("items", []):
        idx = item_data.get("index", -1)
        if 0 <= idx < len(enriched):
            enriched[idx].relevance_score = item_data.get("relevance", enriched[idx].relevance_score)
            enriched[idx].sentiment = item_data.get("sentiment", 0.0)
            enriched[idx].entities = item_data.get("entities", [])

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
    """Collect Wikipedia summary — good for factual background."""
    try:
        search_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(query.replace(' ', '_'))}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(search_url)
        if resp.status_code == 200:
            data = resp.json()
            title = data.get("title", "")
            extract = data.get("extract", "")[:600]
            page_url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
            if extract and page_url:
                return [EvidenceItem(
                    id=hashlib.md5(page_url.encode()).hexdigest(),
                    title=f"Wikipedia: {title}",
                    url=page_url,
                    source="wikipedia",
                    snippet=extract,
                    credibility_score=0.85,
                    relevance_score=0.7,
                )]
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


async def collect_evidence(
    query: str,
    max_items: int = 20,
    news_api_key: str | None = None,
    gnews_api_key: str | None = None,
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

    try:
        unique = await enrich_evidence(unique[:max_items], query)
    except Exception:
        pass

    unique.sort(key=lambda x: x.relevance_score * x.credibility_score, reverse=True)
    return unique[:max_items]
