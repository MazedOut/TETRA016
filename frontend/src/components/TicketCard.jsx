import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fmtCurrency } from "../utils/format.js";
import FindingRow from "./FindingRow.jsx";
import {
  ShieldAlert,
  ChevronRight,
  GitCompare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  FileSearch,
} from "lucide-react";

// ─── Risk level config ───────────────────────────────────────────────────────
function riskConfig(score) {
  if (score >= 75)
    return {
      label: "CRITICAL",
      pill: "bg-stamp-red/15 text-stamp-red border-stamp-red/30",
      bar: "bg-stamp-red",
      text: "text-stamp-red",
    };
  if (score >= 50)
    return {
      label: "HIGH",
      pill: "bg-stamp-red/10 text-stamp-red border-stamp-red/20",
      bar: "bg-stamp-red",
      text: "text-stamp-red",
    };
  if (score >= 25)
    return {
      label: "MEDIUM",
      pill: "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30",
      bar: "bg-stamp-amber",
      text: "text-stamp-amber",
    };
  return {
    label: "LOW",
    pill: "bg-stamp-green/15 text-stamp-green border-stamp-green/30",
    bar: "bg-stamp-green",
    text: "text-stamp-green",
  };
}

const STATUS_CONFIG = {
  open: { label: "Open", icon: AlertTriangle, cls: "text-stamp-red/70" },
  "in-review": { label: "In Review", icon: Eye, cls: "text-stamp-amber/70" },
  resolved: { label: "Resolved", icon: CheckCircle2, cls: "text-stamp-green/70" },
  escalated: { label: "Escalated", icon: Clock, cls: "text-paper/40" },
};

const EXCEPTION_LABELS = {
  duplicate_invoice: "Duplicate Invoice",
  invalid_gstin: "Invalid GSTIN",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Calculation Error",
  phantom_vendor: "Phantom Vendor",
  typo_squatting_vendor: "Vendor Typo-Squatting",
  pdf_metadata_tamper: "Document Metadata Anomaly",
  invisible_text_detected: "Hidden Text Detected",
  benford_deviation: "Benford Law Anomaly",
  vendor_activity_anomaly: "Vendor Activity Anomaly",
  needs_review: "Needs Review",
};

const MSME_EXCEPTION_LABELS = {
  duplicate_invoice: "Possible duplicate invoice",
  invalid_gstin: "GST number may be invalid",
  amount_mismatch: "Invoice amount doesn't match records",
  internal_math_error: "Calculation discrepancy",
  phantom_vendor: "Supplier may not be registered",
  typo_squatting_vendor: "Supplier name looks suspicious",
  pdf_metadata_tamper: "Document may have been modified",
  invisible_text_detected: "Document contains hidden content",
  benford_deviation: "Unusual number pattern",
  vendor_activity_anomaly: "Unusual billing pattern from this supplier",
  needs_review: "Needs review",
};

