"""Document lifecycle service tests — B2 is faked with an in-memory store,
the SQLite index runs for real against a tmp DB. No ML deps required."""

import json
from datetime import UTC, datetime

import pytest

from app.config import settings
from app.service import documents as docs
from app.types import OcrConfig


@pytest.fixture
def store(monkeypatch, tmp_path):
    data: dict[str, bytes] = {}

    def put(key, payload, content_type):
        data[key] = payload

    def get(key):
        return data.get(key)

    def list_prefix(prefix):
        now = datetime.now(UTC)
        return [
            {"key": k, "size": len(v), "last_modified": now}
            for k, v in data.items()
            if k.startswith(prefix)
        ]

    def delete_prefix(prefix):
        keys = [k for k in data if k.startswith(prefix)]
        for k in keys:
            del data[k]
        return len(keys)

    monkeypatch.setattr(docs, "put_bytes", put)
    monkeypatch.setattr(docs, "get_bytes", get)
    monkeypatch.setattr(docs, "list_prefix", list_prefix)
    monkeypatch.setattr(docs, "delete_prefix", delete_prefix)
    monkeypatch.setattr(docs, "get_inline_url", lambda key, expires_in=600: f"https://signed/{key}")
    monkeypatch.setattr(settings, "index_db_file", str(tmp_path / "index.db"))
    return data


def test_ingest_creates_scan_and_sidecar(store):
    record = docs.ingest(b"imgbytes", "Invoice 001.PNG", "image/png", OcrConfig())
    assert record.doc_id == "invoice-001"
    assert record.status == "pending"
    assert record.ext == "png"
    assert record.scan_url.startswith("https://signed/")
    assert docs.scan_key("invoice-001", "png") in store
    sidecar = json.loads(store[docs.sidecar_key("invoice-001")])
    assert sidecar["status"] == "pending"
    assert sidecar["lang"] == "en"


def test_ingest_rejects_non_image(store):
    with pytest.raises(docs.DocumentError):
        docs.ingest(b"x", "notes.txt", "text/plain", OcrConfig())


def test_ingest_rejects_empty(store):
    with pytest.raises(docs.DocumentError):
        docs.ingest(b"", "scan.png", "image/png", OcrConfig())


def test_list_and_get(store):
    docs.ingest(b"aaa", "a.png", "image/png", OcrConfig(collection="legal"))
    docs.ingest(b"bbb", "b.jpg", "image/jpeg", OcrConfig())
    records = docs.list_documents()
    assert {r.doc_id for r in records} == {"a", "b"}
    detail = docs.get_document("a")
    assert detail.collection == "legal"
    assert detail.status == "pending"
    assert detail.text == ""
    assert detail.regions == []


def test_edit_updates_config_not_status(store):
    docs.ingest(b"aaa", "a.png", "image/png", OcrConfig())
    rec = docs.edit_document(
        "a", OcrConfig(lang="en", detect_orientation=False, collection="finance")
    )
    assert rec.lang == "en"
    assert rec.detect_orientation is False
    assert rec.collection == "finance"
    assert rec.status == "pending"


def test_edit_rejects_bad_lang(store):
    docs.ingest(b"aaa", "a.png", "image/png", OcrConfig())
    with pytest.raises(docs.DocumentError):
        docs.edit_document("a", OcrConfig(lang="klingon"))


def test_ingest_rejects_unavailable_lang(store):
    # A language whose model isn't baked into the offline image is rejected at
    # the boundary so no document is stranded in a state that would hang OCR.
    with pytest.raises(docs.DocumentError):
        docs.ingest(b"aaa", "a.png", "image/png", OcrConfig(lang="es"))


def test_delete_is_scoped_to_doc_prefix(store):
    docs.ingest(b"aaa", "gone.png", "image/png", OcrConfig())
    docs.ingest(b"bbb", "gone2.png", "image/png", OcrConfig())
    # Simulate OCR artifacts for the doc we will delete.
    store[docs.result_key("gone")] = b"{}"
    store[docs.overlay_key("gone")] = b"png"

    docs.delete_document("gone")

    # Sibling with a shared id-prefix must survive.
    assert docs.scan_key("gone2", "png") in store
    assert not any(k.startswith("raw-scans/gone.") for k in store)
    assert not any(k.startswith("ocr-results/gone/") for k in store)


def test_get_missing_raises(store):
    with pytest.raises(docs.DocumentNotFound):
        docs.get_document("nope")
