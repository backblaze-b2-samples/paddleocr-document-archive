<!-- last_verified: 2026-07-06 -->
# PaddleOCR Document Archive

Turn a pile of scanned pages into a searchable, structured archive — **without
sending a single page to an external OCR API**. Raw scans land in
**[Backblaze B2](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-paddleocr-document-archive)**,
[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) runs locally over each
page (text detection → angle classification → recognition), and three derived
artifacts are written back to B2 per page: a structured `result.json` (boxes +
text + confidence), a rendered `overlay.png` for visual QA, and a searchable
`text.txt`. A lightweight SQLite index — rebuildable entirely from those
B2-resident artifacts — powers keyword search. **B2 is the single source of
truth; the only credential you need is a B2 key.**

Built for archivists, legal teams, and digital-preservation workflows that need
on-device OCR over large scan collections, and as a reference for using B2 as
the durable, S3-compatible backbone of a high-write-amplification AI workload
(each ingested page fans out to ~4 B2 objects).

## The 4-step workflow

1. **Ingest** a scan (TIFF / JPEG / PNG) → stored at `raw-scans/<doc-id>` on B2 with a config sidecar; the document starts as *pending*.
2. **Run OCR** locally → PaddleOCR recognizes the page and writes `ocr-results/<doc-id>/{result.json, overlay.png, text.txt}` to B2; status flips to *processed*.
3. **Search** recognized text → the SQLite keyword index returns matching pages with snippets.
4. **Review / edit / delete** → inspect the scan next to its detection overlay, adjust OCR config for the next run, or remove the document (scan + all artifacts).

## What you get

- **Local OCR (PaddleOCR)** — text detection, angle classification, and recognition run entirely on-device. No second API key, no per-page cost, no data egress.
- **Scoped Archive explorer** (`/archive`) — the app's primary surface: list documents with status, confidence, collection, and a thumbnail; run OCR, view, edit, or delete each; keyword search box on top.
- **Full-bucket File explorer** (`/files`) — the reusable B2 browse / preview / download / delete surface, kept from the starter kit.
- **OCR overlay** — detected bounding boxes drawn over the scan and stored on B2 for visual detection QA.
- **Keyword full-text search** — a rebuildable SQLite index over recognized text; a "Reindex" action repopulates it from B2.
- **Archive dashboard** — documents ingested, pages processed, pending vs processed, average recognition confidence, storage used, and an OCR-throughput chart.

## Quick Start

You need: Node.js >= 20, pnpm >= 9, Python >= 3.11, and a free
**[Backblaze B2 account](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-paddleocr-document-archive)**.

**1. Install frontend dependencies**

```bash
pnpm install
```

**2. Set up the backend**

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt           # core API (fast; OCR engine mocked in tests)
pip install -r requirements-ml.txt        # PaddleOCR + PaddlePaddle (heavy) — for real OCR
cd ../..
```

> The **first real OCR run** downloads the detection / recognition / angle-classification models (~a few hundred MB, one-time) to `~/.paddleocr`. That first run needs network access; OCR itself never sends your scans to any external service. On a machine with a CUDA GPU the engine uses it automatically, otherwise it runs on CPU (PaddlePaddle has no Apple MPS backend, so Apple Silicon runs on CPU).

**3. Add your B2 credentials**

```bash
cp .env.example .env
```

In the [Backblaze B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-paddleocr-document-archive):

1. **Create a bucket** → paste its **Bucket Unique Name** into `B2_BUCKET_NAME`. Set `B2_REGION` to the bucket's region slug (e.g. `us-west-004`); the S3 endpoint is derived as `https://s3.<B2_REGION>.backblazeb2.com`.
2. **Create an application key** with Read and Write → paste **keyID** into `B2_APPLICATION_KEY_ID` and **applicationKey** into `B2_APPLICATION_KEY` (shown once).

**4. Run it**

```bash
pnpm dev
```

Frontend at `localhost:3000`, API at `localhost:8000`. `pnpm dev` runs `pnpm doctor` first — a preflight that catches a missing venv, placeholder `.env`, wrong tool versions, and busy ports.

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start frontend + backend |
| `pnpm dev:web` | Frontend only |
| `pnpm dev:api` | Backend only |
| `pnpm build` | Type-check + build frontend |
| `pnpm lint` | Lint frontend |
| `pnpm lint:api` | Lint backend (ruff) |
| `pnpm test:api` | Backend tests (OCR engine is mocked — no ML install needed) |
| `pnpm check:structure` | Verify layering rules |
| `pnpm test:e2e` | Playwright e2e tests (run `pnpm --filter @paddleocr-document-archive/web exec playwright install chromium` once first) |

## Tech Stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, Recharts, TanStack Query
- Python 3.11+, FastAPI, boto3, Pydantic v2, Pillow
- **PaddleOCR + PaddlePaddle** (local OCR, isolated in `services/api/requirements-ml.txt`)
- **SQLite** (stdlib) for the rebuildable keyword index
- Backblaze B2 (S3-compatible object storage) — single source of truth
- pnpm workspaces (monorepo)

## Core Features

- [Document Ingest](docs/features/document-ingest.md) — scan ingest + per-document OCR config
- [OCR Recognition](docs/features/ocr-recognition.md) — local PaddleOCR pipeline, device autodetect, artifacts
- [Document Archive](docs/features/document-archive.md) — scoped explorer + full document lifecycle
- [Full-Text Search](docs/features/full-text-search.md) — SQLite keyword index + reindex from B2
- [File Browser](docs/features/file-browser.md) — full-bucket browse / preview / download / delete
- [Dashboard](docs/features/dashboard.md) — OCR-archive metrics and throughput
- [Design System](docs/design-system.md) — tokens, primitives, loader, error/empty states. Live at `/design`.

## Documentation Map

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Agent table of contents — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, layering, data flows |
| [docs/features/](docs/features/) | Feature docs |
| [docs/app-workflows.md](docs/app-workflows.md) | User journeys |
| [docs/dev-workflows.md](docs/dev-workflows.md) | Engineering workflows and testing |
| [docs/SECURITY.md](docs/SECURITY.md) | Security principles |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Reliability expectations |
| [docs/exec-plans/](docs/exec-plans/) | Execution plans and tech debt tracker |

## License

MIT License — see [LICENSE](LICENSE) for details.

## Claude Agent B2 Skill

Manage Backblaze B2 from your terminal using natural language (list/search, audits, stale or large file detection, security checks, safe cleanup).

Repo: [https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage](https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage)
