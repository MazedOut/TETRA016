/**
 * format.js — Central display-formatting helpers.
 *
 * RULE: Every number from the API passes through one of these before rendering.
 * Raw Python floats (e.g. 43.47826086956522) must never reach the DOM.
 */

/**
 * Format a number as Indian-locale currency.
 * e.g.  65000     → "₹65,000.00"
 *        0         → "₹0.00"
 *        null/NaN  → "₹0.00"
 */
export function fmtCurrency(value) {
  const n = Number(value);
  if (!isFinite(n)) return "₹0.00";
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a decimal fraction or a whole-number percentage.
 * Accepts both 0.4347826 (raw fraction) and 43.47826 (already-pct) forms.
 * Heuristic: if |value| <= 1.0 treat it as a fraction, else as already-pct.
 * e.g.  0.4347826  → "43.5%"
 *        43.4782    → "43.5%"
 *        100        → "100.0%"
 *        null/NaN   → "—"
 */
export function fmtPct(value, decimals = 1) {
  const n = Number(value);
  if (!isFinite(n)) return "—";
  const pct = Math.abs(n) <= 1.0 ? n * 100 : n;
  return pct.toFixed(decimals) + "%";
}

/**
 * Format a plain number with comma grouping, up to `maxDecimals` decimal places.
 * e.g.  43.47826  (maxDecimals=1) → "43.5"
 *        1234567   (maxDecimals=0) → "12,34,567"  (en-IN grouping)
 */
export function fmtNumber(value, maxDecimals = 2) {
  const n = Number(value);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Sanitise a raw reason/narrative string for display.
 * Replaces bare Python float literals (e.g. 43.47826086956522) with
 * nicely rounded equivalents, but does NOT change anything else.
 * Use this only as a last-resort fallback when no separate clean narrative exists.
 *
 * e.g. "best similarity: 43.47826086956522%"  → "best similarity: 43.5%"
 *      "mismatch 0.0+0.0 != 65000.0"          → "mismatch 0.00+0.00 ≠ ₹65,000.00"
 */
export function sanitiseReason(str) {
  if (!str || typeof str !== "string") return str ?? "";
  
  // Replace ugly math expressions like "0.0+0.0 != 118000.0" with cleaner versions
  let clean = str;
  
  // Pattern: "X+Y != Z" or "X+Y ≠ Z" math mismatch expressions -> concise summary
  clean = clean.replace(
    /(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)\s*(!?=|!=|≠)\s*(\d+\.?\d*)/g,
    (match, a, b, op, expected) => {
      const sum = parseFloat(a) + parseFloat(b);
      const exp = parseFloat(expected);
      return `computed ₹${sum.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ≠ expected ₹${exp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    }
  );
  
  // Round long decimal numbers: keep at most 2 decimal places
  clean = clean.replace(/\b(\d+\.\d{3,})\b/g, (match) => {
    const n = parseFloat(match);
    return isFinite(n) ? n.toFixed(2) : match;
  });
  
  // Clean up percentage patterns with many decimals
  clean = clean.replace(/(\d+\.\d{3,})%/g, (match, num) => {
    const n = parseFloat(num);
    return isFinite(n) ? n.toFixed(1) + "%" : match;
  });
  
  // Replace "mismatch:" prefix with cleaner text
  clean = clean.replace(/^mismatch:\s*/i, "Amount mismatch: ");
  
  return clean;
}

/**
 * Given a ticket/flag object, return { display, raw } strings.
 *  - display: the clean narrative (AI-generated or MSME) — shown by default
 *  - raw:     the original rule-engine reason string — shown in toggle
 *
 * Handles all fallback scenarios gracefully.
 */
export function resolveFindingText(flag, mode = "auditor") {
  const isMsme = mode === "msme";
  const display = isMsme
    ? (flag.msmeNarrative || flag.msme_narrative || flag.detail || flag.narrative || "")
    : (flag.detail || flag.narrative || flag.aiNarrative || "");
  const raw = flag.rawReason || flag.reason || flag.detail || "";
  return {
    display: display || sanitiseReason(raw),
    raw,
  };
}

/**
 * Generate a clean, high-level executive summary for a dashboard ticket based on its type.
 * This completely removes raw math, code output, and strings for summary cards.
 */
export function formatExceptionSummary(ticket) {
  const type = typeof ticket === "string" ? ticket : ticket?.type;
  
  switch (type) {
    case "amount_mismatch":
    case "internal_math_error":
      return "Item total does not match invoice total";
    case "invalid_gstin":
      return "GSTIN checksum validation failed";
    case "duplicate_invoice":
      return "Duplicate invoice detected in records";
    case "phantom_vendor":
      return "Unrecognized vendor — missing from vendor master";
    case "missing_ledger_entry":
      return "Missing corresponding entry in purchase ledger";
    case "typo_squatting_vendor":
      return "Vendor name closely resembles known supplier";
    case "pdf_metadata_tamper":
      return "PDF document metadata indicates tampering";
    case "invisible_text_detected":
      return "Hidden or invisible text detected in document";
    case "benford_deviation":
      return "Numeric distribution deviates from expected patterns";
    case "vendor_activity_anomaly":
      return "Unusual billing volume or frequency for vendor";
    case "date_mismatch":
      return "Invoice date does not match posting date";
    case "needs_review":
      return "Requires manual human review";
    default:
      return sanitiseReason(typeof ticket === "string" ? ticket : (ticket?.narrative || "Exception detected"));
  }
}
