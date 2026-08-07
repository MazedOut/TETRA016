# Invoice Risk Scanner — Project Fact Sheet

This is the internal ground truth. Every other document in this package is
written to match what's stated here — not the other way around. It was
produced by reading the actual repository (`backend/app/`, `frontend/src/`),
not the plan docs in `docs/`.

## Project name
Invoice Risk Scanner (AI-Assisted Invoice Risk Scanner)

## Problem
Businesses process invoices manually or with basic OCR tools. Neither catches
duplicate invoices, GSTIN errors, ledger mismatches, or vendor anomalies
reliably at volume — and by the time a human auditor samples a batch, the
company may have already paid a duplicate or claimed input tax credit (ITC)
against a defective invoice.

## Target users
Accounting/AP teams, internal and external auditors, MSMEs handling their own
books, and tax/compliance teams who need evidence before flagging or paying
an invoice.

## Solution (as actually built)
Upload invoice PDFs/images → OCR + regex field extraction → deterministic
per-invoice validation (GSTIN checksum, math check, duplicate detection, PDF/
image forensics, vendor-master matching, ledger matching) → auto-classification
into vendor/category folders → weighted risk scoring → selective AI narrative
generation → human-reviewed exception tickets with an append-only audit
trail. A separate portfolio-level pass (run on demand from the Reports page)
adds vendor anomaly detection, sequence-gap detection, Benford's Law, ITC-at-
risk, and MSME-penalty exposure across the whole invoice set.

## Core features — status legend
- 🟢 **Live**: implemented and wired into the running upload → API → frontend path
- 🟡 **Implemented, not wired**: real, working code exists as a module, but no route or orchestrator step calls it yet, so it does not affect a live invoice today
- 🔴 **Stub**: file exists with a docstring/signature but raises `NotImplementedError` or is otherwise non-functional

