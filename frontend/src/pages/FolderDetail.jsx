import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchFolderInvoices } from "../api/client.js";

const RISK_COLORS = {
  high: { badge: "bg-stamp-red/15 text-stamp-red border-stamp-red/30", dot: "bg-stamp-red" },
  medium: { badge: "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30", dot: "bg-stamp-amber" },
  low: { badge: "bg-stamp-green/15 text-stamp-green border-stamp-green/30", dot: "bg-stamp-green" },
};

export default function FolderDetail() {
  const { folderName } = useParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("risk"); // "risk" | "date" | "amount"

  useEffect(() => {
    fetchFolderInvoices(decodeURIComponent(folderName))
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [folderName]);

  const sorted = [...invoices].sort((a, b) => {
    if (sortBy === "risk") return (b.riskScore || 0) - (a.riskScore || 0);
    if (sortBy === "amount") return parseFloat(b.amount) - parseFloat(a.amount);
    if (sortBy === "date") return (b.date || "").localeCompare(a.date || "");
    return 0;
  });

  const highCount = invoices.filter((i) => i.riskLevel === "high").length;
  const openTicketTotal = invoices.reduce((sum, i) => sum + (i.openTickets || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-paper/50 text-sm font-mono mb-1">
            <Link to="/exceptions" className="hover:text-paper transition-colors">
              Exception Queue
            </Link>
            <span>/</span>
            <span>Folders</span>
            <span>/</span>
            <span className="text-paper">{decodeURIComponent(folderName)}</span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-paper">
            📁 {decodeURIComponent(folderName)}
          </h2>
          <p className="text-sm text-paper/60 font-mono mt-1">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} in this folder
          </p>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-3 flex-wrap">
          {highCount > 0 && (
            <div className="bg-stamp-red/15 border border-stamp-red/30 text-stamp-red rounded-lg px-4 py-2 text-center">
              <p className="text-lg font-display font-bold">{highCount}</p>
              <p className="text-[10px] font-mono uppercase">High Risk</p>
            </div>
          )}
          {openTicketTotal > 0 && (
            <div className="bg-stamp-amber/15 border border-stamp-amber/30 text-stamp-amber rounded-lg px-4 py-2 text-center">
              <p className="text-lg font-display font-bold">{openTicketTotal}</p>
              <p className="text-[10px] font-mono uppercase">Open Tickets</p>
            </div>
          )}
          <div className="bg-ink-800 border border-ink-600/30 text-paper rounded-lg px-4 py-2 text-center">
            <p className="text-lg font-display font-bold">{invoices.length}</p>
            <p className="text-[10px] font-mono uppercase">Total</p>
          </div>
        </div>
      </div>

      {/* Sort controls */}
      {invoices.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-paper/50 uppercase tracking-widest">Sort by:</span>
          {[
            { key: "risk", label: "Risk Score" },
            { key: "amount", label: "Amount" },
            { key: "date", label: "Date" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
                sortBy === key
                  ? "bg-paper text-ink border-paper"
                  : "text-paper/60 border-ink-600/40 hover:text-paper hover:border-ink-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Invoice Table */}
      {loading ? (
        <div className="text-center py-16 text-paper/40 font-mono text-sm">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="paper-surface rounded-lg p-10 text-center text-ink/50">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-display text-lg text-ink">No invoices in this folder yet</p>
          <p className="text-sm font-mono text-ink-600 mt-1">
            Invoices are auto-sorted on upload, or you can manually assign them from the Invoice Detail page.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-4 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-paper/40">
            <span>Invoice / Vendor</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Risk</span>
            <span>Open Tickets</span>
            <span></span>
          </div>

          {sorted.map((inv) => {
            const risk = RISK_COLORS[inv.riskLevel] ?? RISK_COLORS.low;
            return (
              <div
                key={inv.id}
                className="bg-ink-800 border border-ink-600/30 rounded-lg hover:border-ink-600/60 transition-all"
              >
                <Link
                  to={`/invoices/${inv.id}`}
                  className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3.5"
                >
                  {/* Invoice / Vendor */}
                  <div>
                    <p className="font-mono font-semibold text-stamp-red text-sm">{inv.invoiceNumber}</p>
                    <p className="text-paper/70 text-xs font-sans mt-0.5">{inv.vendor}</p>
                  </div>

                  {/* Date */}
                  <p className="text-paper/60 text-xs font-mono">{inv.date ?? "—"}</p>

                  {/* Amount */}
                  <p className="text-paper font-mono font-semibold text-sm">
                    ₹{parseFloat(inv.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>

                  {/* Risk */}
                  <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border ${risk.badge}`}>
                    {inv.riskScore} {inv.riskLevel?.toUpperCase()}
                  </span>

                  {/* Open tickets */}
                  <span className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full text-center min-w-[2.5rem] ${
                    inv.openTickets > 0
                      ? "bg-stamp-amber/15 text-stamp-amber border border-stamp-amber/30"
                      : "bg-ink-700 text-paper/40 border border-transparent"
                  }`}>
                    {inv.openTickets > 0 ? inv.openTickets : "—"}
                  </span>

                  {/* Arrow */}
                  <span className="text-paper/30 text-sm">→</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
