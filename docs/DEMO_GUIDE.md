# Demo Guide

The synthetic invoice generator now works, so you no longer need to hand-make
sample PDFs — the seeded demo dataset is real and reproducible.

## Step 1 — Start the application
Backend: `uvicorn app.main:app --reload` (confirm `GET /health` works).
Frontend: `npm run dev`.
**Say**: "This is running live, not a recording."

## Step 2 — Log in
Log in as **Auditor** (`audit2026`) for the full walkthrough — write actions
(resolving tickets, moving folders, editing invoices) require this role.
**Say**: "Access is role-gated — Auditor sees full technical detail and can
act on findings; MSME sees the same findings translated into plain
language, read-only." Mention this is demo-grade access control, not
production auth, if asked how it works.

## Step 3 — Reset to a clean, real demo dataset
Click "Reset demo data" (wired to `POST /api/dev/reset`).
**Say**: "This regenerates 60 synthetic invoices with real planted
anomalies — duplicates, bad GSTINs, ledger mismatches, tampered PDFs — and
runs every single one through the actual pipeline: real OCR, real risk
scoring, real tickets. Nothing here is canned data." This now takes a few
seconds (PDF generation + full pipeline per invoice) rather than being
instant — say so if the audience is waiting.

## Step 4 — Show the dashboard
Point at the stat cards, risk distribution chart, top risk drivers, and
recent exceptions — all populated from the reset.
**Say**: "ITC-at-risk and MSME-penalty exposure here are computed for
real from the flagged invoices — no longer hardcoded placeholders."
(Note the MSME-penalty figure assumes every invoice is unpaid, since there's
no payment-status field yet — say so if asked how it's derived.)

## Step 5 — Upload one more invoice live
Go to Batch Upload and drop a real or hand-made invoice PDF/image (a clean
one, or a duplicate of something already seeded, works well).
**Say**: "This runs OCR, GSTIN validation, math check, duplicate detection,
vendor-master matching, and ledger matching — then auto-files it into a
folder — all in the few seconds it takes to process."

## Step 6 — Open the invoice
Navigate to its detail page.
**Say**: "Every extracted field has its own confidence score, and you can
now see the actual source document right here" (point at the PDF/image
preview, which now renders for real instead of always being empty).

## Step 7 — Show the evidence
Open a flagged ticket.
**Say**: "This flag isn't a black box — it names the exact prior invoice it
matched and why."

## Step 8 — Show the risk score
**Say**: "70 out of 100 here, High risk — and that number is the sum of
named checks, not a model's opinion."

## Step 9 — Show the exception queue
Navigate to Exception Queue, sorted by risk score. Try the new filters
(minimum risk, minimum confidence, folder, free-text search).
**Say**: "Every flagged invoice becomes a ticket here, prioritized so
reviewers see the highest-risk items first, and now filterable by folder or
confidence too."

## Step 10 — Show ticket resolution
Open the ResolutionForm on a ticket.
**Say**: "Notice this can't be closed without picking a reason and writing a
note — no silent auto-resolve, ever." If logged in as MSME, show that this
action is blocked — a good way to demonstrate the role gate live.

## Step 11 — Show folders
Open Folder view — now backed by real data.
**Say**: "Invoices are auto-sorted by vendor category, with a manual move
option if a reviewer disagrees."

## Step 12 — Show the portfolio report
Open Reports and generate a report.
**Say**: "This is a separate, portfolio-wide pass — vendor activity
anomalies, invoice sequence gaps, Benford's Law deviations, and the ₹
exposure totals, computed across every invoice, not just the one you
uploaded a moment ago." Be explicit that this returns a JSON summary
rendered in-page, not a downloadable PDF, if asked.

## What to skip or caveat in a live demo
- Don't click "vendor correction" or attempt a ticket merge through the
  main invoice-detail merge modal — both call backend routes that don't
  exist and will fail. If asked, say honestly: "those two actions are
  frontend-built ahead of their backend endpoints — that integration work
  isn't done yet."
- If someone asks whether a newly uploaded invoice was checked for vendor
  anomaly, sequence-gap, or Benford deviation, be clear that those three
  only run at the portfolio-report level (Step 12), not on that single
  upload.