| Feature | Status |
|---|---|
| Batch upload (PDF/PNG/JPG), file-format + size validation | 🟢 Live |
| OCR extraction (Tesseract) + regex field parsing | 🟢 Live |
| Per-field confidence scoring | 🟢 Live |
| Gemini vision fallback for low-confidence critical fields | 🟢 Live |
| Internal math check (taxable + tax == total) | 🟢 Live |
| GSTIN structural regex + official mod-36 checksum validation | 🟢 Live |
| Inter/intra-state CGST+SGST vs IGST tax-type check | 🟢 Live |
| Exact duplicate detection (SHA-256 normalized-key hash) | 🟢 Live |
| Fuzzy near-duplicate detection (rapidfuzz, same-vendor + similar-amount scoped) | 🟢 Live |
| PDF metadata tamper scan (pikepdf: Producer/Creator tag check) | 🟢 Live |
| Invisible-text scan (PyMuPDF: white-on-white span detection) | 🟢 Live |
| Image EXIF software-tag tamper scan | 🟢 Live |
| Per-invoice vendor-master matching (phantom vendor / typo-squat detection) | 🟢 Live |
| Per-invoice ledger matching + amount/date mismatch checks | 🟢 Live |
| Auto-classification / folder sorting by cached vendor category, with `needs review` / `extra` fallback buckets | 🟢 Live |
| Folder CRUD + move-invoice-to-folder API, wired to a real `folders` table | 🟢 Live |
| Weighted 0–100 risk scoring with Low/Medium/High level | 🟢 Live |
| AI-generated plain-language exception narratives (Gemini, batched per invoice) | 🟢 Live |
| MSME-mode plain-language narrative translation (AI, with a hardcoded per-check fallback map if AI fails) | 🟢 Live |
| Ticket audit trail: open/in-review/resolved/escalated + append-only history log | 🟢 Live |
| SHA-256 record sealing on finalized invoices | 🟢 Live |
| Dashboard stats (processed count, open tickets, avg. confidence, risk distribution) | 🟢 Live |
| Portfolio-level analysis: vendor anomaly (z-score + off-hours), sequence-gap, Benford's Law, cross-invoice duplicate clustering | 🟢 Live (`/api/reports/portfolio`, `/api/reports/generate`) |
| ITC-at-risk ₹ calculator | 🟢 Live (portfolio/report endpoints; not yet a dashboard card) |
| 45-day MSME Section 43B(h) penalty calculator | 🟢 Live (portfolio/report endpoints; `is_paid` defaults to `False` for every invoice, so exposure is currently an upper bound, not a true unpaid-only figure) |
| Report generation (portfolio summary + filtered flagged-invoice list, JSON) | 🟢 Live — **not a PDF/file export**, despite `weasyprint`/`reportlab` in requirements; the frontend renders the JSON, `url` is always `null` |
| Demo-grade role-based access (Auditor / MSME login, `X-Role` header gate on write endpoints) | 🟢 Live |
| Auto-migration on startup (adds new model columns to the live SQLite file without dropping data) | 🟢 Live |
| Synthetic invoice PDF generator (ReportLab, 10 planted anomaly scenarios) | 🟢 Live |
| Automated demo-data DB seeding (`db/seed.py`, runs every generated invoice through the real pipeline) | 🟢 Live |
| Dev "reset demo data" endpoint (`POST /api/dev/reset`, reseeds 60 invoices) | 🟢 Live |
| React frontend: Dashboard, Batch Upload, Exception Queue, Invoice Detail, Reports, Folder view/detail, Duplicate comparison | 🟢 Live |
| AI-assisted ticket merge suggestion (fuzzy vendor name + shared-check overlap) | 🟡 Implemented, not wired — no route calls `merge_suggester.py`; ticket merging in the UI is a plain manual action |
| Misfiled-invoice scanner (flags invoices sitting in a folder that doesn't match their classified category) | 🟡 Implemented, not wired — no route or pipeline step calls `misfile_scanner.py` |
| Standalone AI vendor classifier (`vendor_classifier.py`) | 🟡 Implemented, not wired — folder sorting only reads the cache (`vendor_cache.py`); nothing currently calls the AI classifier to populate new categories, so unseen vendors fall into `extra` until someone/something seeds the cache |
| `/invoices` REST router (`routes_invoices.py`) | 🔴 Stub — file exists, returns a placeholder message, and is **not mounted** in `main.py` |
| Vendor/ticket-merge frontend calls with no backend route (`POST /api/vendors/correct`, `POST /api/tickets/merge`) | 🔴 Frontend (`client.js`) calls these; `routes_frontend_adapter.py` has no matching endpoints — both will 404 against the real backend |

## Technology stack (as used, not as listed)

- **Frontend**: React 18 + Vite, Tailwind CSS, `react-router-dom`, `axios`, `recharts` (risk distribution chart), `react-pdf` (invoice preview, now served from `GET /api/invoices/{id}/file`)
- **Backend**: FastAPI, Uvicorn
- **Database**: SQLite by default (`DATABASE_URL` env var swaps to Postgres — untested in this repo); `auto_migrate()` adds new columns on every startup without dropping data
- **ORM**: SQLAlchemy
- **OCR**: Tesseract via `pytesseract` + PyMuPDF (`fitz`) for PDF→image rendering. `paddleocr`/`paddlepaddle` remain listed in `requirements.txt` but are **still not imported or used anywhere in the code**.
- **AI model**: Google Gemini (`gemini-2.0-flash` in `gemini_fallback.py`) via the `google-genai` SDK — used for (1) low-confidence field extraction fallback, (2) exception narrative generation, (3) MSME-mode translation
- **Fuzzy matching**: `rapidfuzz`
- **PDF/image forensics**: `pikepdf`, PyMuPDF, Pillow (EXIF)
- **Hashing**: Python `hashlib` (SHA-256)
- **Synthetic data**: `reportlab` (invoice PDF generation, now implemented), plain CSV writers for vendor master + ledger
- **Config/secrets**: `python-dotenv`, `.env` (gitignored), `.env.example` committed
- **Listed but unused in current code**: `paddleocr`, `paddlepaddle`, `pdf2image`, `weasyprint` (report "generation" returns JSON, not a rendered file)

## Algorithms (all confirmed present and wired in code)
GSTIN mod-36 checksum validation · SHA-256 exact duplicate hashing · rapidfuzz
fuzzy duplicate matching (scoped) · weighted linear risk aggregation ·
PDF metadata tamper detection · invisible-text span detection · EXIF tamper
detection · rapidfuzz vendor-master matching (phantom/typo-squat) · ledger
row matching + amount/date mismatch checks · z-score vendor amount anomaly +
off-hours timing detection · per-vendor sequence-gap detection · chi-square
Benford's Law deviation · ITC-at-risk and MSME 43B(h) penalty aggregation.

**Still built but not called anywhere**: fuzzy ticket-merge suggestion
(`merge_suggester.py`), misfiled-invoice detection (`misfile_scanner.py`),
standalone AI vendor classification (`vendor_classifier.py`).

## Security — implemented vs. not
**Implemented**: file-type allowlist (pdf/png/jpg/jpeg) and 15MB size cap on
upload; `.env`-based secret handling with `.env.example` committed instead of
real keys; SQL injection is not a practical risk because all DB access goes
through SQLAlchemy's ORM query builder (`auto_migrate`'s DDL statements use
inspector-derived table/column names, not user input); demo-grade RBAC —
write endpoints (`folders`, ticket resolve/bulk-resolve, invoice
patch/correct, invoice move) require an `X-Role: auditor` header, set by the
frontend after a client-side password check against a hardcoded
`{auditor, msme}` password map.

