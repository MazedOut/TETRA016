import { Link } from "react-router-dom";

/**
 * Single exception ticket card: type, risk/confidence, status, link to source doc.
 * Risk and confidence are deliberately rendered as two separate visual
 * languages (a stamp vs. a bar) so they never read as one blended score.
 */

function riskTone(score) {
  if (score >= 61) return { text: "text-stamp-red", label: "HIGH" };
  if (score >= 21) return { text: "text-stamp-amber", label: "REVIEW" };
  return { text: "text-stamp-green", label: "CLEAR" };
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

export default function TicketCard({ ticket, selected, onToggleSelect }) {
  const { text, label } = riskTone(ticket.riskScore);

  return (
    <div className="paper-surface rounded-lg p-4 text-ink flex items-center gap-4">
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(ticket.id)}
          aria-label={`Select ${ticket.id} for merge`}
        />
      )}

      <div
        className={`stamp-badge w-14 h-14 shrink-0 flex flex-col items-center justify-center font-mono font-semibold text-[10px] ${text}`}
      >
        <span className="text-base leading-none font-display font-bold">{ticket.riskScore}</span>
        <span className="mt-0.5 opacity-80">{label}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/invoices/${ticket.invoiceId}`} className="font-mono text-sm text-stamp-red hover:underline">
            {ticket.id}
          </Link>
          <span className="text-xs text-ink-600 font-mono">{ticket.invoiceId}</span>
        </div>
        <p className="text-sm font-medium truncate">{ticket.vendor}</p>
        <p className="text-xs text-ink-600 truncate">{ticket.flag}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-ink-600">confidence</p>
        <p className="font-mono text-sm">{ticket.confidenceScore}%</p>
      </div>

      <span className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${STATUS_STYLES[ticket.status]}`}>
        {STATUS_LABELS[ticket.status]}
      </span>
    </div>
  );
}
