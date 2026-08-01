# API Documentation

Only endpoints that are (a) defined in a router file AND (b) actually
mounted in `main.py` are documented here as real. `routes_invoices.py`
exists as a file but is **not mounted** — see the note at the bottom.
`routes_reports.py` **is now mounted**, at `/api/reports`.

Base URL (dev): `http://localhost:8000`. The frontend talks to the `/api/*`
group via Vite's dev proxy, and sends an `X-Role` header (`auditor` or
`msme`) set after login — write endpoints reject anything but `auditor`.

---

## Health

### `GET /health`
Purpose: liveness check.
Response: `{"status": "ok"}`

---

## Upload router (`prefix=/upload`) — `routes_upload.py`

### `POST /upload/`
Purpose: upload a batch of invoice files, run the full pipeline
synchronously, persist results.
Request: `multipart/form-data`, field `files` (list of file uploads).
Response:
```json
{
  "processed": [{"filename": "...", "extraction": {...}, "forensics": {...}, "risk": {"invoice_id": 1, "risk_score": 70, "risk_level": "high", "summary": "...", "ticket_ids": [1,2], "needs_review": []}}],
  "rejected": [{"filename": "...", "reason": "unsupported format .txt"}],
  "total": 3
}
```
Errors: individual file extraction failures are caught per-file and moved to
`rejected` with the exception message — a bad file in a batch does not fail
the whole request.

---

## Tickets router (`prefix=/tickets`) — `routes_tickets.py`

### `GET /tickets/`
Query params: `status` (optional), `exception_type` (optional).
Response: list of serialized tickets (see shape below).

### `GET /tickets/{ticket_id}`
Response: one serialized ticket, or 404 if not found.

### `POST /tickets/`
Query params: `invoice_id`, `exception_type`, `risk_contribution`, `narrative` (optional).
Response: the created ticket.

### `PATCH /tickets/{ticket_id}/status`
Query params: `new_status` (must be one of `open`/`in-review`/`resolved`/`escalated`), `actor`, `reason` (optional).
Errors: `400` if `new_status` is invalid or ticket not found.

### `PATCH /tickets/{ticket_id}/false-positive`
Query params: `actor`, `reason`.
Marks the ticket resolved with `is_false_positive=1`.

### `POST /tickets/{source_id}/merge/{target_id}`
Query params: `actor`, `reason`.
Marks `source_id` as `merged_into_ticket_id = target_id`, status `resolved`.

**Ticket serialization shape** (from `_serialize()`):
```json
{
  "id": 1, "invoice_id": 1, "exception_type": "duplicate_invoice",
  "status": "open", "risk_contribution": 40, "narrative": "...",
  "resolution_reason": null, "is_false_positive": false,
  "merged_into_ticket_id": null, "history": [...],
  "created_at": "...", "updated_at": "..."
}
```

This router is a lower-level, non-`/api` counterpart to the ticket endpoints
in the frontend adapter router below — it's not what the shipped frontend
actually calls, but it's the one un-gated (no `X-Role` check) way to hit
ticket actions directly, e.g. for scripting or testing.

---

## Dashboard router (`prefix=/dashboard`) — `routes_dashboard.py`

### `GET /dashboard/stats`
Response:
```json
{
  "total_invoices": 12,
  "by_risk_level": {"low": 8, "medium": 3, "high": 1},
  "open_tickets": 4,
  "resolved_tickets": 2,
  "avg_confidence_score": 0.87
}
```

---

## Frontend adapter router (`prefix=/api`) — `routes_frontend_adapter.py`
This is what `frontend/src/api/client.js` actually calls (`USE_MOCK=false`
in the shipped repo). It re-shapes the same underlying data into the field
names the frontend expects (`riskScore`, `confidenceScore`, camelCase, etc.)
and gates every write route behind `_require_auditor` (see `SECURITY.md`).

### `GET /api/stats`
```json
{
  "itcAtRiskInr": 12500.0,
  "invoicesProcessed": 12,
  "openTickets": 4,
  "avgConfidence": 0.87,
  "msmePenaltyExposureInr": 3400.0,
  "aiFallbackCount": 2,
  "aiCallsAvoided": 10,
  "topDrivers": [{"type": "duplicate_invoice", "count": 3}],
  "recentExceptions": [{"id": "TCK-9", "type": "invalid_gstin", "narrative": "...", "created_at": "..."}]
}
```
`itcAtRiskInr` and `msmePenaltyExposureInr` are now computed for real from
`itc_calculator.py` / `msme_penalty.py` over every invoice currently in the
DB (not scoped by folder or date range). `aiFallbackCount` /
`aiCallsAvoided` and `topDrivers` / `recentExceptions` are new fields not
present in earlier builds.

### `GET /api/stats/risk-distribution`
Returns invoice counts bucketed into `0-20, 21-40, 41-60, 61-80, 81-100`.

