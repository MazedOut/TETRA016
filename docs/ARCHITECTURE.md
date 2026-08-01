# Architecture

Two views: what a judge should see (high-level), and what's actually true in
the code (detailed, with wired vs. not-wired called out explicitly).

## 1. High-level architecture

```mermaid
flowchart TD
    A["Invoice Sources<br/>PDF / PNG / JPG, batch upload"] --> B["Ingestion Layer<br/>file_validator + content_sniff"]
    B --> C["Extraction / OCR<br/>Tesseract + regex field parser"]
    C --> D["Confidence Scoring<br/>+ Gemini fallback on low-confidence critical fields"]
    D --> E["Per-Invoice Validation Layer"]
    subgraph E["Per-Invoice Validation Layer (live, runs on every upload)"]
        E1["GSTIN checksum + tax-type check"]
        E2["Internal math check"]
        E3["Duplicate detection (hash + fuzzy)"]
        E4["Vendor-master matching (phantom / typo-squat)"]
        E5["Ledger matching + mismatch checks"]
        E6["PDF/image forensics (metadata + invisible text)"]
    end
    E --> F2["Folder Auto-Classification"]
    F2 --> F["Risk Engine<br/>weighted 0-100 score + Low/Med/High"]
    F --> G["Selective AI Layer<br/>Gemini narrative + MSME translation"]
    G --> H["Human Review / Exception Tickets"]
    H --> I["Audit Trail<br/>append-only history + SHA-256 record seal"]
    I --> J["Dashboard / Frontend"]
    J -.->|on demand| K["Portfolio Report<br/>vendor anomaly, sequence-gap, Benford, ITC-at-risk, MSME-penalty"]
```

**Not pictured because not wired today**: ticket-merge suggestion
(`merge_suggester.py`), misfiled-invoice scanning (`misfile_scanner.py`), and
standalone AI vendor classification (`vendor_classifier.py`) all exist as
real modules under `backend/app/ai_layer/` and `backend/app/classification/`,
but nothing in the app calls them yet. See `FACT_SHEET.md` for the complete
wired/unwired table.

## 2. Detailed technical architecture

```mermaid
flowchart TD
    subgraph Frontend["frontend/ (React + Vite + Tailwind)"]
        FE0["LoginPage.jsx (Auditor / MSME, client-side password check)"]
        FE1[Dashboard.jsx]
        FE2[UploadBatch.jsx]
        FE3[ExceptionQueue.jsx]
        FE4[InvoiceDetail.jsx]
        FE5[Reports.jsx]
        FE6["FolderView.jsx / FolderDetail.jsx"]
        FE7[DuplicateComparison.jsx]
        FEC["api/client.js — axios, USE_MOCK=false, sends X-Role header"]
    end

    subgraph API["backend/app/api/ (FastAPI routers)"]
        R1["routes_upload.py → POST /upload/"]
        R2["routes_tickets.py → /tickets/*"]
        R3["routes_dashboard.py → /dashboard/stats"]
        R4["routes_frontend_adapter.py → /api/* (mounted, matches frontend shape; write routes gated by X-Role: auditor)"]
        R6["routes_reports.py → /api/reports/portfolio, /api/reports/generate (mounted)"]
        R5["routes_invoices.py — NOT mounted in main.py"]
    end

    subgraph Pipeline["backend/app/ pipeline modules"]
        P1["ingestion/ — file_validator, content_sniff, batch_handler"]
        P2["extraction/ — ocr_engine, field_parser, confidence_scorer, gemini_fallback, math_check, pipeline.py"]
        P3["reconciliation/ (per-invoice, wired) — gstin_validator, duplicate_detector, forensics, vendor_matcher, ledger_matcher, mismatch_checks"]
        P3b["reconciliation/ (portfolio-only, wired via portfolio_analyzer.py) — vendor_anomaly, sequence_gap, benford_check"]
        P4["scoring/ — risk_scorer (per-invoice, wired) · itc_calculator, msme_penalty (portfolio-only, wired via portfolio_analyzer.py)"]
        P5["ai_layer/ — narrative_generator, msme_translator (wired) · merge_suggester (NOT wired)"]
        P6["audit_trail/ — ticket_manager, history_log, hash_sealer"]
        P7["classification/ — folder_sorter, vendor_cache (wired) · misfile_scanner, vendor_classifier (NOT wired, no route)"]
        ORCH["orchestrator.py — process_invoice(): calls extraction, gstin_validator, duplicate_detector, vendor_matcher, ledger_matcher, mismatch_checks, folder_sorter, risk_scorer, narrative_generator, msme_translator, ticket_manager, hash_sealer"]
    end

    subgraph DB["SQLite via SQLAlchemy (auto_migrate() adds new columns on startup)"]
        M1[(Invoice)]
        M2[(Ticket)]
        M3[(Vendor)]
        M4[(LedgerEntry)]
        M5[(Folder)]
    end

    FEC -->|HTTP /api proxy| R4
    FEC -->|HTTP /api/reports proxy| R6
    R1 --> P1 --> P2 --> ORCH
    R4 --> P1
    R4 --> ORCH
    ORCH --> P3
    ORCH --> P7
    ORCH --> P4
    ORCH --> P5
    ORCH --> P6
    ORCH --> M1
    P6 --> M2
    R2 --> P6
    R3 --> M1
    R3 --> M2
    R6 --> P3b
    R6 --> P4
    P3b --> M1
```

