<!-- last_verified: 2026-07-06 -->
# App Workflows

User journeys inside the application.

## Ingest scans

- User navigates to `/upload` (Ingest)
- Picks the OCR language (selector), page-orientation detection (switch), and a source collection (free-text; defaults to `general`)
- Drops or selects one or more scans (TIFF / JPEG / PNG)
- Each scan uploads to B2 under `raw-scans/` with a config sidecar and appears as a *pending* document
- Per-file progress + success/error toasts
- See: [Document Ingest](features/document-ingest.md)

## Run OCR

- From the Archive list row or the document detail, user clicks **Run OCR**
- PaddleOCR runs locally (CUDA if available, otherwise CPU); the first run downloads models once
- Three artifacts are written to B2 (`result.json`, `overlay.png`, `text.txt`), the status flips to *processed*, and the search index is updated
- Toast reports the region count; the row/detail refreshes with confidence
- See: [OCR Recognition](features/ocr-recognition.md)

## Search recognized text

- On `/archive`, user types into the search box
- Matching processed documents appear with a text snippet, each linking to its detail
- A **Reindex** action rebuilds the local index from the B2-resident artifacts (useful on a fresh clone)
- See: [Full-Text Search](features/full-text-search.md)

## View a document

- User opens a document (`/archive/[docId]`)
- Sees the scan next to its detection overlay, the recognized text, and per-region confidences
- See: [Document Archive](features/document-archive.md)

## Edit / re-run

- User clicks **Edit** to change the OCR language, orientation, or collection used by the next run (pre-filled form; does not re-run)
- User clicks **Run OCR** again to re-process with the updated config
- See: [Document Archive](features/document-archive.md)

## Delete a document

- User clicks **Delete** and confirms
- The scan and every `ocr-results/<docId>/*` artifact are removed from B2 (scoped to the doc-id prefix), along with the index row
- See: [Document Archive](features/document-archive.md)

## Browse the whole bucket

- User navigates to `/files`
- Full-bucket tree view with preview / download / delete for every object (raw scans, OCR artifacts, and anything else)
- See: [File Browser](features/file-browser.md)

## View the dashboard

- User navigates to `/`
- Stat cards: documents, pages processed, pending, average confidence, storage used
- OCR-throughput bar chart (pages processed per day) + a recent-runs table
- See: [Dashboard](features/dashboard.md)
