"""OCR run pipeline — the heavy engine and B2 writes are mocked, so this runs
green without paddleocr/paddlepaddle installed."""

import json

import pytest

from app.service import documents as docs
from app.service import ocr as ocr_service
from app.types import DocumentDetail, OcrRegion

_SIDECAR = {
    "doc_id": "a",
    "filename": "a.png",
    "ext": "png",
    "collection": "general",
    "lang": "en",
    "detect_orientation": True,
    "status": "pending",
    "uploaded_at": "2026-07-06T00:00:00+00:00",
    "processed_at": None,
    "size_bytes": 9,
    "confidence": None,
    "region_count": None,
}


def test_run_writes_three_artifacts_and_flips_status(monkeypatch):
    writes: dict[str, tuple[bytes, str]] = {}
    saved: dict = {}
    index_calls: dict = {}

    monkeypatch.setattr(ocr_service, "get_bytes", lambda key: b"scanbytes")
    monkeypatch.setattr(
        ocr_service, "put_bytes", lambda key, data, ct: writes.__setitem__(key, (data, ct))
    )
    monkeypatch.setattr(
        ocr_service.ocr_engine,
        "run_ocr",
        lambda image_bytes, lang="en", detect_orientation=True: [
            OcrRegion(text="Hello", confidence=0.9, box=[[0, 0], [10, 0], [10, 10], [0, 10]]),
            OcrRegion(text="World", confidence=0.8, box=[[0, 20], [10, 20], [10, 30], [0, 30]]),
        ],
    )
    monkeypatch.setattr(ocr_service, "draw_overlay", lambda scan, regions: b"pngbytes")
    monkeypatch.setattr(ocr_service.index_db, "upsert_page", lambda **kw: index_calls.update(kw))
    monkeypatch.setattr(docs, "read_sidecar", lambda doc_id: dict(_SIDECAR))
    monkeypatch.setattr(docs, "write_sidecar", lambda doc_id, data: saved.update(data))
    monkeypatch.setattr(
        docs,
        "get_document",
        lambda doc_id: DocumentDetail(doc_id=doc_id, filename="a.png", ext="png", status="processed"),
    )

    detail = ocr_service.run_document_ocr("a")

    assert detail.status == "processed"
    # All three B2 artifacts written.
    assert docs.result_key("a") in writes
    assert docs.text_key("a") in writes
    assert docs.overlay_key("a") in writes

    text_data, _ = writes[docs.text_key("a")]
    assert b"Hello" in text_data and b"World" in text_data

    result_data, _ = writes[docs.result_key("a")]
    payload = json.loads(result_data)
    assert payload["region_count"] == 2
    assert len(payload["regions"]) == 2

    # Sidecar flipped to processed with derived metadata.
    assert saved["status"] == "processed"
    assert saved["region_count"] == 2
    assert saved["processed_at"]

    # Index upserted with joined text + average confidence.
    assert "Hello" in index_calls["text"]
    assert index_calls["confidence"] == pytest.approx((0.9 + 0.8) / 2)


def test_run_missing_document(monkeypatch):
    monkeypatch.setattr(docs, "read_sidecar", lambda doc_id: None)
    with pytest.raises(docs.DocumentNotFound):
        ocr_service.run_document_ocr("nope")


def test_run_rejects_unavailable_lang(monkeypatch):
    # A pre-existing document whose stored language isn't baked into the offline
    # image must fail fast (no engine call, no hang) with a recoverable error.
    stranded = dict(_SIDECAR, lang="es")
    monkeypatch.setattr(docs, "read_sidecar", lambda doc_id: dict(stranded))

    def _boom(*args, **kwargs):  # pragma: no cover - must never run
        raise AssertionError("engine must not run for an unavailable language")

    monkeypatch.setattr(ocr_service.ocr_engine, "run_ocr", _boom)
    with pytest.raises(docs.DocumentError):
        ocr_service.run_document_ocr("a")
