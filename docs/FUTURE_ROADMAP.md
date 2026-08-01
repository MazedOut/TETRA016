# Future Roadmap

## Near-term (highest leverage — logic already written)
1. Wire `vendor_anomaly.py`, `sequence_gap.py`, and `benford_check.py` into
   the **per-invoice** path in `orchestrator.py`, not just the portfolio
   report — the check logic is already implemented and already runs on
   demand; the remaining work is deciding how to score a single upload
   against a vendor's historical pattern in real time.
2. Add a real payment-status field (`is_paid`, `payment_date`) to `Invoice`
   so `msme_penalty.py`'s batch calculation reflects genuinely unpaid
   invoices instead of assuming every invoice is unpaid.
3. Implement `/api/tickets/merge` (matching the frontend's expected path)
   and `/api/vendors/correct` — the frontend already calls both; only the
   backend is missing.
4. Wire `ai_layer/merge_suggester.py` into the ticket UI's merge flow.
5. Wire `classification/misfile_scanner.py` (flag drift between an
   invoice's folder and its re-computed classification) and
   `classification/vendor_classifier.py` (auto-assign new vendor categories
   via AI instead of always filing unknowns under `extra`).
6. Fix the hardcoded Windows Tesseract path in `ocr_engine.py` for
   cross-platform development.

## Mid-term
- Real PDF/CSV export for `POST /api/reports/generate` — today it returns
  JSON only, despite `reportlab`/`weasyprint` sitting in `requirements.txt`.
- Add a `pytest` suite building on the existing `_test_fixtures.py` data and
  the now-working synthetic invoice generator (which already gives a
  reproducible, assertable dataset via `db/seed.py`).
- Extend SHA-256 sealing (`hash_sealer.py`) to `Ticket` rows, not just `Invoice`.
- Replace the client-side password check + `X-Role` header with real
  authentication (OAuth2/JWT) and server-verified role-based access control.
- Apply the same role gate to `routes_tickets.py` that
  `routes_frontend_adapter.py` already has, so there's no un-gated back door.
- Mount `routes_invoices.py` or retire it — right now it's dead code.

## Production scale
- Postgres instead of SQLite (`DATABASE_URL` already supports the swap;
  `auto_migrate()` would need a Postgres-aware DDL path since its current
  type mapping targets SQLite).
- Celery/Redis (or similar) task queue so uploads don't block the API thread
  during OCR/AI calls.
- Restrict CORS to known origins; add rate limiting.
- ERP integrations for invoice ingestion and ledger sync (replacing the
  CSV/seed-script path to `Vendor`/`LedgerEntry`).
- Continuous, cross-session vendor trust scoring (currently, vendor anomaly
  detection only looks across whatever invoices exist in the DB at report
  time — there's no longer-term trust score stored per vendor).

## Explicitly not committed to a timeline
Everything above is roadmap, not a promised release date. State it that way
to judges — "this is what the architecture is ready for," not "this ships
next sprint."
