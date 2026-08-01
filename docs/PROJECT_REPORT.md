# Project Report: Invoice Risk Scanner

## 1. Abstract
Invoice Risk Scanner is a full-stack system that screens uploaded invoices
against deterministic financial-control checks — GSTIN validity, internal
math consistency, duplicate detection, vendor-master matching, ledger
matching, and document forensics — and aggregates the results into an
explainable 0–100 risk score, while auto-filing each invoice into a
vendor/category folder. A large language model (Google Gemini) is used
narrowly: to recover low-confidence extracted fields and to write
plain-language explanations of already-computed findings. A separate
on-demand portfolio report adds vendor-anomaly, sequence-gap, and Benford's
Law checks plus ₹ exposure figures (ITC-at-risk, MSME-penalty) across every
invoice in the system. Every flagged invoice becomes a human-reviewable
ticket with a mandatory resolution reason, logged to an append-only audit
trail, behind a demo-grade Auditor/MSME role gate.

## 2. Introduction
Invoice processing at any real volume outgrows manual sampling. This project
explores how far deterministic, explainable checks can go before AI is
needed at all, and where AI adds genuine value once they're exhausted.

## 3. Problem statement
Given a batch of invoice documents, identify which ones carry financial risk
(duplicates, tax-compliance errors, tampering, mismatches, vendor and ledger
inconsistencies) with enough evidence that a human reviewer can act on the
finding quickly, without re-deriving it from scratch.

## 4. Motivation
Existing tools tend to fall into two camps: OCR-only extraction tools that
don't validate anything, or generic AI wrappers that answer questions about
an invoice without any deterministic evidence backing the answer. Neither
gives an auditor something they can defend to a regulator.

## 5. Objectives
1. Extract structured fields from invoice documents with per-field confidence.
2. Validate those fields against deterministic financial-control rules,
   including vendor and ledger cross-checks.
3. Score risk in a way that's traceable back to specific rule violations.
4. Use AI only where deterministic methods are insufficient, and never let
   it make the final call.
5. Route every finding through a human-reviewable, auditable ticket workflow.
6. Surface portfolio-level financial exposure (ITC-at-risk, MSME-penalty)
   alongside per-invoice findings.

## 6. Existing systems (as a category, not named competitors)
Manual review (accurate but doesn't scale); OCR-only invoice tools (extract
text, validate nothing); generic AI chat-based tools (can discuss an
invoice's content but produce no deterministic evidence chain a compliance
process can rely on).

## 7. Proposed system
A pipeline of: ingestion validation → OCR/regex extraction with a scoped AI
fallback → deterministic reconciliation checks (GSTIN, duplicate, vendor,
ledger, forensics) → folder auto-classification → weighted risk scoring →
AI narrative generation → human review and resolution → audit trail, plus an
on-demand portfolio report for anomaly/sequence-gap/Benford checks and ₹
exposure figures. Full detail in `ARCHITECTURE.md`.

## 8. Key features
See `FACT_SHEET.md` for the complete, status-tagged feature list. Live
today: extraction with AI fallback, GSTIN validation, duplicate detection
(exact + fuzzy), vendor-master matching, ledger matching, PDF/image
forensics, folder auto-classification, weighted risk scoring, AI narratives
(auditor + MSME modes), portfolio-level anomaly/sequence-gap/Benford
reporting with ITC-at-risk and MSME-penalty totals, demo-grade role-based
access, and a full ticket/audit-trail workflow, all reflected in a working
React dashboard.

## 9. System architecture
See `ARCHITECTURE.md` for the high-level and detailed diagrams.

## 10. Workflow
See `WORKFLOW.md` for the step-by-step UPLOAD → AUDIT pipeline (plus the
separate on-demand portfolio report) with the exact code responsible for
each step.

## 11. Technology stack
FastAPI, SQLAlchemy, SQLite (with startup auto-migration), Tesseract OCR,
Google Gemini (`gemini-2.0-flash`), rapidfuzz, pikepdf, PyMuPDF, ReportLab
(synthetic invoice generation), React 18, Vite, Tailwind CSS, recharts,
axios. Full detail and honest "listed but unused" callouts in
`FACT_SHEET.md`.

## 12. Module description
See `MODULES.md` for a purpose/input/output breakdown of every module.

## 13. AI integration
See `AI_ARCHITECTURE.md`. In summary: Gemini is used for (a) extraction
fallback on low-confidence critical fields, and (b) narrative generation/
MSME translation of already-computed risk findings. The risk score itself
is always deterministic; AI failures are caught and degrade gracefully to
rule-based text rather than blocking the pipeline. Folder classification is
also deterministic (cache lookup), not AI-driven, despite living in the same
"selective intelligence" story.

