# Algorithm Documentation & Complexity Analysis

Every algorithm below exists in the repository as real, runnable code.
Status (🟢 live per-invoice / 🟢 live portfolio-only / 🟡 implemented, not
wired) matches `FACT_SHEET.md`.

---

## Per-invoice checks (run on every upload, via `orchestrator.py`)

## 1. GSTIN checksum validation 🟢
**File**: `reconciliation/gstin_validator.py`
**Purpose**: Confirm a vendor's GSTIN is structurally valid and not simply a
plausible-looking fake.
**Input**: 15-character GSTIN string.
**Processing**: Regex checks the 15-char format (`\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z0-9]`),
then recomputes the official mod-36 checksum character over the first 14
characters and compares it to the 15th.
**Output**: `{valid: bool, reason: str|None}`.
**Why useful**: Catches fabricated or mistyped GSTINs that "look right" but
fail the real government checksum — something a naive regex-only check
would miss.
**Complexity**: O(1) per GSTIN — fixed 14-character loop.
**Limitations**: Confirms the *format* is a valid GSTIN; does not verify the
GSTIN is actually registered (that would require a live GST portal API call,
not implemented here).

## 2. Inter/intra-state tax-type check 🟢
**File**: `reconciliation/gstin_validator.py` (`check_tax_type`)
**Purpose**: Vendors in the same state as the buyer should charge CGST+SGST;
vendors in a different state should charge IGST. Flags the mismatch.
**Input**: vendor GSTIN, buyer GSTIN (from `config.py`), cgst/sgst/igst amounts.
**Processing**: Compares the first 2 digits (state code) of each GSTIN, then
checks which tax fields are non-zero.
**Output**: `{flagged: bool, reason: str|None}`.
**Complexity**: O(1).
**Limitations**: Trusts the extracted tax field values; if OCR/extraction
mis-read a tax amount as 0, this check can misfire.

## 3. Exact duplicate detection (hash tier) 🟢
**File**: `reconciliation/duplicate_detector.py` (`hash_tier_duplicates`)
**Purpose**: Instantly catch invoices that are byte-for-byte the same
transaction re-submitted.
**Input**: list of invoice dicts — on upload, every invoice already in the DB
plus the one just extracted.
**Processing**: Builds a normalized key (`invoice_number|gstin|amount|date`),
SHA-256 hashes it, and checks a running dict of seen hashes.
**Output**: list of `{invoice_index, duplicate_of_index, method: "hash_exact"}`.
**Complexity**: O(n) time, O(n) space — a single pass with a hash-set lookup.
**Limitations**: Only catches *exact* matches on all four fields; a single
character difference (see fuzzy tier below) won't be caught here. Because
`orchestrator.py` reloads and re-checks against **every** invoice in the DB
on each upload, per-upload cost is O(n) in total invoice count, not O(1) —
fine at hackathon/demo scale, worth indexing at real volume.

## 4. Fuzzy near-duplicate detection (scoped) 🟢
**File**: `reconciliation/duplicate_detector.py` (`fuzzy_tier_duplicates`)
**Purpose**: Catch the "1 vs l" style near-duplicate — same vendor, same
amount, invoice number altered by a character or two.
**Input**: invoices not already caught by the hash tier.
**Processing**: For every pair *scoped to the same vendor GSTIN and amount
within 1% tolerance*, runs `rapidfuzz.fuzz.ratio` on the invoice numbers;
flags pairs ≥ 85% similarity.
**Output**: list of `{invoice_index, duplicate_of_index, method: "fuzzy_near_duplicate", similarity_score}`.
**Complexity**: Worst case O(n²) pairwise comparisons, **but the vendor +
amount scoping is a real optimization already in the code** — it skips the
expensive `rapidfuzz` string comparison entirely unless both cheap filters
(same vendor, similar amount) pass first, and it also skips anything the
O(n) hash tier already resolved.
**Limitations**: Still theoretically O(n²) in the pathological case where
every invoice shares one vendor and one amount. Production fix: bucket by
`(vendor_gstin, rounded_amount)` first with a dict, then only run
`rapidfuzz` within each bucket — same idea, made explicit instead of
implicit in the nested loop.

