<!-- last_verified: 2026-07-06 -->
# Completed: Initial scaffold — PaddleOCR Document Archive

Built from a B2-backed starter kit into a self-hosted, local-OCR document
archive. B2 is the single source of truth for raw scans and every derived
artifact; the only credential required is a B2 key.

## What shipped

- **Local OCR (primary feature)** — `repo/ocr_engine.py` wraps PaddleOCR 2.x with
  lazy imports, a cached engine per `(lang, detect_orientation)`, and runtime
  device auto-detect (CUDA → CPU; MPS skipped — PaddlePaddle has no MPS backend).
  `service/ocr.py` writes `result.json` + `text.txt` + `overlay.png` to B2 and
  upserts the index. Real end-to-end OCR is validated at the verify step; unit
  tests mock the engine.
- **Document lifecycle** — ingest / list / get / edit / run / delete over B2
  (`raw-scans/` + `ocr-results/`), all five verbs exposed in the UI. Delete is
  scoped to the doc-id prefix.
- **Keyword search** — rebuildable SQLite index (`repo/index_db.py`) + `/search`
  and `/search/reindex`.
- **OCR overlay** — Pillow box rendering (`service/overlay.py`).
- **Frontend** — Dashboard (OCR metrics + throughput), Ingest form, scoped
  Archive explorer, document detail, edit dialog. Full-bucket File explorer kept.

## Standards

- Renamed the tree to `paddleocr-document-archive` (packages, image tags, UTM).
- Standardized env vars: `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`,
  `B2_BUCKET_NAME`, `B2_REGION` (endpoint derived), `B2_PUBLIC_URL_BASE`.
- Custom S3 user agent `b2ai-paddleocr-document-archive`; S3-compatible API only.

## Gates at scaffold time

- `pnpm lint`, `pnpm build` — green (all routes reachable from the sidebar).
- `pnpm lint:api`, `pnpm test:api`, `pnpm check:structure` — green (79 backend
  tests; layering intact; boto3 only in `repo/`; paddleocr only in
  `repo/ocr_engine.py`, imported lazily).

## Known follow-ups

- Entity / layout-region search (keyword-only shipped).
- The exact paddleocr/paddlepaddle wheel pair is validated on macOS arm64 at the
  verify step; see `docs/exec-plans/tech-debt-tracker.md` if a pin needs revising.
