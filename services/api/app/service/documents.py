"""Document lifecycle orchestration: ingest / list / get / edit / delete + stats.

B2 is the single source of truth. Per document (one scanned page):
  raw-scans/<doc-id><ext>          the scan
  raw-scans/<doc-id>.doc.json      config + status sidecar
  ocr-results/<doc-id>/result.json regions + text + confidence (once processed)
  ocr-results/<doc-id>/overlay.png boxes drawn over the scan
  ocr-results/<doc-id>/text.txt    searchable plain text

The SQLite index is a derived cache updated alongside these writes.
"""

import json
import logging
import re
from datetime import UTC, datetime

from app.repo import (
    delete_prefix,
    get_bytes,
    get_inline_url,
    index_db,
    list_prefix,
    put_bytes,
)
from app.types import (
    ArchiveStats,
    DailyProcessedCount,
    DocumentDetail,
    DocumentRecord,
    OcrConfig,
    OcrRegion,
)
from app.types.documents import SUPPORTED_LANGS
from app.types.formatting import humanize_bytes

logger = logging.getLogger(__name__)

RAW_PREFIX = "raw-scans/"
RESULTS_PREFIX = "ocr-results/"
SIDECAR_SUFFIX = ".doc.json"

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/tiff": "tiff",
    "image/webp": "webp",
    "image/bmp": "bmp",
}

_DOC_ID_RE = re.compile(r"[^A-Za-z0-9_-]+")


class DocumentError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class DocumentNotFound(Exception):
    def __init__(self, detail: str = "Document not found"):
        self.detail = detail
        super().__init__(detail)


# --- key helpers (shared with service/ocr.py) ---

def scan_key(doc_id: str, ext: str) -> str:
    return f"{RAW_PREFIX}{doc_id}.{ext}"


def sidecar_key(doc_id: str) -> str:
    return f"{RAW_PREFIX}{doc_id}{SIDECAR_SUFFIX}"


def result_key(doc_id: str) -> str:
    return f"{RESULTS_PREFIX}{doc_id}/result.json"


def overlay_key(doc_id: str) -> str:
    return f"{RESULTS_PREFIX}{doc_id}/overlay.png"


def text_key(doc_id: str) -> str:
    return f"{RESULTS_PREFIX}{doc_id}/text.txt"


def doc_prefixes(doc_id: str) -> list[str]:
    """Every prefix owned by a document — used for scoped deletion.

    The raw prefix carries a trailing dot (`raw-scans/<id>.`) so it matches only
    this document's `<id>.<ext>` and `<id>.doc.json`, never a sibling whose id
    shares a leading substring (e.g. `<id>2`). Doc-ids never contain dots.
    """
    return [f"{RAW_PREFIX}{doc_id}.", f"{RESULTS_PREFIX}{doc_id}/"]


def sanitize_doc_id(filename: str) -> str:
    stem = filename.replace("\\", "/").split("/")[-1]
    if "." in stem:
        stem = stem.rsplit(".", 1)[0]
    cleaned = _DOC_ID_RE.sub("-", stem).strip("-").lower()
    return cleaned or "scan"


def read_sidecar(doc_id: str) -> dict | None:
    raw = get_bytes(sidecar_key(doc_id))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Corrupt sidecar for doc_id=%s", doc_id)
        return None


def write_sidecar(doc_id: str, data: dict) -> None:
    put_bytes(sidecar_key(doc_id), json.dumps(data).encode("utf-8"), "application/json")


def _record_from_sidecar(sidecar: dict) -> DocumentRecord:
    doc_id = sidecar["doc_id"]
    size = int(sidecar.get("size_bytes", 0))
    return DocumentRecord(
        doc_id=doc_id,
        filename=sidecar.get("filename", doc_id),
        ext=sidecar.get("ext", ""),
        collection=sidecar.get("collection", "general"),
        status=sidecar.get("status", "pending"),
        lang=sidecar.get("lang", "en"),
        detect_orientation=bool(sidecar.get("detect_orientation", True)),
        confidence=sidecar.get("confidence"),
        region_count=sidecar.get("region_count"),
        size_bytes=size,
        size_human=humanize_bytes(size),
        uploaded_at=sidecar.get("uploaded_at"),
        processed_at=sidecar.get("processed_at"),
        scan_url=get_inline_url(scan_key(doc_id, sidecar.get("ext", ""))),
        overlay_url=(
            get_inline_url(overlay_key(doc_id))
            if sidecar.get("status") == "processed"
            else None
        ),
    )