## 5. Internal math check 🟢
**File**: `extraction/math_check.py`
**Purpose**: Confirm `taxable_value + tax == total_amount` within a 50-paisa
tolerance (OCR rounding).
**Complexity**: O(1).
**Limitations**: Garbage in, garbage out — if OCR misreads a digit, the math
check can both false-positive (flagging a correct invoice) and false-negative
(two compensating OCR errors cancelling out).

## 6. Vendor-master matching (phantom & typo-squat detection) 🟢
**File**: `reconciliation/vendor_matcher.py`
**Purpose**: Flag invoices from a vendor not in the approved vendor master
(phantom vendor), or from a vendor name suspiciously close to a real one
(typo-squatting).
**Input**: extracted vendor name/GSTIN, vendor master DataFrame (loaded from
the DB `Vendor` table if populated, else `synthetic_data/output/vendor_master.csv`).
**Processing**: Exact match first (free); if none, `rapidfuzz` similarity
against the vendor master rows.
**Output**: `{flagged: bool, check: str, reason: str}`, folded into the
invoice's flag list in `orchestrator.py` on every upload.
**Complexity**: O(m) per invoice, where m = vendor master size — fine at
hackathon scale (tens of vendors), would need indexing/blocking (e.g. by
first letter or industry code) at thousands of vendors.

## 7. Ledger matching + mismatch checks 🟢
**Files**: `reconciliation/ledger_matcher.py`, `reconciliation/mismatch_checks.py`
**Purpose**: Confirm the invoice has a corresponding purchase-ledger entry,
and that amount/date agree with it.
**Input**: extracted invoice fields, ledger DataFrame (DB `LedgerEntry` table
if populated, else `synthetic_data/output/ledger.csv`).
**Processing**: `match_ledger` looks up by `(invoice_number, vendor_name)`;
if matched, `check_mismatches` compares amount and date against the ledger
row within tolerance; if unmatched, a `missing_ledger_entry`-style flag is
raised instead.
**Complexity**: O(1) lookup per invoice using pandas boolean masking
(effectively linear in ledger size per call unless indexed — for a large
ledger, indexing on `invoice_number` would make this O(log n) or O(1) with a
dict).
**Limitations**: Depends entirely on the ledger CSV/table being current;
there's no write-back path today that updates the ledger when an invoice is
approved.

## 8. PDF metadata tamper scan 🟢
**File**: `reconciliation/forensics.py` (`check_metadata_tamper`)
**Purpose**: Flag PDFs whose `/Producer` or `/Creator` metadata shows
image-editing software (Photoshop, Canva, GIMP, Paint.NET, Illustrator)
rather than a scanner or standard document tool.
**Complexity**: O(1) — reads a fixed metadata dictionary via `pikepdf`.
**Limitations**: A determined forger can strip or fake this metadata; this
is a low-effort tripwire, not forensic-grade proof.

## 9. Invisible-text scan 🟢
**File**: `reconciliation/forensics.py` (`check_invisible_text`)
**Purpose**: Detect white-on-white (or near-white) text layers hidden in a
PDF — a known trick for hiding numbers a human reviewer won't see but an
automated text-extraction tool will.
**Processing**: Walks every text span on every page via PyMuPDF, checks if
the RGB color is above 250/250/250.
**Complexity**: O(spans) — linear in document text volume.
**Limitations**: Only catches the specific "near-white" hiding technique;
doesn't catch text hidden by other means (e.g. zero-size font, off-page
positioning).

## 10. Image EXIF tamper scan 🟢
**File**: `reconciliation/forensics.py` (`check_image_metadata`)
**Purpose**: Same idea as #8 but for PNG/JPG uploads — checks the EXIF
`Software` tag.
**Complexity**: O(1).
**Limitations**: Many legitimate phone-camera images have no EXIF at all
after being re-saved/shared (WhatsApp strips it), so "no EXIF" is treated as
mildly suspicious, not damning — the code comment says this explicitly.

