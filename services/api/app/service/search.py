"""Keyword full-text search over recognized document text + index rebuild.

Search hits come from the SQLite cache; the cache is fully rebuildable from the
B2-resident `ocr-results/<doc-id>/text.txt` + `result.json` via `reindex()`.
Entity / layout-region search is intentionally out of scope (future work) —
keyword search is the shipped capability.
"""

import logging

from app.repo import get_bytes, index_db, list_prefix
from app.service import documents as docs
from app.types import SearchHit

logger = logging.getLogger(__name__)

_SNIPPET_RADIUS = 60


def _snippet(text: str, query: str) -> str:
    """Return a short window of text around the first match of the query."""
    lowered = text.lower()
    idx = lowered.find(query.lower())
    if idx == -1:
        return text[: _SNIPPET_RADIUS * 2].strip()
    start = max(0, idx - _SNIPPET_RADIUS)
    end = min(len(text), idx + len(query) + _SNIPPET_RADIUS)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


def search(query: str, limit: int = 50) -> list[SearchHit]:
    query = query.strip()
    if not query:
        return []
    hits: list[SearchHit] = []
    for row in index_db.search(query, limit=limit):
        hits.append(
            SearchHit(
                doc_id=row["doc_id"],
                collection=row["collection"],
                confidence=row["confidence"],
                snippet=_snippet(row["text"], query),
                updated_at=row["updated_at"],
            )
        )
    return hits


def reindex() -> int:
    """Rebuild the SQLite index from the OCR artifacts stored in B2.

    Returns the number of documents indexed. Reads each document's text.txt (and
    the sidecar for its collection + confidence), so the local cache can be
    thrown away and regenerated at any time.
    """
    index_db.clear()
    indexed = 0
    for item in list_prefix(docs.RESULTS_PREFIX):
        if not item["key"].endswith("/text.txt"):
            continue
        # ocr-results/<doc-id>/text.txt -> <doc-id>
        doc_id = item["key"][len(docs.RESULTS_PREFIX) : -len("/text.txt")]
        text_bytes = get_bytes(item["key"])
        text = text_bytes.decode("utf-8", errors="replace") if text_bytes else ""
        sidecar = docs.read_sidecar(doc_id) or {}
        confidence = sidecar.get("confidence")
        updated_at = sidecar.get("processed_at") or item["last_modified"].isoformat()
        index_db.upsert_page(
            doc_id=doc_id,
            collection=sidecar.get("collection", "general"),
            text=text,
            confidence=confidence,
            updated_at=updated_at,
        )
        indexed += 1
    logger.info("Reindex complete: %d documents", indexed)
    return indexed
