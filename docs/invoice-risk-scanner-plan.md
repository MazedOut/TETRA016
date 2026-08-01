# AI-Powered Invoice Risk Scanner — Final Plan

Team of 3, 36 hours. This is the locked build plan.

---

## 1. Problem statement coverage check

Verifying nothing from the original brief got lost in brainstorming:

| Requirement | Covered by |
|---|---|
| Extract invoice number, date, vendor, GSTIN, taxable value, tax, total | Extraction engine |
| Match invoices to ledger | Reconciliation engine |
| Detect duplicates, missing records, amount/date mismatch, invalid GSTIN, unusual vendor activity | Reconciliation engine + rules |
| Link every exception to source doc with confidence/risk score | Ticket audit trail (dual score) |
| Prioritized exception dashboard | Dashboard, sorted/filtered by score |
| Searchable audit trail | Dashboard search + ticket history |

All four expected outcomes are covered. Nothing added replaces these — everything else is differentiation layered on top.

---

## 2. Final feature list, honestly prioritized

**Core (must work for a valid demo):**
- Hybrid extraction: OCR/rules first, LLM fallback only on low-confidence fields
- GSTIN format + checksum validation
- Exact + fuzzy invoice-ledger matching (catches "INV-2214" vs "INV-22l4")
- Duplicate, missing record, amount mismatch, date mismatch detection
- Dual scoring: **Risk score** (fraud/error likelihood) and **Confidence score** (extraction certainty) — kept as separate axes, not blended
- Filter/sort by either score or both
- Ticket-style audit trail (open / in-review / resolved / escalated), linked to source document
- Dashboard with search

