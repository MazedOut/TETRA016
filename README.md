# AI-Powered Invoice Risk Scanner

Hackathon build — FinTech track. AI-powered invoice risk screening for MSMEs and audit teams:
extracts key fields from invoices, reconciles against a purchase ledger and vendor master,
detects duplicates/mismatches/fraud patterns, and surfaces everything through a prioritized,
searchable audit-trail dashboard.

Full project plan, architecture, feature tiers, and build order: see `docs/invoice-risk-scanner-plan.md`
and `docs/Invoice-Risk-Scanner-Full-Plan.docx` (the docx also has a "Handoff Context" section for
picking this project up in a fresh AI chat or a different tool).

## Quick start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # then add your GEMINI_API_KEY
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Synthetic dataset (do this first — everything else depends on it)
```bash
cd backend
python synthetic_data/generate_invoices.py
python synthetic_data/generate_ledger.py
python synthetic_data/generate_vendor_master.py
```

## Architecture

Ingestion → Extraction → Classification → Reconciliation → Scoring → AI layer → Audit trail / Dashboard

Every stage lives in its own folder under `backend/app/`. Full detail in `docs/`.

## Core design principle

Rule → cache → AI, in that order, for every feature. Deterministic checks run first (free,
instant). Cached prior decisions are reused where one exists. AI is called only on what's
genuinely left — and even then, only on flagged items, never the full batch — to keep token
usage low enough to process thousands of invoices, not just a demo handful.

## Team split (suggested — see docs for full hour-by-hour build order)

- **Extraction**: `backend/app/extraction/`, `backend/app/ingestion/`
- **Reconciliation & scoring**: `backend/app/reconciliation/`, `backend/app/scoring/`
- **Dashboard & forms**: `frontend/`, `backend/app/api/`, `backend/app/audit_trail/`
