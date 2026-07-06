"""Keyword search + reindex — SQLite runs for real against a tmp DB; B2 is faked
for the reindex path."""

from datetime import UTC, datetime

from app.config import settings
from app.repo import index_db
from app.service import documents as docs
from app.service import search as search_service


def _use_tmp_index(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "index_db_file", str(tmp_path / "index.db"))
    index_db.clear()


def test_search_returns_snippets(monkeypatch, tmp_path):
    _use_tmp_index(monkeypatch, tmp_path)
    index_db.upsert_page(
        doc_id="a",
        collection="legal",
        text="The quick brown fox jumps over the lazy dog",
        confidence=0.9,
        updated_at="2026-07-06T00:00:00",
    )
    index_db.upsert_page(
        doc_id="b",
        collection="general",
        text="nothing relevant here",
        confidence=0.5,
        updated_at="2026-07-05T00:00:00",
    )

    hits = search_service.search("brown")
    assert len(hits) == 1
    assert hits[0].doc_id == "a"
    assert "brown" in hits[0].snippet.lower()


def test_empty_query_returns_nothing(monkeypatch, tmp_path):
    _use_tmp_index(monkeypatch, tmp_path)
    assert search_service.search("   ") == []


def test_reindex_rebuilds_from_b2(monkeypatch, tmp_path):
    _use_tmp_index(monkeypatch, tmp_path)
    now = datetime.now(UTC)
    store = {
        "ocr-results/a/text.txt": b"invoice total 42 dollars",
        "ocr-results/b/text.txt": b"contract terms and conditions",
        "ocr-results/a/result.json": b"{}",  # not a text.txt — must be ignored
    }
    monkeypatch.setattr(
        search_service,
        "list_prefix",
        lambda prefix: [
            {"key": k, "size": len(v), "last_modified": now}
            for k, v in store.items()
            if k.startswith(prefix)
        ],
    )
    monkeypatch.setattr(search_service, "get_bytes", lambda key: store.get(key))
    monkeypatch.setattr(
        docs,
        "read_sidecar",
        lambda doc_id: {"collection": "legal", "confidence": 0.7, "processed_at": "2026-07-06T00:00:00"},
    )

    count = search_service.reindex()
    assert count == 2

    hits = search_service.search("invoice")
    assert len(hits) == 1 and hits[0].doc_id == "a"
