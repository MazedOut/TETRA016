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
  // Round long decimal numbers: keep at most 1 decimal place
  return str.replace(/\b(\d+\.\d{4,})\b/g, (match) => {
    const n = parseFloat(match);
    return isFinite(n) ? n.toFixed(1) : match;
  });
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