## 14. Algorithms
See `ALGORITHMS.md` for every implemented algorithm with purpose, input,
processing, output, complexity, and honest limitations — including the two
places (fuzzy duplicate detection, ticket merge suggestion) where an O(n²)
comparison exists, which of the two already has a real optimization in the
code today, and which checks run per-invoice versus only at the portfolio
level.

## 15. Database design
See `DATABASE_ER.md`. All five tables (`Invoice`, `Ticket`, `Vendor`,
`LedgerEntry`, `Folder`) are now actively written to by live code —
`Vendor`/`LedgerEntry` via the demo-data seed script, `Folder` via the
folder-management API, `Invoice`/`Ticket` on every upload.

## 16. Security
See `SECURITY.md` for what's implemented (file validation, secret handling
via `.env`, ORM-only DB access, demo-grade Auditor/MSME role gate, partial
audit sealing, safe auto-migration) versus what's explicitly not (real
authentication, open CORS, no rate limiting) and the production roadmap to
close those gaps.

## 17. User interface
React frontend with a login page (Auditor/MSME) and eight main pages
(Dashboard, Batch Upload, Exception Queue, Invoice Detail, Reports, Folder
view/detail, Duplicate Comparison), with the Auditor/MSME role threaded
through a shared `AuthContext`, changing which narrative text (technical vs.
plain-language) is shown and which actions are permitted for the same
underlying finding.

## 18. Testing
See `TESTING.md`. No automated test suite exists; a hand-built reconciliation
test-fixture file (`_test_fixtures.py`) with deliberately planted duplicate/
typo-squat/phantom-vendor cases, plus the much larger synthetic-invoice demo
dataset that now runs through the real pipeline via `db/seed.py`, are the
closest things to test assets in the repository today, alongside a manual
verification checklist.

## 19. Demo results
No production or benchmark metrics exist yet — this is a hackathon-stage
prototype, not a system with measured field results. The seeded demo
dataset (60 synthetic invoices with planted anomalies, generated fresh on
every `POST /api/dev/reset`) gives reproducible, on-the-spot numbers for a
live demo. Any "demo results" slide or claim should be built from that
dataset or from invoices actually uploaded during the demo, not invented
numbers. See `DEMO_GUIDE.md`.

## 20. Limitations
Full list in `FACT_SHEET.md`. Highlights: vendor anomaly, sequence-gap, and
Benford's Law checks only run at the portfolio-report level, never on a
single freshly uploaded invoice; MSME-penalty exposure assumes every
invoice is unpaid (no payment-status field exists yet); two frontend calls
(vendor correction, ticket merge via the `/api` adapter) have no matching
backend route; ticket-merge suggestion, misfiled-invoice scanning, and AI
vendor classification are implemented but not wired anywhere; access control
is explicitly demo-grade, not real authentication; OCR engine has a
hardcoded Windows path.

## 21. Future scope
Wire vendor anomaly/sequence-gap/Benford into the per-invoice pipeline (not
just the portfolio report); add a real payment-status field so MSME-penalty
exposure reflects genuinely unpaid invoices; add the missing API routes the
frontend already expects (vendor-correct, ticket-merge under `/api`); wire
`merge_suggester.py`, `misfile_scanner.py`, and `vendor_classifier.py` into
the live app; real PDF/CSV report export; move to Postgres + a task queue
for real batch scale; replace the demo password gate with real
authentication and RBAC; extend audit sealing to tickets.

## 22. Conclusion
The core "deterministic checks first, AI only for the genuinely uncertain
remainder, human decides everything that matters" architecture is real and
working end-to-end for six per-invoice check families (GSTIN, math,
duplicate, vendor-master, ledger, forensics) plus folder classification, and
a further three check families (vendor anomaly, sequence-gap, Benford) at
the portfolio-report level. The remaining unwired modules
(`merge_suggester.py`, `misfile_scanner.py`, `vendor_classifier.py`) are
built to the same pattern and ready to wire in — the gap between prototype
and the fuller vision is integration work, not missing design or missing
algorithms.

## 23. References
- GSTIN checksum algorithm: standard GSTIN mod-36 check-digit specification
  (publicly documented GST format).
- Benford's Law: Newcomb–Benford distribution of leading digits, applied
  here via a standard chi-square goodness-of-fit test.
- Google Gemini API documentation (`google-genai` SDK) for the extraction
  and narrative-generation calls.
