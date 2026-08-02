import { useEffect, useState } from "react";
import { fetchMsmeCountdown, markMsmePaid } from "../api/client.js";
import { fmtCurrency } from "../utils/format.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";

/**
 * MsmeCountdown — Live 45-day MSME payment deadline worklist.
 * Shows invoices sorted by urgency (days remaining ascending, then exposure descending).
 * Color-coded: Green (25+ days), Yellow (10-24 days), Red (<10 days).
 */

const URGENCY_STYLES = {
  green: {
    row: "border-l-4 border-stamp-green bg-stamp-green/5",
    badge: "bg-stamp-green/15 text-stamp-green border-stamp-green/30",
    label: "On Track",
    icon: "✅",
  },
  yellow: {
    row: "border-l-4 border-stamp-amber bg-stamp-amber/5",
    badge: "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30",
    label: "Approaching",
    icon: "⚠️",
  },
  red: {
    row: "border-l-4 border-stamp-red bg-stamp-red/5",
    badge: "bg-stamp-red/15 text-stamp-red border-stamp-red/30",
    label: "Action Required",
    icon: "🚨",
  },
};

function CountdownBar({ daysRemaining }) {
  const total = 45;
  const elapsed = total - daysRemaining;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const color =
    daysRemaining >= 25
      ? "bg-stamp-green"
      : daysRemaining >= 10
      ? "bg-stamp-amber"
      : "bg-stamp-red";

  return (
    <div className="w-full h-1.5 bg-ink-600/20 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MsmeCountdown() {
  const { canWrite } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const result = await fetchMsmeCountdown();
      setData(result);
      setError(null);
    } catch (err) {
      setError("Failed to load MSME countdown data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMarkPaid(invoiceId) {
    if (!window.confirm(`Mark ${invoiceId} as paid? This will resolve all open tickets.`))
      return;
    setMarkingPaid(invoiceId);
    try {
      await markMsmePaid(invoiceId);
      // Remove from list immediately for snappy UX
      setData((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.invoiceId !== invoiceId),
        count: prev.count - 1,
        totalExposure:
          prev.totalExposure -
          (prev.items.find((i) => i.invoiceId === invoiceId)?.financialExposure || 0),
      }));
    } catch (err) {
      alert("Failed to mark as paid. Please try again.");
    } finally {
      setMarkingPaid(null);
    }
  }

  if (loading) {
    return (
      <div className="paper-surface rounded-xl p-6 text-ink">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-ink-600/30 border-t-stamp-red rounded-full animate-spin" />
          <span className="text-sm text-ink-600 font-mono">Loading MSME countdown...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="paper-surface rounded-xl p-6 text-ink">
        <p className="text-sm text-stamp-red font-mono">{error}</p>
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="paper-surface rounded-xl p-6 text-ink">
        <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
          <span>📅</span> MSME 45-Day Payment Tracker
        </h3>
        <div className="bg-stamp-green/10 border border-stamp-green/30 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
          <span className="text-stamp-green">✅</span>
          <span className="text-stamp-green font-medium">
            All invoices are within the safe payment window. No action required.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-surface rounded-xl p-6 text-ink space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <span>📅</span> MSME 45-Day Payment Tracker
          </h3>
          <p className="text-xs font-mono text-ink-600 mt-0.5">
            Section 43B(h) compliance — prioritized by urgency
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs font-mono px-3 py-1.5 rounded-lg bg-ink/5 border border-ink-600/20
                     hover:bg-ink/10 text-ink-600 hover:text-ink transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary Alert */}
      <div className="bg-stamp-red/10 border border-stamp-red/30 rounded-lg px-4 py-3">
        <p className="text-sm font-semibold text-stamp-red">
          {fmtCurrency(data.totalExposure)} in tax deductions at risk
          {data.atRiskThisWeek > 0 && (
            <span>
              {" "}
              this week if{" "}
              <span className="font-bold underline underline-offset-2">
                {data.atRiskThisWeek} invoice{data.atRiskThisWeek !== 1 ? "s" : ""}
              </span>{" "}
              {data.atRiskThisWeek !== 1 ? "aren't" : "isn't"} paid.
            </span>
          )}
        </p>
        <p className="text-xs text-stamp-red/70 font-mono mt-1">
          {data.count} invoice{data.count !== 1 ? "s" : ""} pending payment across all
          urgency levels
        </p>
      </div>

      {/* Invoice List */}
      <div className="space-y-2">
        {data.items.map((item) => {
          const style = URGENCY_STYLES[item.urgency] || URGENCY_STYLES.yellow;
          const isOverdue = item.daysRemaining < 0;
          const isPaying = markingPaid === item.invoiceId;

          return (
            <div
              key={item.invoiceId}
              className={`rounded-lg p-4 ${style.row} transition-all duration-150 hover:shadow-sm`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Left: Invoice info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/invoices/${item.invoiceId}`}
                      className="font-mono text-sm font-semibold text-stamp-red hover:underline"
                    >
                      {item.invoiceId}
                    </Link>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${style.badge}`}
                    >
                      {style.icon} {style.label}
                    </span>
                    {isOverdue && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stamp-red text-paper animate-pulse">
                        OVERDUE
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium mt-1 truncate">{item.vendor}</p>

                  <div className="flex items-center gap-4 mt-2 text-xs font-mono text-ink-600">
                    <span>
                      Invoiced: <span className="font-semibold text-ink">{item.invoiceDate}</span>
                    </span>
                    <span>
                      Amount:{" "}
                      <span className="font-semibold text-ink">
                        {fmtCurrency(item.amount)}
                      </span>
                    </span>
                    <span>
                      Exposure:{" "}
                      <span className="font-semibold text-stamp-red">
                        {fmtCurrency(item.financialExposure)}
                      </span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <CountdownBar daysRemaining={item.daysRemaining} />
                    </div>
                    <span className="text-xs font-mono font-bold shrink-0">
                      {isOverdue ? (
                        <span className="text-stamp-red">
                          {Math.abs(item.daysRemaining)}d overdue
                        </span>
                      ) : (
                        <span
                          className={
                            item.daysRemaining < 10
                              ? "text-stamp-red"
                              : item.daysRemaining < 25
                              ? "text-stamp-amber"
                              : "text-stamp-green"
                          }
                        >
                          {item.daysRemaining}d left
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Red urgency label */}
                  {item.urgency === "red" && (
                    <p className="text-[11px] font-semibold text-stamp-red mt-2">
                      ⚠ Action Required: Pay now or lose deduction
                    </p>
                  )}
                </div>

                {/* Right: Action button */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {canWrite && (
                    <button
                      onClick={() => handleMarkPaid(item.invoiceId)}
                      disabled={isPaying}
                      className="bg-stamp-green text-paper px-4 py-2 rounded-lg text-xs font-semibold
                                 hover:bg-stamp-green/90 active:scale-[0.97] disabled:opacity-50
                                 transition-all duration-150 shadow-sm"
                    >
                      {isPaying ? "Marking..." : "✓ Mark as Paid"}
                    </button>
                  )}
                  <Link
                    to={`/invoices/${item.invoiceId}`}
                    className="text-[11px] font-mono text-ink-600 hover:text-ink hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