### Why this shape
- **Ingestion before extraction**: rejects bad files (wrong type, empty,
  oversized, no extractable text) before spending any OCR or AI budget on
  them — cheapest checks run first.
- **Extraction before validation**: nothing can be checked for GSTIN
  correctness or duplication until fields exist.
- **Deterministic checks before AI**: GSTIN checksum, math, duplicate
  detection, vendor-master matching, ledger matching, and forensics are pure
  computation — free, instant, and authoritative. The risk score is built
  entirely from their output.
- **Classification alongside validation**: `folder_sorter.py` runs in the
  same per-invoice pass, using a cached vendor→category map
  (`vendor_cache.py`) so it never has to call an AI model to file a known
  vendor's invoice.
- **AI only after scoring**: Gemini is called to *narrate* an
  already-computed risk result, not to decide the score itself. If Gemini
  fails, `narrative_generator.py` catches the exception and falls back to
  the raw rule reason string, and `routes_frontend_adapter.py` has its own
  hardcoded MSME-fallback map per check type — the ticket still gets
  created and displayed either way.
- **Audit trail last**: every invoice gets a SHA-256 seal over its final
  field values, and every ticket action goes through `history_log.py`,
  which appends rather than overwrites.
- **Portfolio checks are separate from the per-invoice path on purpose**:
  vendor anomaly (z-score), sequence-gap, and Benford's Law only make
  statistical sense across a *set* of invoices for the same vendor, so they
  run in `portfolio_analyzer.py` on demand from the Reports page rather than
  once per upload.

### Honest gaps in this diagram
- `routes_frontend_adapter.py` effectively duplicates some of what
  `routes_upload.py` and `routes_tickets.py` do, but reshapes the JSON to
  match what the frontend's `client.js` expects. This means there are two
  working upload endpoints (`/upload/` and `/api/invoices/upload`) with
  slightly different response shapes — worth consolidating post-hackathon,
  and worth knowing so you don't call the wrong one live.
- `client.js` calls `POST /api/vendors/correct` and `POST /api/tickets/merge`,
  neither of which exists in `routes_frontend_adapter.py` — these UI actions
  will fail against the real backend.
- The `X-Role: auditor` gate on write routes is read from a request header
  the frontend sets after a client-side password check; it is not
  cryptographic authentication (see `SECURITY.md`).
