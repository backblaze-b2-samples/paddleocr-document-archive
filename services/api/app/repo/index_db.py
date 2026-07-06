"""SQLite keyword-search index over recognized document text.

This is a DERIVED CACHE only: every row can be rebuilt from the OCR artifacts
that live in B2 (`ocr-results/<doc-id>/text.txt` + `result.json`). The DB file
lives under the gitignored `data/` dir and is safe to delete — the app exposes a
"Reindex" action that repopulates it from B2. Uses only the stdlib `sqlite3`.
"""

import sqlite3
from pathlib import Path

from app.config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS pages (
    doc_id      TEXT PRIMARY KEY,
    page_no     INTEGER NOT NULL DEFAULT 1,
    collection  TEXT NOT NULL DEFAULT 'general',
    text        TEXT NOT NULL DEFAULT '',
    confidence  REAL,
    updated_at  TEXT NOT NULL
);
"""


def _db_path() -> Path:
    p = Path(settings.index_db_file)
    if not p.is_absolute():
        # Anchor at services/api/ (two levels up from app/repo/).
        p = Path(__file__).resolve().parents[2] / p
    return p


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute(_SCHEMA)
    return conn


def upsert_page(
    doc_id: str,
    collection: str,
    text: str,
    confidence: float | None,
    updated_at: str,
    page_no: int = 1,
) -> None:
    """Insert or replace a page's searchable row."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO pages (doc_id, page_no, collection, text, confidence, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(doc_id) DO UPDATE SET
                page_no=excluded.page_no,
                collection=excluded.collection,
                text=excluded.text,
                confidence=excluded.confidence,
                updated_at=excluded.updated_at
            """,
            (doc_id, page_no, collection, text, confidence, updated_at),
        )


def update_collection(doc_id: str, collection: str, updated_at: str) -> None:
    """Update just the collection label for an existing row (edit, not re-run)."""
    with _connect() as conn:
        conn.execute(
            "UPDATE pages SET collection=?, updated_at=? WHERE doc_id=?",
            (collection, updated_at, doc_id),
        )


def delete_page(doc_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM pages WHERE doc_id=?", (doc_id,))


def get_page(doc_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM pages WHERE doc_id=?", (doc_id,)
        ).fetchone()
    return dict(row) if row else None


def search(query: str, limit: int = 50) -> list[dict]:
    """Case-insensitive keyword search over recognized text. Newest first."""
    like = f"%{query}%"
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM pages
            WHERE text LIKE ? COLLATE NOCASE AND text != ''
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (like, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def all_rows() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM pages ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def clear() -> None:
    """Drop every row — used before a full reindex from B2."""
    with _connect() as conn:
        conn.execute("DELETE FROM pages")
