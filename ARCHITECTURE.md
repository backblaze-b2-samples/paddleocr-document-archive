<!-- last_verified: 2026-07-06 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with OCR-archive metrics + throughput chart
  - Ingest form (scan dropzone + OCR config)
  - Scoped Archive explorer (`/archive`) + document detail (`/archive/[docId]`)
  - Full-bucket File explorer (`/files`, kept from the starter)
- **services/api/** — FastAPI backend (layered architecture)
  - Document lifecycle API (ingest / list / get / edit / run OCR / delete)
  - Local OCR via PaddleOCR, isolated in `repo/ocr_engine.py`
  - B2 S3 integration via boto3 (`repo/b2_client.py`, `repo/object_store.py`)
  - Keyword search over a rebuildable SQLite index (`repo/index_db.py`)
  - Health check, structured JSON logging, Prometheus-format metrics
- **packages/shared/** — TypeScript type definitions mirroring the Pydantic models

## Backend Layering

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access — B2 (boto3), PaddleOCR engine, SQLite index
  |
service/   Business logic — orchestrates repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only in `repo/`; `paddleocr` / `paddlepaddle` only in `repo/ocr_engine.py` (lazy imports)
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (documents.py, files.py, ...)
    config/                Settings loaded from environment (derives the S3 endpoint from B2_REGION)
    repo/                  b2_client.py, object_store.py, ocr_engine.py, index_db.py
    service/               documents.py, ocr.py, search.py, overlay.py, files.py, upload.py, metadata.py
    runtime/               documents.py, search.py, files.py, upload.py, health.py, metrics.py
  data/                    gitignored local cache (SQLite index, download counter)
  tests/                   pytest tests (structural + behavioral; OCR engine mocked)
```

## Storage Model (B2 is the single source of truth)

Per document (one scanned page), identified by a sanitized `doc-id`:

```
raw-scans/<doc-id>.<ext>          the original scan
raw-scans/<doc-id>.doc.json       config + status sidecar (collection, lang, orientation, status)
ocr-results/<doc-id>/result.json  regions (boxes + text + confidence) + full text  [once processed]
ocr-results/<doc-id>/overlay.png  detection boxes drawn over the scan               [once processed]
ocr-results/<doc-id>/text.txt     searchable plain text                             [once processed]
```

The SQLite index at `services/api/data/index.db` is a **derived cache**: every
row is reconstructable from the `text.txt` + sidecar in B2 via the reindex
action, so the local file is disposable.

## Containment of external dependencies

- **boto3** is imported only in `repo/b2_client.py` and `repo/object_store.py`. `object_store` reuses the cached client from `b2_client` (extending, not replacing, the adapter).
- **paddleocr / paddlepaddle** are imported only inside functions of `repo/ocr_engine.py`, so importing the module — and unit-testing the service layer with the engine mocked — needs no heavy install.
- **sqlite3** (stdlib) is used only in `repo/index_db.py`.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`: the Next.js web app on the **host** (`:3000`) and the FastAPI OCR runtime in a **linux/arm64 Docker container** (`:8000`, see `services/api/Dockerfile` + repo-root `docker-compose.yml`). The web app talks to the container over HTTP via `NEXT_PUBLIC_API_URL`. The OCR runtime is containerized because the macOS-arm64 `paddlepaddle` CPU wheel hangs on Apple Silicon; the linux/arm64 container runs it natively-fast on the same hardware via Colima. (The host venv is still used for `pnpm test:api` / lint, which mock the engine.)
- **Railway** — two services from the same repo. The API image is heavier because it installs `requirements-ml.txt`. See `infra/railway/README.md`.
- **Device selection (OCR)** — the engine auto-detects CUDA at runtime and falls back to CPU (default). PaddlePaddle has no Apple MPS backend, so the container runs on CPU. A GPU is never required.

## External Services

- **Backblaze B2 S3 API** — scan + artifact storage, retrieval, deletion, presigned URLs. No other external service is contacted at runtime; OCR is fully local.

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s. See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling).
- **API -> B2** — authenticated via application keys, signature v4. The S3 endpoint is derived from `B2_REGION`.
- **Client -> B2** — presigned URLs (inline for previews, attachment for downloads).

## Data Flows

- **Ingest**: Browser -> `POST /documents` (multipart: scan + OCR config) -> service writes `raw-scans/<doc-id>` + `.doc.json` to B2 -> pending index row -> `DocumentRecord`.
- **Run OCR**: Browser -> `POST /documents/{docId}/ocr` -> service reads scan bytes -> `repo/ocr_engine.run_ocr` (local) -> writes `result.json` + `text.txt` + `overlay.png` to B2 -> flips sidecar to processed -> upserts SQLite index -> `DocumentDetail`.
- **Search**: Browser -> `GET /search?q=` -> SQLite keyword query -> `SearchHit[]` with snippets. `POST /search/reindex` rebuilds the index from B2.
- **List / detail**: Browser -> `GET /documents` / `GET /documents/{docId}` -> service reads sidecars (+ result.json for detail), presigns scan/overlay.
- **Delete**: Browser -> `DELETE /documents/{docId}` -> service deletes `raw-scans/<docId>.*` + `ocr-results/<docId>/*` (scoped to the doc-id prefix) + the index row.

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format) and `/health` endpoint (B2 connectivity)

## Canonical Files

- OCR engine adapter (lazy paddleocr): `services/api/app/repo/ocr_engine.py`
- SQLite index adapter: `services/api/app/repo/index_db.py`
- Document orchestration: `services/api/app/service/documents.py`, `service/ocr.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`, `repo/object_store.py`
- Pydantic models: `services/api/app/types/documents.py`
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Document Ingest](docs/features/document-ingest.md)
- [OCR Recognition](docs/features/ocr-recognition.md)
- [Document Archive](docs/features/document-archive.md)
- [Full-Text Search](docs/features/full-text-search.md)
- [File Browser](docs/features/file-browser.md)
- [Dashboard](docs/features/dashboard.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
