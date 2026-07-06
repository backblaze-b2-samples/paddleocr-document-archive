<!-- last_verified: 2026-06-25 -->
# Reliability

Reliability expectations and practices for this project.

## Health Checks

- `GET /health` verifies B2 connectivity and returns `healthy` or `degraded`
- Health endpoint is always available, even when B2 is down

## Error Handling

- HTTP handlers return structured error responses with appropriate status codes
- External service failures (B2) are caught and surfaced as 500/503 responses
- No unhandled exceptions leak stack traces to clients
- Uncaught exceptions are converted to a typed JSON 500 (`{"detail": "Internal server error"}`, modeled by `app.types.ErrorResponse`) by the catch-all in `timing_middleware`
- **Error responses carry CORS headers.** `CORSMiddleware` is registered LAST in `main.py` so it is the outermost middleware and wraps every response — including uncaught-exception 500s produced by the inner catch-all. This is intentional and load-bearing: if a 500 shipped without `Access-Control-Allow-Origin`, the browser would block it and the frontend would surface only an opaque "network error", hiding the real server bug. Regression-guarded by `tests/test_error_handling.py::test_unhandled_exception_500_carries_cors_headers`.

## Logging

- Structured JSON logging via Python stdlib
- Every request gets a `request_id` for tracing
- Log levels: ERROR for failures, WARNING for degraded state, INFO for requests

## Observability

- Request timing middleware logs duration for every request
- `/metrics` endpoint exposes basic Prometheus-format counters
- Upload success/failure counts tracked

## Local OCR

- OCR runs on-device via PaddleOCR. The engine auto-detects CUDA at runtime and falls back to CPU (default); a GPU is never required.
- The **first** run downloads the PaddleOCR models (~a few hundred MB, one-time) to `~/.paddleocr` — this needs network. If the ML deps are not installed, the run endpoint returns a clear 503 pointing at `requirements-ml.txt`.

## Rebuildable search index

- The SQLite keyword index (`services/api/data/index.db`) is a **derived cache**, not a source of truth. Every row is reconstructable from the B2-resident `ocr-results/<doc-id>/text.txt` + sidecar.
- If the index is lost or a fresh clone starts empty, the **Reindex** action (`POST /search/reindex`) rebuilds it from B2. Losing the cache never loses data.

## Graceful Degradation

- Document/file listing returns an empty list (not an error) when B2 has no objects
- Deleting a document is scoped to its `doc-id` prefix, so a failure can't cascade to other documents
- Frontend shows skeleton states while loading, error states on failure

## Deployment

- Railway health checks on `/health`
- Zero-downtime deploys via rolling updates
- Environment-specific configuration via env vars (no config files in prod)
