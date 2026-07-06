"""Run the local PaddleOCR pipeline for a document and persist artifacts to B2.

Flow: read scan bytes + config -> recognize (repo.ocr_engine) -> write
result.json + text.txt + overlay.png under ocr-results/<doc-id>/ -> flip the
sidecar status to processed -> upsert the search index. The heavy engine is
isolated in repo.ocr_engine and mocked in unit tests.
"""

import json
import logging
from datetime import UTC, datetime

from app.repo import get_bytes, index_db, ocr_engine, put_bytes
from app.service import documents as docs
from app.service.overlay import draw_overlay
from app.types import DocumentDetail
from app.types.documents import SUPPORTED_LANGS

logger = logging.getLogger(__name__)


def run_document_ocr(doc_id: str) -> DocumentDetail:
    """Execute OCR for one document, writing all three B2 artifacts."""
    sidecar = docs.read_sidecar(doc_id)
    if not sidecar:
        raise docs.DocumentNotFound()

    # Guard against a document whose stored language isn't baked into this
    # offline build (e.g. one ingested before the language list was narrowed).
    # Running the engine on it would make PaddleOCR hang trying to download the
    # model with no network. Fail fast with a truthful, recoverable message
    # instead — the document stays pending and the user can edit it to a
    # supported language and re-run.
    lang = sidecar.get("lang", "en")
    if lang not in SUPPORTED_LANGS:
        raise docs.DocumentError(
            f"OCR language '{lang}' is not available in this offline build. "
            "Edit the document's language to English and re-run.",
            status_code=422,
        )

    scan = get_bytes(docs.scan_key(doc_id, sidecar["ext"]))
    if scan is None:
        raise docs.DocumentNotFound("Scan bytes missing for this document")

    regions = ocr_engine.run_ocr(
        scan,
        lang=lang,
        detect_orientation=bool(sidecar.get("detect_orientation", True)),
    )
    text = "\n".join(r.text for r in regions)
    confidence = (
        sum(r.confidence for r in regions) / len(regions) if regions else 0.0
    )
    now = datetime.now(UTC).isoformat()

    result_payload = {
        "doc_id": doc_id,
        "text": text,
        "confidence": confidence,
        "region_count": len(regions),
        "processed_at": now,
        "regions": [r.model_dump() for r in regions],
    }
    put_bytes(
        docs.result_key(doc_id),
        json.dumps(result_payload).encode("utf-8"),
        "application/json",
    )
    put_bytes(docs.text_key(doc_id), text.encode("utf-8"), "text/plain; charset=utf-8")
    put_bytes(docs.overlay_key(doc_id), draw_overlay(scan, regions), "image/png")

    sidecar.update(
        status="processed",
        processed_at=now,
        confidence=round(confidence, 4),
        region_count=len(regions),
    )
    docs.write_sidecar(doc_id, sidecar)
    index_db.upsert_page(
        doc_id=doc_id,
        collection=sidecar.get("collection", "general"),
        text=text,
        confidence=confidence,
        updated_at=now,
    )
    logger.info(
        "OCR complete: doc_id=%s regions=%d confidence=%.3f",
        doc_id,
        len(regions),
        confidence,
    )
    return docs.get_document(doc_id)
