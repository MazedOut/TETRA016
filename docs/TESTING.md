# Testing

## What exists
`backend/app/reconciliation/_test_fixtures.py` — a hand-built set of mock
"extracted invoice" dicts (`MOCK_INVOICES`) specifically designed to exercise
the reconciliation modules before the extraction pipeline existed. It
includes deliberately planted cases:
- An exact duplicate pair (`INV-101` repeated identically)
- A near-duplicate pair (`INV-2214` vs `INV-22l4` — the "1 vs l" case)
- A clean, unrelated invoice that should **not** be flagged
- A typo-squat vendor name ("Sharrma Traders" vs "Sharma Traders", different GSTIN)
- A phantom vendor with no close match at all

This is genuinely useful as a manual/unit test fixture for
`duplicate_detector.py` and `vendor_matcher.py`, and is honest test data —
not invented for this documentation. It remains a standalone fixtures file,
not part of an automated suite.

A second, much larger source of "real-ish" test data now exists:
`backend/synthetic_data/generate_invoices.py` produces 50–60 PDF invoices
with ten categories of planted anomalies (exact/near duplicates, invalid
GSTIN, sequence gap, ledger mismatches, tampered metadata, vendor activity
spike, overdue MSME case, math error, typo-squat vendor), and `db/seed.py`
runs every one of them through the real orchestrator end to end. This is a
much stronger de facto regression check than `_test_fixtures.py` — if a
change breaks extraction, scoring, or ticket creation, running the seed
script will surface it via failed/rejected counts and an obviously wrong
risk distribution — but it is still not an automated `assert`-based test.

## What does not exist
- No automated test suite (no `pytest` files, no `tests/` directory, no CI
  configuration found anywhere in the repository).
- No frontend tests (no Jest/Vitest/React Testing Library setup).
- No integration test that runs a real file through the full
  upload → extraction → scoring → ticket pipeline automatically and asserts
  on the result — `db/seed.py` exercises this path but only prints a summary,
  it doesn't assert anything.

## How to verify the system manually today
1. `uvicorn app.main:app --reload` and confirm `GET /health` returns
   `{"status": "ok"}`.
2. Call `POST /api/dev/reset` (or run `python -m app.db.seed` from
   `backend/`) and confirm it reports 60 invoices seeded with a plausible
   risk distribution and non-zero ticket count.
3. Upload a small, clean invoice PDF via `POST /upload/` or the frontend —
   confirm it produces a `low` risk score and no tickets.
4. Upload the same file twice — confirm the second upload produces a
   `duplicate_invoice` flag and a ticket (exercises the live hash-tier
   duplicate detector against real DB rows, not just the mock fixtures).
5. Manually edit a GSTIN in a test invoice to break its checksum — confirm
   an `invalid_gstin` flag appears.
6. Open the Reports page and confirm `GET /api/reports/portfolio` returns
   non-zero `itc_at_risk_inr` / `msme_penalty_exposure_inr` once at least a
   few high-risk / overdue invoices exist — these were hardcoded `0` in
   earlier builds and are now computed for real.
7. Resolve a ticket via the API or UI and confirm `Ticket.history` grows by
   one entry rather than being replaced.
8. Log in as MSME and confirm a write action (e.g. resolving a ticket) is
   rejected with `403` — then log in as Auditor and confirm the same action
   succeeds, to sanity-check the `X-Role` gate.

## Recommended next step (roadmap, not current)
Wrap the `_test_fixtures.py` data into real `pytest` unit tests for each
reconciliation module, add one integration test that posts a real PDF to
`/upload/` and asserts on the resulting risk score and ticket count, and add
a regression test that runs `db/seed.py` and asserts the summary counts
(invoices, tickets, failures) match expected values rather than only
printing them for a human to eyeball.
