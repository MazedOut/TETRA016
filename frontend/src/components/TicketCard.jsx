import { Link } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";

function riskTone(score) {
  if (score >= 61) return { text: "text-stamp-red", label: "HIGH" };
  if (score >= 21) return { text: "text-stamp-amber", label: "REVIEW" };
  return { text: "text-stamp-green", label: "CLEAR" };
}

function confidenceTone(score) {
  if (score >= 80) return "text-stamp-green bg-stamp-green/15 border-stamp-green/30";
  if (score >= 60) return "text-stamp-amber bg-stamp-amber/15 border-stamp-amber/30";
  return "text-stamp-red bg-stamp-red/15 border-stamp-red/30";
}

const STATUS_STYLES = {
  open: "bg-stamp-red/15 text-stamp-red",
  "in-review": "bg-stamp-amber/15 text-stamp-amber",
  resolved: "bg-stamp-green/15 text-stamp-green",
  escalated: "bg-ink/10 text-ink",
};

const STATUS_LABELS = {
  open: "Open",
  "in-review": "In review",
  resolved: "Resolved",
  escalated: "Escalated",
};

const EXCEPTION_TITLES = {
  duplicate_invoice: "Duplicate Invoice Detected",
  invalid_gstin: "Invalid GSTIN Checksum",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Subtotal Math Calculation Error",
  phantom_vendor: "Unregistered / Phantom Vendor",
  typo_squatting_vendor: "Vendor Name Typo-Squatting",
  pdf_metadata_tamper: "PDF Document Metadata Modified",
  invisible_text_detected: "Hidden Text Detected",
  benford_deviation: "Benford Law Numeric Anomaly",
  vendor_activity_anomaly: "Vendor Volume Anomaly",
};

export default function TicketCard({ ticket, selected, onToggleSelect }) {
  const { mode } = useMode();
  const { text, label } = riskTone(ticket.riskScore);
  const confStyle = confidenceTone(ticket.confidenceScore);

  const displayFlag = mode === "msme"
    ? (EXCEPTION_TITLES[ticket.flag] || ticket.flag)
    : ticket.flag;

  const displayNarrative = mode === "msme"
    ? (ticket.msmeNarrative || ticket.aiNarrative)
    : ticket.aiNarrative;

  return (
    <div className="paper-surface rounded-lg p-4 text-ink flex flex-col items-start gap-4 hover:border-ink-600/40 transition-all">
      <div className="flex items-start gap-4 w-full">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(ticket.id)}
            aria-label={`Select ${ticket.id}`}
            className="mt-2 rounded border-ink-600/30 text-stamp-red focus:ring-stamp-red cursor-pointer"
          />
        )}

        <div
          className={`stamp-badge w-14 h-14 shrink-0 flex flex-col items-center justify-center font-mono font-semibold text-[10px] ${text}`}
        >
          <span className="text-base leading-none font-display font-bold">{ticket.riskScore}</span>
          <span className="mt-0.5 opacity-80">{label}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/invoices/${ticket.invoiceId}`} className="font-mono text-sm font-semibold text-stamp-red hover:underline">
              {ticket.id}
            </Link>
            <span className="text-xs text-ink-600 font-mono px-1.5 py-0.5 rounded bg-ink/5">{ticket.invoiceId}</span>
            <span className="text-xs font-mono text-ink-600 font-semibold">₹{ticket.amount}</span>
          </div>
          
          <p className="text-sm font-medium mt-0.5">{ticket.vendor}</p>
          <p className="text-xs font-mono font-semibold text-ink-600 mt-1">{displayFlag}</p>

          {/* Forensic alert badge — only for metadata/tamper flags */}
          {(ticket.flag === "pdf_metadata_tamper" || ticket.flag === "invisible_text_detected") && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stamp-red/20 text-stamp-red border border-stamp-red/30 animate-pulse">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {ticket.flag === "pdf_metadata_tamper" ? "🔬 Forensic Alert" : "👻 Hidden Text"}
              </span>
            </div>
          )}

          {displayNarrative && (
            <p className={"text-xs mt-1.5 p-2 rounded border font-sans leading-relaxed " + (mode === "msme" ? "bg-stamp-amber/10 border-stamp-amber/30 text-ink" : "bg-ink/5 border-ink-600/10 text-ink-700")}>
              <span className="font-semibold text-[10px] uppercase font-mono tracking-wider block mb-0.5 text-ink-600">
                {mode === "msme" ? "💡 Plain-Language Advice" : "🤖 Technical AI Narrative"}
              </span>
              {displayNarrative}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className={`px-2 py-1 rounded border text-right font-mono ${confStyle}`}>
            <p className="text-[10px] uppercase tracking-wider opacity-70">confidence</p>
            <p className="text-sm font-bold leading-none">{ticket.confidenceScore}%</p>
          </div>

          <span className={`text-xs font-mono px-2 py-1 rounded-full ${STATUS_STYLES[ticket.status]}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
        </div>
      </div>

      <div className="w-full flex gap-2 mt-4 ml-4">
        <Link
          to={`/invoices/${ticket.invoiceId}`}
          className="text-xs font-medium px-4 py-2 rounded-md border border-ink-600/30 text-ink hover:bg-ink-600/10 transition-colors"
        >
          View full invoice &rarr;
        </Link>
        {ticket.evidenceData?.duplicate_invoice_id && (
          <Link
            to={`/invoices/${ticket.invoiceId}/compare/${ticket.evidenceData.duplicate_invoice_id}`}
            className="text-xs font-medium px-4 py-2 rounded-md border border-stamp-amber/40 text-stamp-amber bg-stamp-amber/5 hover:bg-stamp-amber/10 transition-colors"
          >
            Compare side-by-side &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
