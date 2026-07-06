<!-- last_verified: 2026-07-06 -->
# AGENTS.md

This is the authoritative control surface for all coding agents. Read this first.

## 1. Repository Map

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
  app/repo/          B2 adapter + OCR engine + SQLite index (all external SDKs here)
    b2_client.py       S3 file-explorer adapter (boto3)
    object_store.py    generic byte put/get/list/delete/presign for OCR artifacts (boto3)
    ocr_engine.py      PaddleOCR adapter — the ONLY paddleocr/paddlepaddle imports (lazy)
    index_db.py        stdlib sqlite3 keyword index (derived cache, rebuildable from B2)
  app/service/       business logic (documents, ocr, search, overlay, files, upload, metadata)
  app/runtime/       FastAPI routers (documents, search, files, upload, health, metrics)
  data/              gitignored local cache (SQLite index, download counter)
  requirements.txt        core API deps (fast install; OCR engine mocked in tests)
  requirements-ml.txt     heavy ML deps (paddleocr + paddlepaddle) for real OCR
packages/shared/   Shared TypeScript types (mirror the Pydantic models)
docs/              System of record (features, workflows, security, reliability)
docs/exec-plans/   Execution plans and tech debt tracker
infra/railway/     Deployment config
```

## 2. What This App Is

**PaddleOCR Document Archive** is a self-hosted document-digitization pipeline.
Raw scans (TIFF/JPEG/PNG) go to Backblaze B2 under `raw-scans/`; PaddleOCR runs
**locally** over each page and writes three derived artifacts back to B2 under
`ocr-results/<doc-id>/` (`result.json`, `overlay.png`, `text.txt`). A SQLite
index — rebuildable entirely from those B2 artifacts — powers keyword search.
**B2 is the single source of truth**; the only credential required is a B2 key.

This repo grew from a B2-backed starter kit. The following pieces are part of
that reusable contract — keep them:

**Keep as-is (do not strip, rename, or replace)**
- **UI kit / design system.** `apps/web/src/components/ui/` (shadcn primitives), the design tokens in `apps/web/src/app/globals.css`, and the `/design` reference page. Build new screens with these primitives; never edit the generated `components/ui/` files directly.
- **Full-bucket File Explorer.** `/files` route, `apps/web/src/app/files/`, and `apps/web/src/components/files/`. This is the reusable, unscoped B2 browse/preview/download/delete surface. Its sidebar entry stays.

**App-specific surfaces**
- **Ingest** (`/upload`) — dropzone + OCR-config form; each scan is stored on B2 as a pending document.
- **Archive** (`/archive`) — the app's primary working surface: a scoped explorer over `raw-scans/` + `ocr-results/` with per-document Run OCR / View / Edit / Delete and a keyword search box. Distinct from the full-bucket `/files` explorer.
- **Document detail** (`/archive/[docId]`) — scan next to its detection overlay, recognized text, per-region confidences, and lifecycle actions.
- **Dashboard** (`/`) — OCR-archive metrics (documents, pages processed, pending, avg confidence, storage) + an OCR-throughput chart. Update `docs/features/dashboard.md` in the same PR as any dashboard change (see §9).

**Why the two explorers coexist:** `/files` is the generic B2 surface; `/archive`
is scoped to this app's folders and drives the Document lifecycle. Both ship.

## 3. Architectural Invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/`
- **No `paddleocr` / `paddlepaddle` outside `repo/ocr_engine.py`**, and those imports stay lazy (inside functions) so the service layer unit-tests with the engine mocked
- No business logic in route handlers (`runtime/`)
- All request/response data validated at boundary (Pydantic models)
- No shared mutable state across layers

**Frontend**: shadcn/ui components in `src/components/ui/` are generated — never modify them.

**Data fetching**: every API call flows through TanStack Query hooks in `apps/web/src/lib/queries.ts`. No bare `useEffect + fetch` patterns. New endpoints touch three files: `runtime/<router>.py`, `lib/api-client.ts`, `lib/queries.ts`.

## 4. Quality Expectations

- **DRY** — do not duplicate logic, types, or constants. Extract shared code only when used in 2+ places.
- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge
- Prefer boring, composable libraries over clever abstractions
- No implicit type assumptions — use typed models

## 5. Mechanical Enforcement

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| OCR engine import stays lazy | `tests/test_ocr_engine_guard.py` (no-network signature guard) |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |

## 6. Commands

```bash
# Run
pnpm dev               # start both frontend and backend
pnpm dev:web           # frontend only
pnpm dev:api           # backend only

# Backend setup
#   pip install -r services/api/requirements.txt       # core API — enough for tests
#   pip install -r services/api/requirements-ml.txt    # PaddleOCR + PaddlePaddle — real OCR
# First real OCR run downloads models (~few hundred MB) to ~/.paddleocr (one-time, needs network).

# Test & Lint
pnpm lint              # frontend lint (eslint)
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests — OCR engine is MOCKED, no ML install needed
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

## 7. Agent Workflow

1. Read this file first.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before structural changes.
3. For non-trivial changes, create a plan in `docs/exec-plans/active/`.
4. Implement the smallest coherent change.
5. Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
6. Update docs in the same PR (see §9).
7. Move completed plans to `docs/exec-plans/completed/`.
8. Only change files relevant to the task. No drive-by improvements.

## 8. Frontend Conventions

See [docs/dev-workflows.md](docs/dev-workflows.md) for full details.

## 9. Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |
| Active work plans | `docs/exec-plans/active/` |
| Known tech debt | `docs/exec-plans/tech-debt-tracker.md` |

If documentation and implementation conflict, update docs in the same PR. Documentation rot destroys agent reliability.

## 10. Doc Map

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Feature docs | [docs/features/](docs/features/) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows and testing | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Tech debt | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 11. When Unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- Ask before making destructive or irreversible changes
