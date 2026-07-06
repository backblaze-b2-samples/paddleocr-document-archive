<!-- last_verified: 2026-07-06 -->
# Security

Security principles and implementation for the paddleocr-document-archive.

## Local-only OCR — no third-party data egress

OCR runs entirely on-device (PaddleOCR). Scans and recognized text are **never**
sent to any external OCR/AI API — the only network destination at runtime is
Backblaze B2 (your bucket). The one exception is the **first** OCR run, which
downloads the PaddleOCR models over the network to `~/.paddleocr`; no document
data leaves the machine during that download.

## Trust Boundaries

- **Frontend -> API**: CORS-restricted to configured origins, scoped to `GET/POST/PATCH/DELETE/OPTIONS`
- **API -> B2**: Authenticated via `B2_APPLICATION_KEY_ID` + `B2_APPLICATION_KEY`, signature v4. The S3 endpoint is derived from `B2_REGION`.
- **Client -> B2**: Presigned URLs — inline (`Content-Disposition: inline`) for scan/overlay previews, attachment for downloads (10-min expiry)

## Upload Validation

- Filename sanitization: path traversal, null bytes, unsafe chars stripped
- MIME/extension consistency check against allowlist
- Chunked streaming with size enforcement (100MB default)
- Content-type allowlist (images, PDFs, text, archives, audio/video)
- Empty file rejection

## File Key Validation

- Empty keys rejected
- Path traversal patterns rejected (`../`, `%2e%2e`, backslashes, null bytes)
- The bucket is the only access boundary — add prefix scoping in
  `services/api/app/service/files.py::validate_key` if your deployment
  shares a bucket with other workloads

## Download Safety

- Presigned URLs force `Content-Disposition: attachment`
- Prevents inline rendering of user-uploaded content (XSS mitigation)

## Secrets Management

- All secrets loaded via environment variables (pydantic-settings)
- Never committed to source control
- `.env.example` documents required variables without values

## Agent Security Rules

- Never commit `.env`, credentials, or API keys
- Never weaken validation without explicit instruction
- Never bypass CORS, auth, or input sanitization
- Always validate at system boundaries
