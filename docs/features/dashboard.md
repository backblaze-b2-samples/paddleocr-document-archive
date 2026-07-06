<!-- last_verified: 2026-07-06 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance overview of the OCR archive: how many documents are ingested,
how many pages have been processed, how confident recognition is, and recent
throughput.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /documents/stats`, `GET /documents/stats/activity`, `GET /documents`

## Core Functions
- `apps/web/src/components/dashboard/archive-stats.tsx` — 5 stat cards
- `apps/web/src/components/dashboard/processing-chart.tsx` — bar chart of pages processed/day
- `apps/web/src/components/dashboard/recent-runs.tsx` — last 10 processed documents
- `apps/web/src/lib/api-client.ts` — `getArchiveStats()`, `getProcessingActivity()`, `getDocuments()`
- `services/api/app/service/documents.py` — `archive_stats()`, `processing_activity()`

## Canonical Files
- Stats service logic: `services/api/app/service/documents.py::archive_stats`
- Dashboard cards: `apps/web/src/components/dashboard/archive-stats.tsx`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /documents/stats` → `ArchiveStats` (total_documents, processed, pending, pages_processed, avg_confidence, storage_bytes, storage_human)
- `GET /documents/stats/activity?days=7` → `DailyProcessedCount[]` (server-side aggregation from sidecar `processed_at`)
- `GET /documents` (last 10 processed) → recent OCR runs table

## Flow
- Page loads → parallel queries for archive stats, processing activity, and the document list
- Stat cards: Documents, Pages Processed, Pending, Avg Confidence, Storage Used
- Throughput chart: pages processed per day for the last 7 days
- Recent runs table: last 10 processed documents (filename, collection, confidence, processed date), each linking to its detail page

## Edge Cases
- API unavailable → inline error states with retry; the chart avoids a false zero state while loading
- No documents → empty chart + empty table messages
- Large archive → stats paginate through B2 objects via `ContinuationToken`

## UX States
- Loading: skeletons for cards, chart, and table
- Empty: "No processed documents yet" / "No activity yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_documents_service.py` (stats derive from sidecars)
- Required cases: stats with documents, stats with empty archive, activity fills missing days
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Document Archive](document-archive.md)
- [App Workflows](../app-workflows.md)
