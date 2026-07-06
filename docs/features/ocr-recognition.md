<!-- last_verified: 2026-07-06 -->
# Feature: OCR Recognition (PaddleOCR, local)

## Purpose
Recognize the text in a scanned page entirely on-device with PaddleOCR and
persist the results to Backblaze B2 — no external OCR API, no per-page cost, no
data egress.

## Used By
- UI: "Run OCR" action on the Archive list row and document detail
- API: `POST /documents/{docId}/ocr`

## Core Functions
- `services/api/app/repo/ocr_engine.py` — the ONLY `paddleocr` / `paddlepaddle` imports (lazy); cached engine per `(lang, detect_orientation)`; `detect_use_gpu()`; `run_ocr()`
- `services/api/app/service/ocr.py` — `run_document_ocr()` orchestration
- `services/api/app/service/overlay.py` — `draw_overlay()` (Pillow box rendering)
- `services/api/app/runtime/documents.py` — `POST /documents/{docId}/ocr` handler

## Canonical Files
- Engine adapter (lazy imports, device autodetect): `services/api/app/repo/ocr_engine.py`
- Run pipeline: `services/api/app/service/ocr.py`

## Inputs
- docId: path parameter
- Uses the document's stored config (lang, detect_orientation) from its sidecar

## Outputs
- `DocumentDetail` (status `processed`, regions, text, overlay/scan URLs)
- Side effects on B2: `ocr-results/<doc-id>/result.json` (regions + text + confidence), `text.txt` (searchable plain text), `overlay.png` (boxes over the scan); sidecar flipped to processed; SQLite index upserted

## Flow
- Handler loads the sidecar + scan bytes from B2
- `repo/ocr_engine.run_ocr()` opens the image, converts to a BGR ndarray, and runs the cached `PaddleOCR` engine (`use_angle_cls`, `use_gpu`, `.ocr(..., cls=)` — PaddleOCR **2.x** API)
- Regions (4-point box, text, confidence) are joined into text; average confidence is computed
- `result.json`, `text.txt`, and `overlay.png` are written to B2; the sidecar flips to processed; the index is upserted
- Detail is returned for the UI

## Device selection (deployment: local)
- Auto-detects at runtime: CUDA (if PaddlePaddle is CUDA-built **and** a GPU is present) → CPU (default). A GPU is never required.
- PaddlePaddle has **no usable Apple MPS backend**, so the MPS rung of the generic CUDA→MPS→CPU rule is skipped for this sample (documented deviation); Apple Silicon runs on CPU.

## Model download (first run)
- The first real run downloads detection/recognition/angle-classification models (~a few hundred MB, one-time) to `~/.paddleocr`. That first run needs network; recognition itself is fully local.

## Reproducibility / pinning
- `services/api/requirements-ml.txt` pins `paddleocr>=2.7,<2.10`, a CPU `paddlepaddle>=2.5,<2.7`, and `numpy<2`. Do NOT use PaddleOCR 3.x (renamed `.ocr()`→`.predict()`, dropped `use_angle_cls`/`use_gpu`). The exact wheel pair is validated end-to-end on macOS arm64 at the verify step.

## Edge Cases
- Document not found / scan bytes missing → 404
- OCR engine not installed → 503 with a message to install `requirements-ml.txt`
- Page with no detected text → empty text + zero regions, still marked processed

## Verification
- Test files: `services/api/tests/test_ocr_service.py`, `services/api/tests/test_ocr_engine_guard.py`
- Required cases: run writes all three artifacts + flips status + upserts index (engine mocked); missing document raises; engine import stays lazy; `run_ocr` signature stable
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green; end-to-end real OCR validated on macOS arm64 at the verify step

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Document Archive](document-archive.md)
- [Full-Text Search](full-text-search.md)
