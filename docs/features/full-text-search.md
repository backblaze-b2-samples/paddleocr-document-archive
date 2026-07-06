<!-- last_verified: 2026-07-06 -->
# Feature: Full-Text Search

## Purpose
Find any processed page by its recognized text via a keyword search over a local
SQLite index that is fully rebuildable from the B2-resident OCR artifacts.

## Used By
- UI: search box on `/archive` (`components/archive/search-results.tsx`) + "Reindex" button
- API: `GET /search?q=`, `POST /search/reindex`

## Core Functions
- `services/api/app/repo/index_db.py` — stdlib `sqlite3` CRUD + `search()` (case-insensitive `LIKE`)
- `services/api/app/service/search.py` — `search()` (assembles snippets), `reindex()` (rebuild from B2)
- `services/api/app/runtime/search.py` — `GET /search`, `POST /search/reindex`

## Canonical Files
- Index adapter: `services/api/app/repo/index_db.py`
- Search service: `services/api/app/service/search.py`

## Inputs
- q: query string
- limit: max hits (1–200, default 50)

## Outputs
- `GET /search` → `SearchHit[]` (doc_id, collection, confidence, snippet, updated_at)
- `POST /search/reindex` → `{ reindexed: <count> }`
- Side effect: reindex clears and repopulates `services/api/data/index.db` from every `ocr-results/<doc-id>/text.txt` (+ sidecar) in B2

## Flow
- The index is a derived cache. Ingest inserts a pending (empty-text) row; running OCR upserts the recognized text + confidence.
- Search runs a case-insensitive `LIKE` over recognized text and returns matches newest-first, each with a short snippet around the match.
- Reindex throws the local DB away and rebuilds it from B2 — so the cache is disposable and can be regenerated on a fresh clone.

## Scope
- Keyword search only. Entity extraction and layout-region search are intentionally out of scope (documented future work).

## Edge Cases
- Empty / whitespace query → no results (no request made)
- Only processed documents (non-empty text) are searchable
- Fresh clone with an empty index → run Reindex to populate from B2

## Verification
- Test files: `services/api/tests/test_search_service.py`
- Required cases: keyword match returns a snippet, empty query returns nothing, reindex rebuilds from B2 (ignores non-`text.txt` keys)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [OCR Recognition](ocr-recognition.md)
- [Document Archive](document-archive.md)
