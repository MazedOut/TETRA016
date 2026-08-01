# Security

## Implemented today
| Measure | Where | Detail |
|---|---|---|
| File-type allowlist | `ingestion/file_validator.py` | Only `pdf, png, jpg, jpeg` accepted |
| Upload size cap | `ingestion/file_validator.py` | 15MB max, empty files rejected |
| Content sanity check | `ingestion/content_sniff.py` | Rejects files with no extractable text (via OCR-emptiness check), catching non-invoice uploads before they consume pipeline resources |
| Secret handling | `.env` (gitignored) + `.env.example` (committed, no real key) | `GEMINI_API_KEY` loaded via `python-dotenv`, never hardcoded in source |
| SQL injection resistance | All DB access via SQLAlchemy ORM query builder | Even `auto_migrate()`'s dynamic `ALTER TABLE` statements build table/column names from SQLAlchemy's own model metadata, not user input |
| Demo-grade role gate | `frontend/src/context/AuthContext.jsx` + `backend/app/api/routes_frontend_adapter.py::_require_auditor` | Client-side password check against a hardcoded `{auditor, msme}` map sets an `X-Role` header on every request; every write route (folder create/move, ticket resolve/bulk-resolve, invoice correction) checks that header server-side and returns `403` if it isn't `auditor` |
| Audit trail integrity (partial) | `audit_trail/hash_sealer.py` | SHA-256 seal computed over each finalized invoice's key fields (`invoice_number`, `total_amount`, `vendor_gstin`) |
| Append-only action log | `audit_trail/history_log.py` | Ticket history is a JSON list that's appended to, never overwritten in place |
| Auto-migration safety checks | `db/database.py::auto_migrate()` | Refuses to add a `NOT NULL`, no-default column to a non-empty table (would corrupt existing rows); logs a warning and skips instead of crashing |

## Not implemented — do not claim these in the pitch
- **No real authentication or authorization.** The `X-Role` gate described
  above is explicitly demo-grade: the code's own docstring says so. Any
  caller who sets `X-Role: auditor` on a raw HTTP request bypasses it
  entirely — there is no token, session, or server-side credential check
  behind it. The lower-level `routes_tickets.py` router (mounted at
  `/tickets`, not `/api`) has **no** role gate at all.
- **CORS is wide open**: `main.py` sets `allow_origins=["*"]`, with a code
  comment that literally says "tighten before any real deployment" — this is
  an honest, self-documented gap, not an oversight to hide.
- **No rate limiting** on upload or any other endpoint.
- **No filename sanitization** beyond extension checking — a filename with
  path-traversal characters is not specifically stripped or validated before
  being used to build `uploads/{invoice_id}/{filename}` paths.
- **Tickets are not individually sealed** — only the parent `Invoice` row
  gets a SHA-256 hash; a `Ticket.history` entry could theoretically be
  altered directly in the database without detection, since there's no
  seal/verify check on tickets themselves.
- **No TLS/HTTPS configuration** in this repo — that's an infra/deployment
  concern, not something the app code handles.
- **No secrets scanning or dependency vulnerability scanning** configured.
- **Passwords live in frontend source** (`AuthContext.jsx`): `audit2026` /
  `msme2026` are hardcoded constants, visible to anyone who opens the
  bundled JS — fine for a demo, never for real credentials.

## Production security recommendations (roadmap, not current state)
1. Replace the client-side password check + `X-Role` header with real
   authentication (e.g. OAuth2/JWT via FastAPI's built-in security
   utilities) and server-verified role-based access control.
2. Restrict CORS to known frontend origins.
3. Add rate limiting (e.g. `slowapi` or a reverse-proxy layer).
4. Sanitize/normalize uploaded filenames and store them under
   server-generated IDs rather than trusting client-provided names.
5. Extend `hash_sealer.py`'s sealing pattern to `Ticket` rows, or move the
   audit log to an append-only store (e.g. a separate immutable table or
   write-once log) with its own integrity check.
6. Move from SQLite to Postgres with connection-level TLS for any real
   deployment (the `DATABASE_URL` env var already supports this swap).
7. Add structured logging/monitoring for anomalous upload patterns (this is
   a different, ops-facing concern from the vendor-behavior anomaly
   detection already in `vendor_anomaly.py`).
8. Apply the same role check to `routes_tickets.py` that
   `routes_frontend_adapter.py` already has, or retire the former in favor
   of the latter, so there isn't an un-gated back door to ticket actions.
