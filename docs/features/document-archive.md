<!-- last_verified: 2026-07-06 -->
# Feature: Document Archive

## Purpose
A scoped explorer over this app's B2 folders (`raw-scans/` + `ocr-results/`)
that drives the full Document lifecycle. This is the app's primary working
surface, distinct from the unscoped full-bucket File explorer (`/files`).

## Used By
- UI: `/archive` (list + search + actions), `/archive/[docId]` (detail)
- API: `GET /documents`, `GET /documents/{docId}`, `POST /documents`, `PATCH /documents/{docId}`, `POST /documents/{docId}/ocr`, `DELETE /documents/{docId}`

## Core Functions
- `apps/web/src/components/archive/archive-explorer.tsx` — list, search box, per-row actions, delete confirm
- `apps/web/src/components/documents/document-detail.tsx` — scan + overlay, text, regions, actions
- `apps/web/src/components/documents/edit-document-dialog.tsx` — pre-filled edit form
- `services/api/app/service/documents.py` — ingest / list / get / edit / delete + stats
- `services/api/app/repo/object_store.py` — `list_prefix`, `get_bytes`, `put_bytes`, `delete_prefix`, `get_inline_url`

## Canonical Files
- Lifecycle service: `services/api/app/service/documents.py`
- Scoped explorer: `apps/web/src/components/archive/archive-explorer.tsx`

## Primary entity: Document (one scanned page)
Identified by a sanitized `doc-id`. B2 layout: `raw-scans/<doc-id>.<ext>`,
`raw-scans/<doc-id>.doc.json`, and (once processed) `ocr-results/<doc-id>/*`.

| Verb | Endpoint | UI |
|------|----------|----|
| create | `POST /documents` | Ingest form (`/upload`) |
| read | `GET /documents`, `GET /documents/{docId}` | Archive list + detail |
| run | `POST /documents/{docId}/ocr` | "Run OCR" (row + detail) |
| edit | `PATCH /documents/{docId}` | Edit dialog (pre-filled) — changes config for the NEXT run |
| delete | `DELETE /documents/{docId}` | Delete w/ confirm |

## Inputs / Outputs
- List → `DocumentRecord[]` (status, collection, confidence, thumbnail URL)
- Detail → `DocumentDetail` (text, regions, scan/overlay URLs)
- Edit → `OcrConfig` (lang, detect_orientation, collection); returns updated `DocumentRecord`
- Delete → removes the scan + all `ocr-results/<docId>/*` (scoped to the doc-id prefix) + the index row

## Flow
- `/archive` lists documents newest-first with thumbnail, status badge, collection, confidence
- Row actions: Run OCR (re-run if processed), View (detail), Edit (dialog), Delete (confirm)
- Detail shows the scan next to its detection overlay, the recognized text, and per-region confidences
- Edit changes only the config used by the next run; it does not re-run OCR

## Edge Cases
- Delete is scoped by a trailing-dot prefix (`raw-scans/<id>.`) so a sibling with a shared id-prefix is never touched
- Missing document → 404
- Pending document → detail shows "Run OCR to recognize text"

## UX States
- Loading skeletons; inline error state with retry; empty state with an Ingest action

## Verification
- Test files: `services/api/tests/test_documents_service.py`
- Required cases: ingest, list, get, edit (config only, status unchanged), scoped delete
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [OCR Recognition](ocr-recognition.md)
- [File Browser](file-browser.md)
- [App Workflows](../app-workflows.md)