## 11. Folder auto-classification 🟢
**File**: `classification/folder_sorter.py`, backed by `classification/vendor_cache.py`
**Purpose**: File each invoice into a vendor/category folder without an AI
call, using a persisted cache.
**Processing**: Missing critical fields → `needs review` folder. Known
vendor in the cache → its cached category. Otherwise → `extra`.
**Complexity**: O(1) dict lookup per invoice.
**Limitations**: New/unrecognized vendors always land in `extra` — nothing
currently promotes them into a real category (the AI classifier that could
do that, `vendor_classifier.py`, isn't wired in).

## 12. Weighted risk scoring 🟢
**File**: `scoring/risk_scorer.py`
**Purpose**: Turn a list of independent flags into one comparable 0–100
score with an explainable breakdown.
**Processing**: Deduplicates by check type (each check counts once per
invoice even if triggered twice), looks up each check's point weight from
`config.py`, sums, caps at 100, and buckets into Low (<20) / Medium (20–49) /
High (≥50).
**Complexity**: O(k) where k = number of flags on this invoice (small,
bounded by the number of check types that exist).
**Limitations**: Linear weighted sum, not a trained model — weights are
hand-set constants in `config.py`, not calibrated against real outcome data.
That's an honest limitation, not a hidden one: say so if asked "how did you
pick these weights."

## 13. AI vision extraction fallback 🟢
**File**: `extraction/gemini_fallback.py`
**Purpose**: Recover critical fields (invoice number, vendor name, total)
that Tesseract + regex couldn't extract confidently.
**Processing**: Sends the invoice image + a JSON-only prompt to
`gemini-2.0-flash`; retries up to 2 times with exponential backoff and a
30-second per-attempt timeout (via a thread pool); strips markdown fences
before `json.loads`.
**Complexity**: One network call per invoice *only when triggered* (i.e.
only for invoices where a critical field scored below 80% confidence).
**Limitations**: If Gemini returns malformed JSON after all retries, the
function returns `None` for every missing field rather than crashing — the
invoice still gets processed, just flagged via `needs_review`.

## 14. AI narrative generation & MSME translation 🟢
**Files**: `ai_layer/narrative_generator.py`, `ai_layer/msme_translator.py`
**Purpose**: Turn each flag's rule-generated `reason` string into one
plain-language sentence, then optionally re-explain in simpler,
action-oriented language for MSME users.
**Processing**: Batches *all* flags for one invoice into a single Gemini
call per stage (not one call per flag) — a deliberate cost optimization.
**Complexity**: One or two AI calls per invoice-with-flags, zero for clean
invoices.
**Limitations**: Falls back to the raw rule reason string (or the prior
narrative) on any exception (timeout, bad JSON, API error) — the pipeline
never blocks or crashes on an AI failure. `routes_frontend_adapter.py` also
keeps its own hardcoded MSME-sentence fallback map as a second safety net.

---

## Portfolio-level checks (run on demand from the Reports page, via `reconciliation/portfolio_analyzer.py`)

## 15. Vendor anomaly detection (z-score + off-hours) 🟢
**File**: `reconciliation/vendor_anomaly.py`
**Purpose**: Flag invoices that are statistically unusual for their vendor —
either an amount far outside that vendor's typical range, or a submission
timestamp outside normal business hours.
**Processing**: Groups invoices by vendor, computes each vendor's own
mean/std of `total_amount`, flags invoices > 1.5 standard deviations away.
Requires a minimum sample size per vendor (`MIN_INVOICES_FOR_ANOMALY_CHECK`)
before running — below that, `portfolio_analyzer.py` returns an
"Insufficient historical evidence" note instead of a false-confidence flag.
**Complexity**: O(n) via pandas groupby.
**Where it runs**: Only from `GET /api/reports/portfolio` and
`POST /api/reports/generate` — **not** on a freshly uploaded single invoice.

## 16. Sequence-gap detection 🟢
**File**: `reconciliation/sequence_gap.py`
**Purpose**: Catch missing invoice numbers in a vendor's numbering sequence
— a classic sign of an invoice being paid outside the system.
**Processing**: Parses each vendor's invoice numbers into (prefix, number),
and flags any missing integer in the observed range. Requires a minimum
sample size (`MIN_INVOICES_FOR_SEQUENCE_CHECK`).
**Complexity**: O(n log n) (sorting per vendor group).
**Where it runs**: Portfolio report only, same as #15.

## 17. Benford's Law deviation 🟢
**File**: `reconciliation/benford_check.py`
**Purpose**: Detect vendors whose invoice-amount leading-digit distribution
deviates from the naturally expected Benford curve — a classic
fabricated-numbers tripwire.
**Processing**: Computes each vendor's leading-digit distribution and runs a
chi-square test against the expected Benford curve. Requires a minimum
sample size (`MIN_INVOICES_FOR_BENFORD`, higher than the anomaly/sequence
thresholds since chi-square needs more data to be meaningful).
**Complexity**: O(n) — one pass to count leading digits, fixed 9-bucket
chi-square computation.
**Where it runs**: Portfolio report only, same as #15.

## 18. ITC-at-risk and MSME 43B(h) penalty aggregation 🟢
**Files**: `scoring/itc_calculator.py`, `scoring/msme_penalty.py`
**Purpose**: Turn flagged/overdue invoices into ₹ exposure figures auditors
and MSME owners actually care about.
**Processing**: `itc_calculator` sums CGST+SGST+IGST across every
`risk_level == "high"` invoice. `msme_penalty` checks each invoice against
the 45-day Section 43B(h) deadline and estimates the disallowed-expense
penalty at a configured rate.
**Complexity**: O(n).
**Limitations**: `portfolio_analyzer.py` currently hardcodes `is_paid=False`
for every invoice when calling the batch penalty function, since there's no
payment-status field yet — so the MSME-penalty figure is a worst-case
upper bound assuming nothing has been paid, not a true "still overdue"
count. Say this plainly if asked how the number was derived.
**Where it runs**: `GET /api/reports/portfolio`, `POST /api/reports/generate`,
and (single-invoice `itcAtRisk`/`msmePenalty` only) `GET /api/invoices/{id}`
and `GET /api/stats`.

---

## Implemented but not wired anywhere 🟡

### 19. AI-assisted ticket merge suggestion
**File**: `ai_layer/merge_suggester.py`. Pairwise `rapidfuzz` comparison of
ticket vendor names (with suffix normalization: "pvt"→"private" etc.) plus a
shared-check-type overlap test. **Complexity**: O(t²) over open tickets —
acceptable at hackathon ticket volumes, would need the same
bucketing/bloom-filter treatment as duplicate detection at scale. No route
or UI action calls this today; ticket merging in the app is a manual action.

### 20. Misfiled-invoice scanner
**File**: `classification/misfile_scanner.py`. Compares an invoice's current
folder against what `folder_sorter.py` would assign it today, flagging
drift (e.g. a vendor's category changed after the invoice was already
filed). **Complexity**: O(1) per invoice checked. Not called by any route or
pipeline step.

### 21. Standalone AI vendor classifier
**File**: `classification/vendor_classifier.py`. Would call an AI model to
assign a first-time category to an unrecognized vendor and write it into
`vendor_cache.py`. Not called anywhere — unrecognized vendors are filed
under `extra` instead.

## Complexity summary table

| Algorithm | Time | Space | Optimization present? |
|---|---|---|---|
| GSTIN checksum | O(1) | O(1) | n/a, already constant |
| Exact duplicate (hash) | O(n) | O(n) | hash-set lookup |
| Fuzzy duplicate | O(n²) worst case | O(n) | ✅ vendor+amount scoping, skips hash-tier hits |
| Vendor-master matching | O(n·m) | O(m) | ❌ none yet — candidate for blocking by category/state code |
| Ledger matching | O(1)–O(n) per lookup | O(n) | ❌ none yet — index by `invoice_number` at scale |
| Risk scoring | O(k) | O(k) | n/a, k is small and bounded |
| Folder classification | O(1) | O(1) | ✅ pure cache lookup |
| Vendor anomaly / sequence-gap / Benford (portfolio) | O(n) – O(n log n) | O(n) | pandas groupby is already reasonably efficient; gated by minimum sample size |
| ITC / MSME-penalty aggregation (portfolio) | O(n) | O(n) | n/a |
| Ticket merge suggestion (unwired) | O(t²) | O(t) | ❌ none yet — same fix as fuzzy duplicates would apply |

**Honest framing for judges**: the O(n²) algorithms in this codebase have a
real, working optimization for the one that's actually wired (duplicate
detection is scoped by vendor+amount before any string comparison runs);
the unwired one (merge suggestion) does not yet, and would benefit from the
same bucketing technique at real scale (thousands of invoices/tickets rather
than tens).