**Not implemented** (do not claim these): the RBAC is explicitly
non-cryptographic — any caller can set `X-Role: auditor` themselves and
bypass it, and passwords live in frontend source, not a real auth system;
CORS is wide open (`allow_origins=["*"]`, explicitly flagged in the code
comment itself as needing tightening); no rate limiting; no filename
sanitization beyond extension-checking; no audit-log tamper protection
beyond the per-invoice SHA-256 seal (tickets themselves aren't sealed); no
HTTPS/TLS configuration in this repo.

## Current limitations (say these out loud to judges, don't wait to be asked)
1. Vendor anomaly detection, sequence-gap, and Benford's Law only run at the
   **portfolio level** (Reports page), not per-invoice at upload time — a
   newly uploaded invoice never gets flagged for these on its own ticket,
   only when someone runs a portfolio report afterward.
2. MSME-penalty exposure in the portfolio/report endpoints treats every
   invoice as unpaid (`is_paid` is hardcoded `False` in
   `portfolio_analyzer.py`), so the ₹ figure is a worst-case exposure, not a
   true "actually overdue" number — there is no payment-status field or UI
   to mark an invoice paid.
3. `POST /api/vendors/correct` and `POST /api/tickets/merge` are called by
   `frontend/src/api/client.js` but have no matching route in
   `routes_frontend_adapter.py` — both will fail against the real backend as
   currently deployed.
4. `ocr_engine.py` still hardcodes a Windows Tesseract path
   (`C:\Program Files\Tesseract-OCR\tesseract.exe`), so OCR will fail out of
   the box on macOS/Linux without editing that line or removing it so
   `pytesseract` finds Tesseract on `PATH`.
5. "Report generation" is JSON only — despite `weasyprint`/`reportlab` in
   `requirements.txt`, `routes_reports.py` never renders a file; the
   response always has `"url": null` and the frontend displays the JSON
   in-page.
6. Access control is demo-grade only (see Security section) — fine for a
   hackathon demo, not for production.
7. `misfile_scanner.py`, `vendor_classifier.py`, and `merge_suggester.py` are
   real, working modules that nothing in the app currently calls.
8. Duplicate detection's fuzzy tier is O(n²) over invoices not already caught
   by the exact-hash tier (see `ALGORITHMS.md` for the honest complexity
   discussion and how it's already partially mitigated).

## Future scope (explicitly not built — say "roadmap," never "current")
Wiring vendor anomaly/sequence-gap/Benford checks into the per-invoice
orchestrator (not just the portfolio report); a true payment-status field so
MSME-penalty exposure reflects real unpaid invoices; ITC/MSME-penalty
dashboard cards (currently only in the Reports JSON); real PDF/CSV report
export; wiring `merge_suggester.py`, `misfile_scanner.py`, and
`vendor_classifier.py` into the live app; a real authentication system to
replace the demo password gate; mounting `/invoices`; ERP integrations;
Postgres + Celery/Redis for real batch scale.

## Core differentiator (one sentence)
Unlike plain OCR-invoice tools, simple duplicate checkers, or a generic
AI-chatbot wrapper, this system runs cheap deterministic financial checks
first, calls an LLM only for the narrow slice of extraction/explanation work
that genuinely needs it, and never lets the model close a ticket — every
resolution, merge, or correction requires a human action that's written to an
append-only audit log.

**Only claim this for the checks that are actually wired**: GSTIN
validation, math check, duplicate detection, PDF/image forensics, vendor-
master matching, and ledger matching all run this way on every uploaded
invoice today. Vendor anomaly, sequence-gap, and Benford's Law run the
identical pattern but only at the portfolio-report level, not per-invoice —
say so.