def ingest(
    file_data: bytes,
    filename: str,
    content_type: str,
    config: OcrConfig,
) -> DocumentRecord:
    """Store a scan + config sidecar and register a pending index row."""
    if not filename:
        raise DocumentError("No filename provided")
    if len(file_data) == 0:
        raise DocumentError("Empty file")
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise DocumentError(
            f"Unsupported scan type '{content_type}'. Upload a TIFF, JPEG, PNG, "
            "WEBP, or BMP image.",
            status_code=415,
        )
    if config.lang not in SUPPORTED_LANGS:
        raise DocumentError(f"Unsupported OCR language '{config.lang}'")

    ext = ALLOWED_IMAGE_TYPES[content_type]
    doc_id = sanitize_doc_id(filename)
    now = datetime.now(UTC).isoformat()

    put_bytes(scan_key(doc_id, ext), file_data, content_type)
    sidecar = {
        "doc_id": doc_id,
        "filename": filename,
        "ext": ext,
        "collection": config.collection or "general",
        "lang": config.lang,
        "detect_orientation": config.detect_orientation,
        "status": "pending",
        "uploaded_at": now,
        "processed_at": None,
        "size_bytes": len(file_data),
        "confidence": None,
        "region_count": None,
    }
    write_sidecar(doc_id, sidecar)
    index_db.upsert_page(
        doc_id=doc_id,
        collection=sidecar["collection"],
        text="",
        confidence=None,
        updated_at=now,
    )
    logger.info("Document ingested: doc_id=%s size=%d", doc_id, len(file_data))
    return _record_from_sidecar(sidecar)


def list_documents() -> list[DocumentRecord]:
    records: list[DocumentRecord] = []
    for item in list_prefix(RAW_PREFIX):
        if not item["key"].endswith(SIDECAR_SUFFIX):
            continue
        doc_id = item["key"][len(RAW_PREFIX) : -len(SIDECAR_SUFFIX)]
        sidecar = read_sidecar(doc_id)
        if sidecar:
            records.append(_record_from_sidecar(sidecar))
    records.sort(key=lambda r: r.uploaded_at or datetime.min, reverse=True)
    return records


def get_document(doc_id: str) -> DocumentDetail:
    sidecar = read_sidecar(doc_id)
    if not sidecar:
        raise DocumentNotFound()
    base = _record_from_sidecar(sidecar)
    detail = DocumentDetail(**base.model_dump())
    if sidecar.get("status") == "processed":
        raw = get_bytes(result_key(doc_id))
        if raw:
            payload = json.loads(raw)
            detail.text = payload.get("text", "")
            detail.regions = [OcrRegion(**r) for r in payload.get("regions", [])]
    return detail


def edit_document(doc_id: str, config: OcrConfig) -> DocumentRecord:
    """Update collection + OCR config used by the NEXT run (does not re-run)."""
    sidecar = read_sidecar(doc_id)
    if not sidecar:
        raise DocumentNotFound()
    if config.lang not in SUPPORTED_LANGS:
        raise DocumentError(f"Unsupported OCR language '{config.lang}'")
    sidecar["collection"] = config.collection or "general"
    sidecar["lang"] = config.lang
    sidecar["detect_orientation"] = config.detect_orientation
    write_sidecar(doc_id, sidecar)
    index_db.update_collection(
        doc_id, sidecar["collection"], datetime.now(UTC).isoformat()
    )
    return _record_from_sidecar(sidecar)


def delete_document(doc_id: str) -> None:
    """Remove the scan + all OCR artifacts (scoped to this doc-id) + index row."""
    sidecar = read_sidecar(doc_id)
    if not sidecar:
        raise DocumentNotFound()
    for prefix in doc_prefixes(doc_id):
        delete_prefix(prefix)
    index_db.delete_page(doc_id)
    logger.info("Document deleted: doc_id=%s", doc_id)


def archive_stats() -> ArchiveStats:
    sidecars = [
        s
        for item in list_prefix(RAW_PREFIX)
        if item["key"].endswith(SIDECAR_SUFFIX)
        and (s := read_sidecar(item["key"][len(RAW_PREFIX) : -len(SIDECAR_SUFFIX)]))
    ]
    processed = [s for s in sidecars if s.get("status") == "processed"]
    confidences = [s["confidence"] for s in processed if s.get("confidence") is not None]
    storage = sum(item["size"] for item in list_prefix(RAW_PREFIX))
    storage += sum(item["size"] for item in list_prefix(RESULTS_PREFIX))
    return ArchiveStats(
        total_documents=len(sidecars),
        processed=len(processed),
        pending=len(sidecars) - len(processed),
        pages_processed=len(processed),
        avg_confidence=(sum(confidences) / len(confidences)) if confidences else None,
        storage_bytes=storage,
        storage_human=humanize_bytes(storage),
    )


def processing_activity(days: int = 7) -> list[DailyProcessedCount]:
    from collections import defaultdict
    from datetime import timedelta

    counts: dict[str, int] = defaultdict(int)
    for item in list_prefix(RAW_PREFIX):
        if not item["key"].endswith(SIDECAR_SUFFIX):
            continue
        doc_id = item["key"][len(RAW_PREFIX) : -len(SIDECAR_SUFFIX)]
        sidecar = read_sidecar(doc_id)
        if sidecar and sidecar.get("processed_at"):
            day = sidecar["processed_at"][:10]
            counts[day] += 1
    today = datetime.now(UTC).date()
    cutoff = today - timedelta(days=days - 1)
    return [
        DailyProcessedCount(
            date=(cutoff + timedelta(days=i)).isoformat(),
            processed=counts.get((cutoff + timedelta(days=i)).isoformat(), 0),
        )
        for i in range(days)
    ]
