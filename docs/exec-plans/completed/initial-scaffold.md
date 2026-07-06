# Build plan — `paddleocr-document-archive`

Source of truth for the starter tree: `.claude/scratch/vcsk-4dcf2374-5038-4e2e-b27d-1df8b0adc098/`
(cloned fresh in Phase 0). Delta is computed against that tree only.

---

## 1. Purpose

`paddleocr-document-archive` is a self-hosted document-digitization pipeline for
archivists, legal teams, and digital-preservation specialists who need to turn
large collections of scanned page images (TIFF / JPEG / PNG) into searchable
text and structured layout data — **without sending a single page to an external
OCR API**. Raw scans land in Backblaze B2 under `raw-scans/`; PaddleOCR runs
locally over each page (text detection → angle classification → recognition) and
writes three derived artifacts per page back to B2 under `ocr-results/<doc-id>/`:
a structured `result.json` (bounding boxes + text + confidence), a rendered
`overlay.png` (boxes drawn over the scan for visual QA), and a searchable
`text.txt`. A lightweight SQLite index — rebuildable entirely from those
B2-resident artifacts — powers a keyword search endpoint so any page can be
retrieved by its recognized text. B2 is the single source of truth for both raw
scans and every derived artifact; the only credential needed is a B2 key.

The sample demonstrates B2 as the durable, S3-compatible backbone of a
high-write-amplification OCR archive (each ingested page fans out to ~4 B2
objects) and shows an AI/ML workload that runs entirely on local OSS.

---

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling. We keep its full B2-backed scaffold (UI kit,
upload, bucket explorer, layered FastAPI, tests, docs system) and strip only the
starter-specific demo content that this app replaces.

### KEEP (as-is — do not strip / rename / restyle)
- **UI kit / design system**: all of `apps/web/src/components/ui/`, design tokens
  in `apps/web/src/app/globals.css`, the `/design` reference page and its
  `components/design/*`. Build every new screen from these primitives.
- **Bucket explorer (NON-NEGOTIABLE keep)**: the `/files` route
  (`apps/web/src/app/files/`, `apps/web/src/components/files/*`,
  `lib/file-tree.ts`) — full-bucket browse / preview / download / delete. Stays
  in the sidebar. This is the reusable B2 surface and is never removable.
- **Upload plumbing**: `apps/web/src/components/upload/*`, the presigned-URL
  download/preview flow, `lib/api-client.ts` transport, `lib/queries.ts`
  TanStack Query layer, `lib/refresh-context.tsx`, `query-client.tsx`.
- **Backend spine**: layered architecture (`types → config → repo → service →
  runtime`), `repo/b2_client.py` (the S3 adapter — extended, not replaced),
  structured JSON logging, `/health`, `/metrics`, CORS-on-errors middleware,
  the whole `tests/` structural + behavioral harness, `scripts/` (dev, doctor,
  pick-port), `packages/shared`.
- **Layout**: `components/layout/*` (sidebar, header, health-banner,
  command-palette, theme-provider) — adapted only for new nav entries + app name.

### TRIM (remove — starter demo content this app replaces)
- **Dashboard demo widgets**: `components/dashboard/stats-cards.tsx`,
  `upload-chart.tsx`, `recent-uploads-table.tsx` are rewritten for OCR-archive
  metrics (see §4). The `/` route stays; its contents change.
- **Generic metadata extraction**: `service/metadata.py` (EXIF / PDF-info /
  checksums) is trimmed to just image dimensions (still useful for scans) —
  OCR recognition replaces it as the marquee derived-data feature. Delete
  `docs/features/metadata-extraction.md`.
