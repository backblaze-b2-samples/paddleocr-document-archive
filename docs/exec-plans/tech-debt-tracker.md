<!-- last_verified: 2026-03-10 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

| Description | Impact | Proposed Resolution | Priority | Status |
|---|---|---|---|---|
| `datetime.utcnow()` deprecated in Python 3.12+ | Naive datetimes, future breakage | Replace with `datetime.now(UTC)` in `repo/b2_client.py`, `service/metadata.py` | High | Resolved |
| S3 client recreated on every API call | Connection pool wasted, added latency | Cache client as module-level singleton via `lru_cache` | High | Resolved |
| `get_upload_stats()` pagination broken at 1000 objects | Stats silently wrong for large buckets | Check `IsTruncated` + use `ContinuationToken` | High | Resolved |
| `record_upload()` never called | `/metrics` always reports 0 uploads | Call from `runtime/upload.py` after successful upload | Medium | Resolved |
| Metrics counters not thread-safe | Race conditions under concurrent requests | Use `threading.Lock` (matches `service/files.py` pattern) | Medium | Resolved |
| `_humanize_bytes` duplicated in Python (repo + service) | DRY violation, drift risk | Extract to `app/types/formatting.py` shared util | Medium | Resolved |
| `humanizeBytes` duplicated in TypeScript | DRY violation | Extract to `lib/utils.ts` | Low | Open |
| `formatDate` duplicated in TypeScript | DRY violation | Extract to `lib/utils.ts` | Low | Open |
| No test harness for feature specs | No automated verification | Add pytest fixtures + test files per feature | Medium | Resolved (partial — tests added for upload, files, activity, errors) |

## 2026-07-06 — verify (OCR upload → run → search flow)

Nitpicks surfaced by the 3-lens UX verify funnel. The core flow PASSED; the round's blocker/friction findings (upload had no forward CTA, OCR run showed no distinct in-progress status, non-English language selection trapped the doc) were fixed this round. These are backlog-only — do not loop on them:

- `/upload` (Ingest) — the OCR-config card sits *above* the dropzone while dropping a file only ingests it as *pending* → the layout suggests dropping runs OCR. Mitigated by a prominent "View in Archive" CTA + "run OCR from the Archive" copy (gate demoted this from friction to nitpick). Consider reordering the config below the dropzone, or an "Upload & run OCR" convenience. (.local/verify/A2/04-post-upload-cta.png)
- `/archive` (search) — a "Search results" panel appears above the table but the full table below stays unfiltered → a first-time user may wonder why the list "didn't filter"; also confirm search returns every matching processed doc, not only the top match. (.local/verify/A2/09-search-peterson.png)
- `/archive` (OCR in progress) — the "Processing" badge + spinner has no live progress bar / stage %; fine at the observed ~8.5s run, but the Ingest copy states OCR "runs ~5-60s", so a longer run would show a static badge past 10s and could read as frozen → add a progress/stage indicator for long runs. (.local/verify/B2/B-05-ocr-inprogress.png)
- `/archive` (reload during OCR) — the "Processing" state is client-only (`runMutation.isPending`), not persisted; a mid-op reload of a long run shows "Pending" while work continues server-side → the user could re-click Run OCR. Consider a persisted processing status. (.local/verify/B2/B-08-after-reload.png)
- `/archive/[docId]` (detail) — the angle-classification sub-stage has no dedicated in-app evidence surface (text detection + recognition each do). Traceability only — the stage is not skipped. (.local/verify/C2/08-detail-full.png)
