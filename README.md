# AI-Powered Invoice Risk Scanner

An AI-assisted invoice risk screening layer for MSMEs and audit teams — built to replace slow, sample-based manual auditing with **100% rule-based screening**, backed by AI only where deterministic rules genuinely can't decide.

Built in 36 hours for Tetrathon 2026.

---

## The Problem

Auditors and small-business owners can't manually check every invoice for fraud, duplication, or compliance risk — so most audits only sample a fraction of invoices, and known issues (duplicate billing, phantom vendors, GST mismatches, tax-deadline penalties) slip through. This tool screens **every single invoice**, automatically, and only asks a human to look at the ones that actually need judgment.

## How It Works: Rule → Cache → AI

This is the core design principle behind every part of the system:

1. **Rule** — deterministic checks run first. Free, instant, and explainable (regex, checksums, Pandas comparisons).
2. **Cache** — prior decisions (e.g. a vendor's category) are reused instead of re-computed.
3. **AI** — only called on the genuinely ambiguous remainder: messy OCR fields, plain-language explanations, and ticket-merge suggestions. Never the default path.

Risk Score (fraud likelihood) and Confidence Score (extraction certainty) are tracked as **two separate axes and are never blended** — a low-confidence extraction isn't the same thing as a high-risk invoice.

---

## Features

**Ingestion & Extraction**
- Batch multi-format upload (PDF, PNG, JPG) with instant format/corruption rejection
- Tiered OCR extraction (Tesseract baseline) with per-field confidence scoring
- Gemini Vision fallback, called only for low-confidence critical fields
- Internal math integrity check (taxable value + tax = total)

**Fraud & Compliance Detection**
- Ledger and Vendor Master matching
- Hash-tier exact duplicate detection + fuzzy-tier near-duplicate detection (rapidfuzz)
- Sequence-gap detection (missing invoice numbers within a vendor's numbering)
- GSTIN structural + checksum validation
- Inter-state vs intra-state GST type check (CGST+SGST vs IGST)
- Phantom vendor detection & typo-squatting detection
- PDF metadata tamper scan (Canva/Photoshop signatures) and invisible white-on-white text scan
- Benford's Law first-digit distribution check
- Vendor activity anomaly detection (unusual amounts, off-hours/weekend submissions)

**Scoring & FinTech Logic**
- Weighted 0–100 risk score aggregated across every triggered check
- ITC (Input Tax Credit)-at-risk calculator
- 45-day MSME payment penalty predictor (Section 43B(h))

**Audit Trail & Review**
- Ticket-based exception queue with full status history (open / in-review / resolved / escalated)
- AI-assisted ticket merge suggestions (human must confirm — AI never auto-merges)
- SHA-256 record sealing on every finalized invoice
- Auto-classification/folder sorting by vendor category, with manual correction support
- Auditor mode / MSME plain-language mode toggle

**Dashboard**
- Stats cards (invoices processed, open tickets, ITC at risk, MSME penalty exposure, average confidence)
- Risk distribution chart
- Filterable exception queue
- Side-by-side invoice detail view (original file + extracted fields + flags)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI |
| Data processing | Pandas |
| Database | SQLite (SQLAlchemy ORM) |
| OCR | Tesseract (baseline), PaddleOCR (optional) |
| AI fallback | Google Gemini API |
| Forensics | pikepdf (metadata), PyMuPDF (invisible text) |
| Fuzzy matching | RapidFuzz |
| Synthetic data | ReportLab |
| Frontend | React (Vite) + Tailwind CSS |
| Charts | Recharts |
| PDF preview | react-pdf |
| HTTP client | Axios |

---

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── ai_layer/              # Narrative generator, MSME translator, merge suggester
│   │   ├── api/                   # Route definitions & frontend adapter layer
│   │   ├── audit_trail/           # Ticket manager, hash sealer, history log
│   │   ├── classification/        # Vendor cache, AI classifier, folder sorter, misfile scanner
│   │   ├── db/                    # Database configuration & session setup
│   │   ├── extraction/            # OCR, field parsing, confidence scoring, Gemini fallback
│   │   ├── ingestion/             # File validation, batch handling
│   │   ├── models/                # SQLAlchemy schemas (Invoice, Vendor, Ticket, LedgerEntry)
│   │   ├── reconciliation/        # Duplicate/GSTIN/vendor/ledger/sequence/Benford checks & forensics
│   │   ├── scoring/               # Risk scorer, ITC calculator, MSME penalty
│   │   ├── config.py              # API keys, DB URL, scoring weights/thresholds
│   │   ├── main.py                # FastAPI entrypoint & router registration
│   │   └── orchestrator.py        # Full per-invoice processing pipeline orchestrator
│   │
│   └── synthetic_data/            # Mock data generation scripts
│       ├── generate_invoices.py   # Generates test PDF invoices with planted anomalies
│       ├── generate_ledger.py     # Generates purchase ledger CSV with planted mismatches
│       └── generate_vendor_master.py # Generates the vendor master CSV
│
└── frontend/
    └── src/
        ├── api/
        │   └── client.js          # Centralized Axios client for backend interaction
        ├── components/            # UI components (StatsCards, RiskChart, TicketCard, ResolutionForm)
        └── pages/                 # Main views (Dashboard, UploadBatch, ExceptionQueue, InvoiceDetail, Reports)

---

## Getting Started

### Requirements
- **Python 3.11** (PaddleOCR/paddlepaddle does not yet support newer Python releases — using a newer interpreter will break `pip install`)
- Node.js 18+
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed and available on your system PATH

### Backend

```bash
cd backend
py -3.11 -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env         # then fill in GEMINI_API_KEY
```

Generate the synthetic demo dataset (vendor master, ledger, and test invoice PDFs — all consistent with each other):

```bash
python synthetic_data/generate_vendor_master.py
python synthetic_data/generate_ledger.py
python synthetic_data/generate_invoices.py
python app/db/seed.py
```

Run the API:

```bash
uvicorn app.main:app --reload
```

The API is now live at `http://127.0.0.1:8000` (interactive docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api` requests to the FastAPI backend (see `vite.config.js`).

---

## Known Limitations

- **PaddleOCR/paddlepaddle requires Python 3.11 or 3.12.** If your system Python is newer, create the virtual environment with an explicitly older interpreter (see above) rather than the default.
- **Gemini API fallback depends on a valid, quota-enabled API key.** Without it, extraction still works via Tesseract alone, but low-confidence fields won't get an AI-assisted second pass, and AI-generated narratives/merge suggestions will fall back to raw rule output instead.
- **MSME 45-day penalty calculation currently assumes all invoices are unpaid** past their invoice date, since no live accounts-payable/payment-status feed is wired in yet. Replace this assumption once a real payment data source is connected.

---

## Team Phishers

Built by a 3-person team across three areas :-

- **Ananya Yadav**-**Frontend, UX & Synthetic Data** : React dashboard, human-in-the-loop review UI, synthetic test data
- **Jaivin Vachhani**-**Core Data Engine, Reconciliation & Logic** : classification, fraud/compliance rules, risk scoring, metadata analysis
- **Yash Jadhav**-**Backend, AI Pipeline & Forensics** : ingestion, OCR/Gemini extraction, forensics, AI narrative layer
