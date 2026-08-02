import { useState } from "react";
import { sanitiseReason } from "../utils/format.js";

/**
 * FindingRow — renders one exception flag entry.
 *
 * Default view (for everyone): clean human-readable narrative.
 * "Show technical detail" toggle (collapsed by default): raw reason string
 * and any precise technical numbers — for auditors who need the precision.
 *
 * Props:
 *   flag         — { type, detail, rawReason, msmeNarrative, status, evidenceData }
 *   mode         — "auditor" | "msme"
 *   index        — index in the evidence chain (for the timeline dot)
 *   className    — optional extra classes on the wrapper
 */

const EXCEPTION_TITLES = {
  duplicate_invoice: "Duplicate Invoice Detected",
  invalid_gstin: "Invalid GSTIN Checksum",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Subtotal Calculation Error",
  phantom_vendor: "Unregistered / Phantom Vendor",
  typo_squatting_vendor: "Vendor Name Typo-Squatting",
  pdf_metadata_tamper: "PDF Metadata Anomaly",
  invisible_text_detected: "Hidden Text Detected",
  benford_deviation: "Benford Law Numeric Anomaly",
  vendor_activity_anomaly: "Vendor Volume Anomaly",
  needs_review: "Needs Human Review",
  date_mismatch: "Date / Posting Mismatch",
};

const STATUS_STYLES = {
  open: "bg-stamp-red/15 text-stamp-red border-stamp-red/30",
  "in-review": "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30",
  resolved: "bg-stamp-green/15 text-stamp-green border-stamp-green/30",
  escalated: "bg-ink/10 text-paper/70 border-ink-600/30",
};

export default function FindingRow({ flag, mode = "auditor", children }) {
  const [showRaw, setShowRaw] = useState(false);
  const isMsme = mode === "msme";

  // Human-readable display text (clean, AI-generated or MSME)
  const displayText = isMsme
    ? (flag.msmeNarrative || flag.detail || "")
    : (flag.detail || flag.narrative || "");

  // Raw technical reason string (for the toggle)
  const rawText = flag.rawReason || flag.detail || "";

  // Whether "raw" toggle is meaningful (only show button if raw differs from display)
  const hasRawDetail = rawText && rawText !== displayText;

  const title = isMsme
    ? (EXCEPTION_TITLES[flag.type] || flag.type)
    : flag.type;

  return (
    <div className="relative pl-6">
      {/* Timeline dot */}
      <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-stamp-red border-2 border-paper" />

      {/* Flag header */}
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-mono font-semibold text-sm text-stamp-red">{title}</span>
        {flag.status && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[flag.status] ?? ""}`}
          >
            {flag.status}
          </span>
        )}
        {children}
      </div>

      {/* Clean human-readable narrative */}
      <p className="text-xs text-ink leading-relaxed font-sans">
        {displayText || sanitiseReason(rawText) || "No details available."}
      </p>

      {/* "Show technical detail" toggle — collapsed by default */}
      {hasRawDetail && (
        <div className="mt-2">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-[10px] font-mono text-ink-600 hover:text-ink underline underline-offset-2 transition-colors"
            aria-expanded={showRaw}
          >
            {showRaw ? "▲ Hide technical detail" : "▼ Show technical detail"}
          </button>
          {showRaw && (
            <div className="mt-1.5 bg-ink-800 border border-ink-600/40 rounded-md px-3 py-2.5 text-paper">
              <p className="text-[10px] uppercase font-mono tracking-widest text-paper/40 mb-1.5">
                Raw rule-engine output · audit precision
              </p>
              <pre className="text-[11px] font-mono text-paper/80 whitespace-pre-wrap break-words leading-relaxed">
                {rawText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