export default function TicketCard({ ticket, selected, onToggleSelect }) {
  const { mode } = useAuth();
  const risk = riskConfig(ticket.riskScore);
  const isMsme = mode === "msme";

  const flagLabel = isMsme
    ? (MSME_EXCEPTION_LABELS[ticket.flag] || EXCEPTION_LABELS[ticket.flag] || ticket.flag)
    : (EXCEPTION_LABELS[ticket.flag] || ticket.flag);

  const narrative = isMsme
    ? (ticket.msmeNarrative || ticket.aiNarrative)
    : ticket.aiNarrative;

  const statusInfo = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const StatusIcon = statusInfo.icon;

  const isForensic =
    ticket.flag === "pdf_metadata_tamper" || ticket.flag === "invisible_text_detected";

  return (
    <div
      className={`bg-ink-800 border rounded-xl transition-all duration-150 animate-slideUp
                  hover:border-ink-600/70
                  ${selected ? "border-stamp-amber/40 bg-ink-700/60" : "border-ink-600/30"}`}
    >
      {/* ── Card header ── */}
      <div className="p-4 flex items-start gap-3">
        {/* Checkbox (auditor only) */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(ticket.id)}
            aria-label={`Select ${ticket.id}`}
            className="mt-1 rounded border-ink-600/50 text-stamp-red focus:ring-stamp-red
                       cursor-pointer accent-stamp-red shrink-0"
          />
        )}

        {/* Risk score pill */}
        <div
          className={`flex flex-col items-center justify-center shrink-0 min-w-[52px]
                      px-2 py-1.5 rounded-lg border font-mono ${risk.pill}`}
        >
          <span className="text-base font-bold leading-none">{ticket.riskScore}</span>
          <span className="text-[9px] font-bold tracking-wider mt-0.5 opacity-80">
            {risk.label}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-paper/60">
              {ticket.invoiceId}
            </span>
            <span className="text-paper/20">·</span>
            <span className="font-mono text-xs font-semibold text-paper/80">
              {fmtCurrency(ticket.amount)}
            </span>
            {isForensic && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full
                               bg-stamp-red/20 text-stamp-red border border-stamp-red/30">
                Forensic Alert
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-paper mt-0.5 truncate">
            {ticket.vendor}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-paper/50 font-sans">{flagLabel}</span>
            {ticket.financialExposure?.itcAtRisk > 0 && (
              <>
                <span className="text-paper/20">·</span>
                <span className="text-xs font-mono text-stamp-red/80">
                  {fmtCurrency(ticket.financialExposure.itcAtRisk)} ITC at risk
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: confidence + status */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Confidence — visually distinct from risk */}
          <div className="text-right">
            <p className="text-[9px] font-mono text-paper/30 uppercase tracking-wider">
              Extraction
            </p>
            <p className="text-xs font-mono font-bold text-paper/60">
              {ticket.confidenceScore}%
            </p>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-1 text-[10px] font-mono ${statusInfo.cls}`}>
            <StatusIcon size={10} strokeWidth={2} />
            <span>{statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* ── AI narrative (collapsible feel — shown when present) ── */}
      {narrative && (
        <div
          className={`mx-4 mb-3 px-3 py-2.5 rounded-lg border text-xs font-sans leading-relaxed
                      ${isMsme
                        ? "bg-stamp-amber/5 border-stamp-amber/20 text-paper/70"
                        : "bg-ink-700/40 border-ink-600/20 text-paper/60"
                      }`}
        >
          <span
            className={`block text-[10px] font-mono uppercase tracking-wider font-semibold mb-1
                        ${isMsme ? "text-stamp-amber/60" : "text-paper/30"}`}
          >
            {isMsme ? "What this means for you" : "AI Analysis"}
          </span>
          <FindingRow
            flag={{
              type: ticket.flag,
              detail: ticket.aiNarrative,
              rawReason: ticket.rawReason,
              msmeNarrative: ticket.msmeNarrative,
              status: ticket.status,
            }}
            mode={mode}
          />
        </div>
      )}

      {/* ── Risk score bar ── */}
      <div className="mx-4 mb-0.5">
        <div className="h-0.5 w-full bg-ink-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${risk.bar}`}
            style={{ width: `${ticket.riskScore}%` }}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="px-4 py-3 flex items-center gap-2 border-t border-ink-600/20 mt-2">
        <Link
          to={`/invoices/${ticket.invoiceId}`}
          className="flex items-center gap-1.5 text-xs font-medium text-paper/70
                     bg-ink-700/60 hover:bg-ink-700 border border-ink-600/30 hover:border-ink-600
                     px-3 py-1.5 rounded-lg transition-all duration-150 flex-1 justify-center"
        >
          <FileSearch size={12} strokeWidth={2} />
          Review Investigation
          <ChevronRight size={11} strokeWidth={2} />
        </Link>

        {ticket.evidenceData?.duplicate_invoice_id && (
          <Link
            to={`/invoices/${ticket.invoiceId}/compare/${ticket.evidenceData.duplicate_invoice_id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-stamp-amber/70
                       hover:text-stamp-amber border border-stamp-amber/20 hover:border-stamp-amber/40
                       px-3 py-1.5 rounded-lg transition-all duration-150 bg-stamp-amber/5"
          >
            <GitCompare size={12} strokeWidth={2} />
            Compare
          </Link>
        )}
      </div>
    </div>
  );
}