- **Starter history / self-review docs** (not this app's history):
  `CODE_REVIEW.md`, and the `docs/exec-plans/completed/*` starter plans
  (download-count, preserve-filenames, initialization, etc.). Phase 5 drops
  this build's plan into `completed/initial-scaffold.md`.
- **e2e**: `apps/web/e2e/upload.spec.ts` stays but is renamed/retargeted to the
  ingest flow (a document-ingest happy path). Keep it minimal.

### ADD (new for paddleocr-document-archive)
- **PaddleOCR engine adapter** — `services/api/app/repo/ocr_engine.py`: contains
  the ONLY `paddleocr` / `paddlepaddle` imports (lazy, inside functions), a
  cached engine singleton keyed by (lang, detect_orientation), device
  auto-detection (see §4), and a `run_ocr(image_bytes, ...) -> list[OcrRegion]`
  function. Contained in `repo/` per the "external SDKs live in repo/" ethos.
- **SQLite search index adapter** — `services/api/app/repo/index_db.py`: stdlib
  `sqlite3` CRUD for a `pages(doc_id, page_no, collection, text, confidence,
  updated_at)` table + a keyword search query (LIKE, case-insensitive). The DB
  file lives at `services/api/data/index.db` (gitignored). Derived cache only —
  fully rebuildable from B2.
- **Document services** — `service/documents.py` (ingest / list / get / edit /
  delete, orchestrating `b2_client` + `index_db`), `service/ocr.py` (run OCR →
  write `result.json` + `overlay.png` + `text.txt` to B2 → upsert index),
  `service/search.py` (query index, assemble snippets), `service/overlay.py`
  (Pillow box-drawing → PNG bytes). Keep each < 300 lines.
- **Routers** — `runtime/documents.py` (CRUD + run), `runtime/search.py`
  (keyword search). Registered in `main.py`. Every new endpoint touches the
  three canonical files: router + `api-client.ts` + `queries.ts`.
- **Types** — `types/documents.py`: `OcrRegion`, `DocumentRecord`,
  `DocumentDetail`, `OcrConfig`, `SearchHit`, `ArchiveStats`. Mirror in
  `packages/shared/src/types.ts`.
- **Frontend — scoped Archive explorer (NON-NEGOTIABLE add)**: `/archive` route
  = the sample-specific asset explorer, scoped to THIS app's folders
  (`raw-scans/` + `ocr-results/`). Lists documents with status
  (pending / processed), confidence, collection, thumbnail; row actions Run OCR
  / View / Edit / Delete; a keyword search box at the top. This is the app's
  primary working surface and is distinct from the full-bucket `/files`
  explorer, which stays.
- **Frontend — document detail** `/archive/[docId]`: side-by-side scan +
  overlay, recognized text, per-region boxes with confidence, Run/Edit/Delete.
- **Frontend — ingest form** (`/upload` adapted, kept at `/upload`, relabeled
  "Ingest"): dropzone + OCR-config form (see §4 form UX).
- **Frontend — edit dialog/form** for a document's OCR config + collection.
- **Frontend — dashboard** rewritten for OCR-archive metrics (§4).
- **Nav**: Dashboard, Ingest, Archive, Files (bucket explorer, kept), Settings,
  Design System.
- **Deps**: `services/api/requirements-ml.txt` (heavy, isolated) with pinned
  `paddleocr` + `paddlepaddle` + `numpy<2`; `opencv-python-headless` if not
  pulled transitively. Core `requirements.txt` gains `numpy<2` bound only.

> Note (bucket-explorer tension): none. This app has a natural home for BOTH a
> scoped explorer (Archive) and the full-bucket explorer (Files), so both ship.

---

## 3. B2 surface (S3-compatible only — no b2-native)

All access goes through `repo/b2_client.py` via the boto3 S3 client with the
custom user-agent. No b2-native SDK anywhere. S3 operations exercised:

| Operation | Where / why |
|-----------|-------------|
| `put_object` | ingest scan → `raw-scans/<doc-id><ext>`; write `.doc.json` config sidecar; write `ocr-results/<doc-id>/result.json`, `overlay.png`, `text.txt` |
| `list_objects_v2` (paginated) | list `raw-scans/` + `ocr-results/` for the Archive view, stats, and index rebuild |
| `get_object` | read scan bytes for OCR; read `result.json` / `text.txt` when building the index and the detail view |
| `head_object` | existence / metadata checks (doc exists? processed?) |
| `delete_object` / `delete_objects` | delete a document = remove its raw scan + all `ocr-results/<doc-id>/*` (scoped to the doc-id prefix only) |
| `generate_presigned_url` | inline preview of scan + overlay PNG in the UI (does not count as a download) |

**b2-native use: NONE.** No justification needed — the app is S3-only.

**Env-var standardization (REQUIRED — starter kit deviates).** The starter uses
`B2_KEY_ID` / `B2_ENDPOINT` / `b2_public_url`, which violate parent CLAUDE.md
Standard #3 and the `/b2-doctor` audit. Rename to the standard names everywhere
(`.env.example`, `config/settings.py`, `repo/b2_client.py`, `main.py`
startup-validation lists, README, docs):

| Starter name | Standard #3 name | Notes |
|--------------|------------------|-------|
| `B2_KEY_ID` | `B2_APPLICATION_KEY_ID` | boto3 `aws_access_key_id` |
| `B2_APPLICATION_KEY` | `B2_APPLICATION_KEY` | unchanged |
| `B2_BUCKET_NAME` | `B2_BUCKET_NAME` | unchanged |
| `B2_ENDPOINT` | `B2_REGION` | endpoint derived: `https://s3.{B2_REGION}.backblazeb2.com`; default region `us-west-004` |
| `b2_public_url` | `B2_PUBLIC_URL_BASE` | unchanged meaning |

`config/settings.py` exposes `b2_application_key_id`, `b2_application_key`,
`b2_bucket_name`, `b2_region` (default `us-west-004`), `b2_public_url_base`, and
a derived `endpoint_url` property. `main.py` `REQUIRED_B2_SETTINGS` /
`PLACEHOLDER_VALUES` updated to match. Custom user-agent on the S3 client:
`user_agent_extra="b2ai-paddleocr-document-archive"`.

---

## 4. Key features

Each feature seeds the README feature list and a `docs/features/<feature>.md`
stub. `deployment` is an explicit per-feature field.

1. **Local OCR recognition (PaddleOCR)** — `deployment: local`.
   - External API provider: **NONE.** The description mandates "no second API
     key, B2 credentials only" and the sample's whole point is on-device OCR, so
     per `api-provider-selection.md` step-2 rule 1 (point is a local capability)
     LOCAL is the default with no remote path required. No provider env key.
   - Per-run cost: **$0** (local compute only).
   - **CPU default + GPU auto-detect (hard rule):** the engine picks the first
     available of CUDA → CPU at runtime. **PaddlePaddle has no usable Apple MPS
     backend**, so the MPS rung is skipped for this sample (documented
     deviation from the generic CUDA→MPS→CPU rule; falls back CUDA→CPU). Detect
     via `paddle.device.is_compiled_with_cuda()` + a GPU being present; pass
     `use_gpu=<bool>` to `PaddleOCR(...)`. Never hard-require a GPU.
   - **Pinning (fresh-clone reproducibility — flag for /sample-3-verify):** pin
     `paddleocr>=2.7,<2.10`, a compatible `paddlepaddle` (CPU wheel), and
     `numpy<2` (PaddlePaddle 2.x requires numpy<2) in `requirements-ml.txt`.
     Use the **2.x API**: `PaddleOCR(use_angle_cls=<detect_orientation>,
     lang=<lang>, use_gpu=<detected>, show_log=False)` and
     `engine.ocr(image_path_or_ndarray, cls=<detect_orientation>)` returning,
     per image, a list of `[box(4 points), (text, confidence)]`. (PaddleOCR 3.x
     renamed `.ocr()`→`.predict()` and dropped `use_angle_cls`/`use_gpu` — do
     NOT use 3.x.) First run downloads det/rec/cls models to `~/.paddleocr`
     (network + ~a few hundred MB, one-time) — document this. The exact
     paddleocr/paddlepaddle wheel pair MUST be validated end-to-end on macOS
     arm64 at the `/sample-3-verify` step; unit tests here MOCK the engine so
     `pnpm test:api` stays green without the heavy install.

2. **Document archive on B2** — `deployment: local` (B2 I/O only).
   - Raw scans + all OCR artifacts are B2-resident; B2 is the single source of
     truth. Scoped Archive explorer + full document lifecycle (§ primary entity).

3. **Full-text search index** — `deployment: local`.
   - SQLite index built from B2-resident `text.txt` / `result.json`; keyword
     search endpoint returns matching docs + text snippets. Rebuildable from B2
     via a "Reindex" action. (Entity/layout-region search is documented as
     future work, NOT built — keyword search is the shipped capability.)

4. **OCR overlay generation** — `deployment: local`.
   - Pillow draws detected bounding boxes over the scan; the `overlay.png` is
     stored on B2 and shown in the detail view for visual QA of detection.

5. **Bucket explorer (kept)** — the starter's full-bucket browse/preview/
   download/delete surface (`/files`).

6. **Archive dashboard** — documents ingested, pages processed, pending vs
   processed, average recognition confidence, storage used, an OCR-throughput
   chart (docs processed/day) and a recent-runs table.

### Provider orchestration via Genblaze
Not applicable — the description does not mention Genblaze / `genblaze-*` /
`genblaze-s3` and there is no external AI provider to route (OCR is local). No
Genblaze SDK usage.

### Primary-entity lifecycle (mandatory)

**Primary entity: `Document`** — one scanned page in the archive, identified by
a `doc-id` (sanitized stem of the ingested filename). B2 layout per document:
`raw-scans/<doc-id><ext>` (the scan), `raw-scans/<doc-id>.doc.json` (config
sidecar: collection + OCR config + status), `ocr-results/<doc-id>/result.json`
+ `overlay.png` + `text.txt` (present once processed). All five lifecycle verbs
are exposed in the UI and built:

| Verb | Endpoint | UI | Notes |
|------|----------|----|-------|
| **create** | `POST /documents` (multipart: file + config) | Ingest form (`/upload`) | uploads scan → `raw-scans/`, writes `.doc.json`, index row = pending |
| **read** | `GET /documents`, `GET /documents/{docId}` | Archive list + detail | list = scoped explorer; detail = scan/overlay/text/regions |
| **run** | `POST /documents/{docId}/ocr` | "Run OCR" button (list row + detail) | runs PaddleOCR, writes 3 artifacts to B2, upserts index, flips status→processed |
| **edit** | `PATCH /documents/{docId}` | Edit form (pre-filled) | updates collection + OCR config (lang, detect-orientation) used by the NEXT run; distinct from run (edit = change config/label, run = execute) |
| **delete** | `DELETE /documents/{docId}` | Delete w/ confirm dialog | removes raw scan + all `ocr-results/<docId>/*` (scoped to the doc-id prefix) + index rows |

`omitted_ui_verbs`: **none** — all five verbs are built. (Phase 5 field = `[]`.)

### Form UX conventions

**Ingest / create form** (`components/upload/*` adapted):
- Fields: **scan file** (dropzone, required); **OCR language** — finite set →
  `Select` (English `en`, Chinese `ch`, French `fr`, German `german`, Spanish
  `es`, Japanese `japan`, Korean `korean`); **detect orientation** — boolean →
  `Switch`; **source collection** — legitimately open-ended → free-text `Input`.
- Safe defaults surfaced as placeholder / `FormDescription` guidance only (no
  autofill button): language = English (default selected), detect orientation =
  on, collection placeholder `general`. Guidance text explains a sound first
  run ("Leave language on English and orientation on for typical latin-script
  scans").

**Edit form** (pre-filled with the document's current config):
- Fields: OCR language (`Select`), detect orientation (`Switch`), collection
  (`Input`). Selector rule applies (finite sets use `Select`/`Switch`); no
  default-hint needed since the form opens pre-filled.

Exemplar to mirror: `apps/web/src/components/settings/settings-form.tsx`
(react-hook-form + zod + shadcn `Form`/`Select`/`Switch`/`RadioGroup`).

---

## 5. Doc transforms

| Starter doc | Action |
|-------------|--------|
| `README.md` | **Rewrite** — PaddleOCR Document Archive: use case, 4-step workflow, quick start (standard `B2_*` names, `requirements-ml.txt` install note + first-run model download), features, commands, tech stack (add PaddleOCR/paddlepaddle/SQLite). |
| `AGENTS.md` | **Rewrite §1/§2/§6** — repo map gains `repo/ocr_engine.py`, `repo/index_db.py`, new services/routers, `data/`; "building on" section reframed (this IS the app); commands add ML-install note. Keep invariants/enforcement tables. |
| `ARCHITECTURE.md` | **Rewrite data-flow** — ingest → run OCR (local) → generate artifacts to B2 → index → search; note the repo/ containment of paddleocr + sqlite3. |
| `docs/features/file-upload.md` | **Rewrite** → `document-ingest.md` (scan ingest + OCR config). |
| `docs/features/file-browser.md` | **Keep** (bucket explorer) — light edit to mention the scoped Archive alternative. |
| `docs/features/dashboard.md` | **Rewrite** for OCR-archive metrics. |
| `docs/features/metadata-extraction.md` | **Delete** (replaced by OCR). |
| `docs/features/ocr-recognition.md` | **New** — PaddleOCR detect/cls/recognize, device autodetect, pinning, first-run models, artifacts written. |
| `docs/features/document-archive.md` | **New** — scoped explorer + Document lifecycle (CRUD+run). |
| `docs/features/full-text-search.md` | **New** — SQLite index, search endpoint, reindex, keyword-only scope. |
| `docs/features/_template.md` | Keep. |
| `docs/app-workflows.md` | **Rewrite** journeys: ingest → run OCR → search → view → edit/re-run → delete. |
| `docs/dev-workflows.md` | **Light edit** — add ML deps install + engine-mocking test note. |
| `docs/SECURITY.md`, `docs/RELIABILITY.md` | **Light edit** — local-only OCR (no third-party data egress); first-run model download; index is rebuildable. |
| `CODE_REVIEW.md` | **Delete** (starter artifact). |
| `docs/exec-plans/completed/*` (starter plans) | **Delete**; Phase 5 adds `completed/initial-scaffold.md`. |
| `infra/railway/README.md` | **Light edit** — renamed service, standard env-var names, note ML deps make the image heavier. |

---

## 6. Rename table (`vibe-coding-starter-kit` → `paddleocr-document-archive`)

| Identifier / kind | From | To |
|-------------------|------|----|
| kebab slug / repo name | `vibe-coding-starter-kit` | `paddleocr-document-archive` |
| root `package.json` `name` | `vibe-coding-starter-kit` | `paddleocr-document-archive` |
| pnpm workspace pkg (web) | `@vibe-coding-starter-kit/web` | `@paddleocr-document-archive/web` |
| pnpm workspace pkg (shared) | `@vibe-coding-starter-kit/shared` | `@paddleocr-document-archive/shared` |
| all TS imports of `@vibe-coding-starter-kit/shared` | `@vibe-coding-starter-kit/shared` | `@paddleocr-document-archive/shared` |
| `package.json` script filters | `--filter @vibe-coding-starter-kit/web` | `--filter @paddleocr-document-archive/web` |
| README `pnpm --filter …` commands | `@vibe-coding-starter-kit/web` | `@paddleocr-document-archive/web` |
| `APP_NAME` (`lib/app-config.ts`) | `OSS Starter Kit` | `PaddleOCR Document Archive` |
| `APP_DESCRIPTION` | `File management dashboard powered by Backblaze B2` | `Self-hosted OCR pipeline that turns scanned documents into searchable text and layout data, stored on Backblaze B2` |
| FastAPI `title` (`main.py`) | `OSS Starter Kit API` | `PaddleOCR Document Archive API` |
| Title Case (README H1, docs headings) | `Vibe Coding Starter Kit` / `OSS Starter Kit` | `PaddleOCR Document Archive` |
| S3 `user_agent_extra` | `b2ai-oss-start` | `b2ai-paddleocr-document-archive` |
| UTM `utm_content` in links | `b2ai-oss-start` | `b2ai-paddleocr-document-archive` |
| infra/railway service / image tag | `vibe-coding-starter-kit` | `paddleocr-document-archive` |
| e2e spec name | `upload.spec.ts` | `ingest.spec.ts` |

---

## Build / test gates (Phase 2 must satisfy)
- `pnpm lint`, `pnpm build` (web typecheck+build) pass — no unused imports, no
  dead routes; every new page reachable from the sidebar.
- `pnpm lint:api`, `pnpm test:api`, `pnpm check:structure` pass — layering
  intact (`paddleocr`/`paddlepaddle` ONLY in `repo/`, boto3 ONLY in `repo/`,
  every file < 300 lines, all layers + `__init__.py` present).
- OCR-service unit tests mock `repo.ocr_engine` (no heavy install needed to go
  green). Add a signature/no-network guard test for the engine adapter.
- `.env.example` uses the standard `B2_*` names; no real secrets anywhere.
- `data/` (sqlite index, download counter) gitignored.
