# Module Documentation

### Ingestion (`backend/app/ingestion/`)
**Purpose**: Reject bad uploads before any OCR/AI cost is spent.
**Input**: `(filename, raw_bytes)` tuples from a batch upload.
**Output**: `{processed: [...], rejected: [...], total: n}` — `batch_handler.process_batch()`
also runs extraction + forensics on every accepted file before returning.

### Extraction (`backend/app/extraction/`)
**Purpose**: Turn a raw invoice image/PDF into structured fields with
confidence scores, using AI only where OCR is uncertain.
**Input**: `(filename, bytes)`.
**Output**: `{fields, field_confidence, avg_conf, ocr_source, math_ok, math_reason, needs_review, flagged_for_review}` — `extraction/pipeline.py`'s `extract_invoice()`.

### Classification (`backend/app/classification/`)
**Purpose**: Auto-sort invoices into vendor/category folders, with a cache
to avoid repeat AI classification calls for a vendor already seen.
**Live**: `folder_sorter.sort_invoice()` / `sort_batch()`, backed by
`vendor_cache.VendorCache` — called directly from `orchestrator.py` on every
upload, and surfaced via the `/api/folders*` routes.
**Built-not-wired**: `misfile_scanner.py` (flags an invoice whose current
folder no longer matches what `folder_sorter` would assign it today),
`vendor_classifier.py` (would use AI to assign a first-time category to an
unrecognized vendor instead of always filing it under `extra`).

### Reconciliation (`backend/app/reconciliation/`)
**Purpose**: Deterministic checks that produce risk flags.
**Live, per-invoice** (called from `orchestrator.py` on every upload):
GSTIN validity/tax-type, duplicate detection, vendor-master matching,
ledger matching + mismatch checks, PDF/image forensics.
**Live, portfolio-level only** (called from `portfolio_analyzer.py`, which
runs from `GET /api/reports/portfolio` and `POST /api/reports/generate`):
vendor amount/off-hours anomaly, sequence-gap, Benford's Law, cross-invoice
duplicate clustering.
**Output shape (all checks)**: list of `{check: str, reason: str, ...}` dicts.

### Scoring (`backend/app/scoring/`)
**Purpose**: Aggregate flags into one explainable number, and turn flagged
invoices into ₹ exposure figures.
**Live, per-invoice**: `risk_scorer.score_invoice(flags)` →
`{risk_score, risk_level, contributing_checks}`.
**Live, portfolio-level**: `itc_calculator.calculate_itc_at_risk()`,
`msme_penalty.check_msme_penalty()` / `calculate_batch_penalties()` — called
from `portfolio_analyzer.py` and also directly from `GET /api/stats` and
`GET /api/invoices/{id}` for single-invoice/aggregate exposure figures.

### AI Layer (`backend/app/ai_layer/`)
**Purpose**: Explain, translate, and (unwired) suggest — never decide.
**Live**: `narrative_generator.generate_narratives()`,
`msme_translator.translate_for_msme()` — both called from
`orchestrator.py` on every flagged invoice.
**Built-not-wired**: `merge_suggester.suggest_merges()` — no route or UI
action calls this; ticket merging is a manual action today.
**Inputs**: an already-scored invoice/ticket dict.
**Outputs**: the same dict, with narrative/summary text fields added.

### Audit Trail (`backend/app/audit_trail/`)
**Purpose**: Make every ticket action reviewable and every finalized invoice
tamper-evident.
**Events**: `created`, `status_changed:{old}->{new}`, `marked_false_positive`,
`merged_into:{target_id}` — each appended to `Ticket.history` via
`history_log.append_history()`.
**Output**: `hash_sealer.seal()` returns a SHA-256 hex digest stored on
`Invoice.record_hash`; `verify()` recomputes and compares.

### Database (`backend/app/db/`)
**Purpose**: Own the SQLAlchemy engine/session, keep the live schema in
sync with the models, and populate the demo dataset.
**`database.py`**: `Base`, `engine`, `SessionLocal`, `get_db()`, and
`auto_migrate()` — inspects the live SQLite schema against every registered
model and adds any missing column via `ALTER TABLE`, skipping (with a
logged warning) any addition that would be unsafe on a non-empty table.
Called on every app startup after `Base.metadata.create_all(engine)`.
**`seed.py`**: `seed()` wipes and recreates all tables, calls the synthetic
generators to produce fresh invoice PDFs + vendor master + ledger CSVs,
loads the vendor/ledger CSVs into the `Vendor`/`LedgerEntry` tables, and
runs every generated invoice through the real `orchestrator.process_invoice()`
— so the seeded demo data has genuinely-computed risk scores and tickets,
not canned values. Exposed via `POST /api/dev/reset`.

### Frontend (`frontend/src/`)
**Pages**: Dashboard (stats + risk chart + top risk drivers + recent
exceptions), UploadBatch (drag-drop + Skip/Retry/Review), ExceptionQueue
(risk-sorted, filterable by status/risk/confidence/search/folder),
InvoiceDetail (extracted fields + flags side-by-side, now with a real PDF/
image preview served from `GET /api/invoices/{id}/file`), Reports
(date-range + risk-threshold + exception-type form, now backed by
`POST /api/reports/generate` — returns JSON, not a downloadable file),
FolderDetail (list of invoices in a folder, backed by
`GET /api/folders/{name}/invoices`), DuplicateComparison (side-by-side
comparison for a flagged duplicate pair), LoginPage (Auditor/MSME role
selection with a client-side password check).
**Components**: StatsCards, RiskChart (recharts bar chart), TicketCard
(risk-stamp + confidence bar, mode-aware narrative), RiskConfidenceFilter
(dual independent sliders — deliberately not one blended slider),
FolderView (now backed by real `/api/folders` data), ResolutionForm
(mandatory reason), MergeConfirmModal (editable AI reason — **still calls a
route, `POST /api/tickets/merge`, that doesn't match the real backend
path**), VendorCorrectionForm (**still calls `POST /api/vendors/correct`,
which doesn't exist**).
**Context**: `AuthContext.jsx` — Auditor/MSME login, sets the `X-Role`
header on every subsequent request via `setClientRole()` in `client.js`.
**User workflow**: log in → upload (or reset to demo data) → review
exception queue → open invoice (with a real file preview) → resolve with
reason → optionally run a portfolio report — all reflected live against the
real backend except the two calls noted above (vendor correction and ticket
merge via the `/api` adapter), which will 404.
