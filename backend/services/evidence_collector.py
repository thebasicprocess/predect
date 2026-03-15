import asyncio
import hashlib
import ipaddress
import xml.etree.ElementTree as ET
from typing import List
from urllib.parse import quote, urlparse
import httpx
from bs4 import BeautifulSoup
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json


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
    except Exception:
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
    except Exception:
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
    except Exception:
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


async def collect_evidence(query: str, max_items: int = 20) -> List[EvidenceItem]:
    results = await asyncio.gather(
        collect_arxiv(query, max_results=5),
        collect_hn(query, max_results=5),
        collect_reddit(query, max_results=5),
        return_exceptions=True,
    )

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