### `GET /api/folders`
Returns one row per distinct `Invoice.folder` value plus every row in the
`folders` table (so an empty, newly created folder still shows up), each
with an invoice count.

### `POST /api/folders` *(auditor only)*
Body: `{"name": "...", "category": "..."}`. Creates a row in the `folders`
table; no-ops with a message if the name already exists.

### `POST /api/invoices/{invoice_id}/move` *(auditor only)*
Body: `{"folder": "..."}` (or `{"folderName": "..."}`). Reassigns an
invoice's folder and, if a matching `Folder` row exists, its `folder_id`.

### `GET /api/tickets?status=&minRisk=&minConfidence=&query=&folder=`
Returns tickets in the frontend's `TicketCard` shape, sorted by `riskScore`
descending. Supports filtering by minimum risk score, minimum extraction
confidence, free-text vendor/invoice-id search, and folder — all new filter
params not present in earlier builds.

### `GET /api/tickets/{ticket_id}` — accepts `"TCK-{id}"` format
Returns one ticket in frontend shape, or `{}` if not found.

### `POST /api/tickets/{ticket_id}/resolve` *(auditor only)*
Body: `{"reason": "...", "actor": "auditor", "falsePositive": false}`
Response: `{"ok": true, "ticketId": "...", "status": "resolved"}`

### `POST /api/tickets/bulk-resolve` *(auditor only)*
Body: `{"ticketIds": ["TCK-1", "TCK-2"], "reason": "...", "actor": "auditor"}`

### `GET /api/invoices/{invoice_id}/file` — accepts `"INV-{id}"` format
Streams the originally uploaded PDF/image back with the correct
`Content-Type`, reading `Invoice.source_file_path` off disk. This route did
not exist in earlier builds; it's why `InvoiceDetail.jsx`'s `react-pdf`
preview now has a real `fileUrl` to render instead of always getting `null`.

### `GET /api/invoices/{invoice_id}` — accepts `"INV-{id}"` format
Returns invoice detail (fields, confidence, flags, edit history, and a
`financialExposure` block with `itcAtRisk` and `msmePenalty` for that single
invoice) in the shape `InvoiceDetail.jsx` expects.

### `POST /api/invoices/upload`
Same processing as `/upload/`, reshaped response: `[{"filename": "...", "status": "accepted" | "needs-review" | "rejected", "invoice_id": ..., "risk_level": ...}]`.

### `PATCH /api/invoices/{invoice_id}` *(auditor only)*
Body: field corrections, e.g. `{"vendor_name": "..."}`. Auditor-only manual
correction of extracted fields; each change is appended to
`Invoice.edit_history`. New endpoint, not present in earlier builds.

### `GET /api/folders/{folder_name}/invoices`
Lists every invoice currently assigned to a named folder.

### `POST /api/dev/reset`
Calls `db/seed.py`'s `seed()`: wipes and recreates all tables, regenerates
the synthetic invoice/vendor/ledger dataset, and runs every generated
invoice through the real orchestrator. Response:
`{"ok": true, "message": "Demo dataset reloaded successfully (60 invoices seeded)."}`.
Dev/demo convenience only — no confirmation or auth guard beyond the
frontend's `window.confirm()`.

---

## Reports router (`prefix=/api/reports`) — `routes_reports.py`
Newly mounted. Both routes run `portfolio_analyzer.py` across every invoice
currently in the DB.

### `GET /api/reports/portfolio`
Returns the raw portfolio analysis: invoice counts by risk level, ITC-at-risk
and MSME-penalty totals, duplicate-cluster/sequence-gap/Benford-deviation
counts, the full list of portfolio-level flags, and
`insufficient_data_notes` for any vendor below the minimum sample size for a
given statistical check.

### `POST /api/reports/generate`
Body: `{"from": "...", "to": "...", "minRisk": 0, "types": ["duplicate_invoice", ...]}`
(`from`/`to` are accepted but not currently used to filter — see
`FACT_SHEET.md`). Filters invoices/tickets by `minRisk` and `types`, then
returns the portfolio summary plus a `flagged_invoices` array with
per-invoice ticket detail. **Returns JSON only** — `"url"` is always `null`;
despite `reportlab`/`weasyprint` being in `requirements.txt`, no PDF or file
is actually rendered.

---

## Endpoints that exist as files but are NOT live
- `routes_invoices.py` → `GET /` returns a placeholder message. **Not
  mounted in `main.py`** — visiting any `/invoices/*` path (outside the
  `/api/invoices/*` adapter routes above) returns 404 regardless of this
  file's content.

## Frontend calls with no matching backend route (will fail live)
- `submitVendorCorrection()` → `POST /api/vendors/correct` — no such route,
  and no vendor-write endpoint exists anywhere in the backend.
- A ticket-merge helper in `client.js` posts to `POST /api/tickets/merge` —
  the real merge route is `POST /tickets/{source_id}/merge/{target_id}`
  (different path shape, different router prefix) and isn't proxied under
  `/api`.
