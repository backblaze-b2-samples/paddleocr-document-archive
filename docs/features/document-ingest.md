<!-- last_verified: 2026-07-06 -->
# Feature: Document Ingest

## Purpose
Add a scanned page to the archive on Backblaze B2 with its OCR configuration,
as a *pending* document ready to be recognized.

## Used By
- UI: `/upload` (Ingest) page — `components/upload/upload-form.tsx`
- API: `POST /documents` (multipart)

## Core Functions
- `apps/web/src/components/upload/upload-form.tsx` — OCR-config form + dropzone; ingests each dropped scan with the current config
- `apps/web/src/components/upload/dropzone.tsx` — drag-and-drop file selection
- `apps/web/src/lib/api-client.ts` — `ingestDocument()` (XHR upload with progress)
- `services/api/app/runtime/documents.py` — `POST /documents` handler
- `services/api/app/service/documents.py` — `ingest()` validation + B2 writes + index row
- `services/api/app/repo/object_store.py` — `put_bytes()` via boto3

## Canonical Files
- Ingest service pattern: `services/api/app/service/documents.py::ingest`
- Frontend ingest flow: `apps/web/src/components/upload/upload-form.tsx`

## Inputs
- file: scan image (multipart) — TIFF, JPEG, PNG, WEBP, or BMP
- lang: OCR language code (`Select`; default `en`). The selector only offers languages whose recognition model is pre-baked into the offline container image (English today); offering an un-baked language would hang OCR on a model download the offline build can't complete. Add a language by baking it in `services/api/Dockerfile` and mirroring it in `OCR_LANGUAGES` (frontend) + `SUPPORTED_LANGS` (backend).
- detect_orientation: bool (`Switch`; default on)
- collection: free-form label (`Input`; defaults to `general` when blank)

## Outputs
- `DocumentRecord` (status `pending`)
- Side effects on B2: `raw-scans/<doc-id>.<ext>` (scan) and `raw-scans/<doc-id>.doc.json` (config sidecar); a pending row in the SQLite index

## Flow
- User picks OCR language, orientation, and collection, then drops one or more scans
- Client ingests each file via `POST /documents` with the shared config, showing per-file progress
- API reads the file in 1MB chunks with a 100MB streaming cap
- API validates it is a supported image type and the language is supported
- API derives `doc-id` from the sanitized filename stem, writes the scan + sidecar to B2, and upserts a pending index row
- Client toasts success and refreshes the archive/dashboard queries

## Edge Cases
- Unsupported type (e.g. text/PDF) → 415 with a clear message
- Empty file → 400
- Oversized file → 413 (client + server)
- Unsupported / un-baked language → 400 (the offline image only runs languages baked into it)
- Duplicate filename → same `doc-id`; B2 versions the object and the sidecar is overwritten

## UX States
- Config card with safe-default hints (English + orientation on) as `FormDescription` guidance
- Dropzone with per-file progress rows; success/error toasts; "Clear finished"
- On a successful ingest, a **View in Archive** button links forward to `/archive` so the user isn't left to self-navigate to run OCR

## Verification
- Test files: `services/api/tests/test_documents_service.py`
- Required cases: ingest creates scan + sidecar, rejects non-image, rejects empty, rejects bad language, rejects an un-baked language (e.g. `es`)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [OCR Recognition](ocr-recognition.md)
- [Document Archive](document-archive.md)
- [App Workflows](../app-workflows.md)