**Should-have (adds real differentiation, build if core is stable by ~hour 20):**
- Selective AI narrative per flagged exception (not per invoice — see token strategy below)
- AI-proposed ticket merging with a stated reason, user confirms/edits/rejects, decision logged
- Auditor mode vs MSME mode toggle (same backend, plain-language layer for MSME)
- Report export (PDF snapshot of current filtered view)
- Vendor-level anomaly check (invoice frequency/amount vs vendor's own history, simple z-score/IQR)

**Stretch (only if ahead of schedule):**
- False-positive feedback loop — keep this honest: it's a session-level rule-weight nudge, not real learning. Don't oversell it as adaptive AI in the pitch, that's a credibility risk with technical judges.
- Persistent vendor trust score across the demo session

**Cut (don't attempt to build, mention only as roadmap):**
- WhatsApp/email forwarding — genuine integration isn't realistic in 36h. If you want the beat, use one static mockup slide, not a working feature. Don't let this eat build time.

---

## 3. Forms — where the system defers to a human

AI should never be the sole source of truth for anything with legal/financial consequence. Concretely:

1. **Vendor master onboarding form** — new vendor GSTIN/name/address entered or corrected by a human, not inferred by AI.
2. **Extraction correction form** — if OCR/LLM gets a field wrong, user corrects it inline; that correction is logged as ground truth (also feeds your "confidence was low here, and here's why" story).
3. **Merge confirmation form** — AI proposes a ticket merge with a reason; user accepts, edits the reason, or rejects. Nothing auto-merges silently.
4. **Ticket resolution form** — closing a ticket requires a reason (dropdown + free-text note), never a silent close.
5. **False-positive feedback form** — user marks "not actually an issue" with a reason (stretch feature, but the form itself is cheap to build even if the learning loop is minimal).
6. **Report generation form** — user picks date range, risk threshold, exception types before export, rather than one fixed dump.

This is also a good line for the pitch: *"Every place the model could be wrong or the stakes are high, there's a form, not an assumption."*

---

## 4. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) | Native fit for OCR/data libraries, async support, auto-generated docs save demo prep time, easy to scale horizontally later |
| OCR/Extraction | Tesseract or PaddleOCR (baseline) + Claude multimodal (fallback on messy layouts) | Rules-based extraction is free and fast; AI only where layout is genuinely hard — this is also your token-optimization story |
| Fuzzy matching | rapidfuzz | Fast, well-tested, exactly what you need for the "1 vs l" duplicate detection demo moment |
| Database | PostgreSQL | Relational integrity catches missing/orphaned records naturally via foreign keys; JSONB for flexible raw extracted fields; real story for indexing/partitioning at scale |
| Frontend | React + Tailwind | Fast to build ticket cards, filters, dual-score views; most teams already know it, so less onboarding time lost |
| LLM | Claude API, called selectively | Narrative generation, merge-reason writing, MSME plain-language translation — never per-invoice, only on flagged items |
| PDF export | WeasyPrint or reportlab | No heavy new dependency, straightforward HTML→PDF or direct generation |
| Hosting (demo) | Local + ngrok, or Render/Railway if time allows | Judges care about the product, not deployment — don't burn hours here |

---

## 5. Architecture and scalability

Pipeline (see diagram above): **Source documents → Extraction engine → Reconciliation & scoring → Ticket audit trail → Dashboard.**

Scalability notes worth having ready if judges ask:
- API layer is stateless — horizontally scalable behind a load balancer.
- In production, extraction/OCR would move to a queue (Celery + Redis) so a bulk invoice upload doesn't block the API — not needed for the hackathon demo, but worth stating you know this.
- The rules engine is pure computation — trivially parallelizable per invoice.
- The LLM narrative step is the only part that's rate-limited and slow — isolating it as a selective, separate step (rather than baking it into extraction) means it's cheap **and** the easiest layer to scale/queue independently. This is the same design decision solving two problems at once, and it's a good thing to say explicitly in your pitch.

---

## 6. Token optimization strategy

- Every invoice runs through **deterministic rules first** — GSTIN regex/checksum, exact/fuzzy match, amount/date diff. Zero tokens, instant.
- LLM is called only for:
  - Extraction fallback, on fields the rule-based OCR parse is genuinely uncertain about
  - Narrative explanation, only on invoices that actually triggered a flag (a batch of 200 with 15 exceptions means 15 calls, not 200)
  - Merge-reason text, only when a merge is proposed
  - MSME plain-language translation, only when that mode is active
- Batch narratives by pattern where possible — five invoices tripping the same rule from the same vendor can share one generated explanation rather than five near-duplicates.

---

## 7. Feasibility check — 36 hours, team of 3

Rough budget (adjust once you see your actual dataset):

- **Hour 0–2**: Setup, synthetic dataset design (deliberately plant duplicates, the "l vs 1" case, bad GSTIN, date/amount mismatches), repo scaffolding
- **Hour 2–10**: Extraction pipeline (Person A) · Reconciliation + scoring logic (Person B) · Dashboard/ticket UI + forms skeleton (Person C) — in parallel
- **Hour 10–20**: Integration — wire extraction → reconciliation → scoring → tickets; dual-score filter UI; selective LLM narrative calls
- **Hour 20–28**: AI merge suggestion + confirmation form; Auditor/MSME toggle; report export; UI polish
- **Hour 28–32**: Test against synthetic dataset, fix bugs, rehearse the demo script — especially the fuzzy-duplicate "gotcha" moment
- **Hour 32–36**: Buffer, slides, final run-through

**Reality check on the riskiest items:**
- Fuzzy duplicate detection is genuinely easy (rapidfuzz + normalization) — safe to make it your headline demo moment.
- Dual scoring is just two numeric fields and a filter — low risk, high payoff, do it early.
- AI-assisted merge is more UI/state work than AI work if you keep the matching logic rule-based and only use the LLM to write the reason — feasible.
- Don't let the false-positive feedback loop or persistent vendor trust score touch your critical path — they're additive, not load-bearing. If you're behind by hour 24, cut these first, not the core four.

---

## 8. If you're behind schedule, cut in this order

1. WhatsApp mockup slide (never build the real thing anyway)
2. False-positive feedback loop
3. Persistent vendor trust score
4. Vendor-level statistical anomaly check
5. Report export
6. Auditor/MSME toggle (fall back to auditor-only view)

Never cut: extraction, reconciliation rules, dual scoring, ticket trail, dashboard search. Those are the actual problem statement.
