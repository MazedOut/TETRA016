import { useEffect, useState } from "react";
import { fetchTickets, submitBulkResolve } from "../api/client.js";
import TicketCard from "../components/TicketCard.jsx";
import RiskConfidenceFilter from "../components/RiskConfidenceFilter.jsx";
import MergeConfirmModal from "../components/MergeConfirmModal.jsx";
import FolderView from "../components/FolderView.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EXCEPTION_LABELS = {
  duplicate_invoice: "Duplicate Invoices",
  invalid_gstin: "Invalid GSTIN Checksums",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Calculation Errors",
  phantom_vendor: "Phantom Vendors",
  typo_squatting_vendor: "Typo-Squatting Vendors",
  pdf_metadata_tamper: "File Metadata Tampering",
  invisible_text_detected: "Hidden Text Spans",
  benford_deviation: "Benford Law Deviations",
  vendor_activity_anomaly: "Vendor Activity Anomalies",
  needs_review: "Needs Human Review",
};

export default function ExceptionQueue() {
  const { mode, canWrite } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [groupBy, setGroupBy] = useState("exception_type"); // "exception_type" | "risk_level" | "invoice" | "flat"
  const [collapsed, setCollapsed] = useState({});
  const [bulkResolving, setBulkResolving] = useState(false);
  const [showFolders, setShowFolders] = useState(false);

  function loadTickets() {
    fetchTickets(filters).then(setTickets);
  }

  useEffect(() => {
    loadTickets();
  }, [filters]);

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selected.length === tickets.length) {
      setSelected([]);
    } else {
      setSelected(tickets.map((t) => t.id));
    }
  }

  function toggleCollapse(groupKey) {
    setCollapsed((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  }

  async function handleBulkResolve() {
    if (selected.length === 0) return;
    setBulkResolving(true);
    try {
      await submitBulkResolve(selected, "Bulk resolved from exception queue");
      setSelected([]);
      loadTickets();
    } catch (err) {
      alert("Failed to bulk resolve tickets");
    } finally {
      setBulkResolving(false);
    }
  }

  // Calculate category summary counts
  const categoryCounts = tickets.reduce((acc, t) => {
    const key = t.flag || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Helper to group tickets according to active groupBy mode
  function getGroupedTickets() {
    if (groupBy === "flat") {
      return [{ key: "all", label: `All Tickets (${tickets.length})`, items: tickets }];
    }

    if (groupBy === "exception_type") {
      const groups = {};
      tickets.forEach((t) => {
        const key = t.flag || "other";
        const label = EXCEPTION_LABELS[key] || key.replace(/_/g, " ").toUpperCase();
        if (!groups[key]) groups[key] = { key, label, items: [] };
        groups[key].items.push(t);
      });
      return Object.values(groups);
    }

    if (groupBy === "risk_level") {
      const groups = {
        high: { key: "high", label: "High Risk (Score ≥ 50)", items: [] },
        review: { key: "review", label: "Review Needed (Score 20-49)", items: [] },
        clear: { key: "clear", label: "Clear / Low Risk (Score < 20)", items: [] },
      };
      tickets.forEach((t) => {
        if (t.riskScore >= 50) groups.high.items.push(t);
        else if (t.riskScore >= 20) groups.review.items.push(t);
        else groups.clear.items.push(t);
      });
      return Object.values(groups).filter((g) => g.items.length > 0);
    }

    if (groupBy === "invoice") {
      const groups = {};
      tickets.forEach((t) => {
        const key = t.invoiceId || "unknown";
        const label = `${t.invoiceId} — ${t.vendor || "Unknown Vendor"}`;
        if (!groups[key]) groups[key] = { key, label, items: [] };
        groups[key].items.push(t);
      });
      return Object.values(groups);
    }

    return [{ key: "all", label: "All Tickets", items: tickets }];
  }

  const grouped = getGroupedTickets();

  return (
    <div className="space-y-6">
      {/* Header & Mode Info */}
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            Exception queue {mode === "msme" && <span className="text-sm font-sans text-stamp-amber font-normal">(MSME Simple View)</span>}
          </h2>
          <p className="text-sm text-paper/60 mt-1">
            {mode === "msme"
              ? "Simple plain-language summaries of supplier invoice issues requiring action."
              : "Sorted by risk score. Group by exception type, risk level, or invoice to audit efficiently."}
          </p>
        </div>

        {/* View & Folder Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFolders(!showFolders)}
            className="px-3 py-1.5 rounded-lg bg-ink-700 hover:bg-ink-600 text-paper text-xs font-mono border border-ink-600 transition-colors"
          >
            {showFolders ? "Hide Folders ▲" : "📁 Folder View ▼"}
          </button>

          <div className="flex items-center gap-1.5 bg-ink-700 p-1 rounded-lg text-xs font-mono">
            <span className="text-paper/60 px-2 text-[11px]">Group by:</span>
            <button
              onClick={() => setGroupBy("exception_type")}
              className={"px-2.5 py-1 rounded transition-colors " + (groupBy === "exception_type" ? "bg-paper text-ink font-semibold" : "text-paper/70 hover:text-paper")}
            >
              Category
            </button>
            <button
              onClick={() => setGroupBy("risk_level")}
              className={"px-2.5 py-1 rounded transition-colors " + (groupBy === "risk_level" ? "bg-paper text-ink font-semibold" : "text-paper/70 hover:text-paper")}
            >
              Risk Level
            </button>
            <button
              onClick={() => setGroupBy("invoice")}
              className={"px-2.5 py-1 rounded transition-colors " + (groupBy === "invoice" ? "bg-paper text-ink font-semibold" : "text-paper/70 hover:text-paper")}
            >
              Invoice
            </button>
            <button
              onClick={() => setGroupBy("flat")}
              className={"px-2.5 py-1 rounded transition-colors " + (groupBy === "flat" ? "bg-paper text-ink font-semibold" : "text-paper/70 hover:text-paper")}
            >
              Flat List
            </button>
          </div>
        </div>
      </div>

      {/* Folder System Component */}
      {showFolders && (
        <FolderView
          selectedFolder={filters.folder}
          onSelectFolder={(f) => setFilters((prev) => ({ ...prev, folder: f }))}
        />
      )}

      {/* Category Summary Quick Badges Bar (High-Contrast Cream Cards) */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="paper-surface rounded-lg p-3 text-ink flex items-center gap-2 flex-wrap text-xs font-mono border border-ink-600/20">
          <span className="text-ink-700 font-bold uppercase text-[10px] tracking-wider mr-1">Category Breakdown:</span>
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <span
              key={cat}
              onClick={() => setGroupBy("exception_type")}
              className="cursor-pointer px-2.5 py-1 rounded-full bg-paper border border-ink-600/30 hover:border-stamp-red flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span className="font-semibold text-ink font-body">{EXCEPTION_LABELS[cat] || cat}:</span>
              <span className="bg-stamp-red text-paper px-1.5 py-0.2 rounded-full font-bold text-[10px]">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Filter Toolbar */}
      <RiskConfidenceFilter onChange={setFilters} />

      {/* Bulk Action Toolbar Banner — Auditor only */}
      {canWrite && selected.length > 0 && (
        <div className="bg-stamp-amber/15 border border-stamp-amber/40 rounded-lg p-3 text-ink flex items-center justify-between flex-wrap gap-3 text-sm font-mono animate-fadeIn">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.length === tickets.length && tickets.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-ink-600/30 text-stamp-red focus:ring-stamp-red"
            />
            <span className="font-bold">{selected.length} ticket(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkResolve}
              disabled={bulkResolving}
              className="bg-stamp-green text-paper px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-stamp-green/90 disabled:opacity-50"
            >
              {bulkResolving ? "Resolving..." : `✓ Bulk Resolve Selected (${selected.length})`}
            </button>

            {selected.length === 2 && (
              <button
                onClick={() => setMergeOpen(true)}
                className="bg-stamp-amber text-ink px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-stamp-amber/90 border border-ink/20 font-sans font-semibold"
              >
                🔀 Propose Merge (2)
              </button>
            )}

            <button
              onClick={() => setSelected([])}
              className="text-xs text-paper/50 hover:text-paper px-2 py-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Grouped / Sectioned Ticket List */}
      <div className="space-y-6">
        {grouped.map((group) => {
          const isCollapsed = !!collapsed[group.key];
          return (
            <div key={group.key} className="space-y-3">
              {/* Section Header */}
              {groupBy !== "flat" && (
                <div
                  onClick={() => toggleCollapse(group.key)}
                  className="flex items-center justify-between cursor-pointer py-2.5 px-3.5 bg-ink-800 rounded-md border border-ink-600/40 hover:border-ink-600 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-paper/60 font-bold">{isCollapsed ? "▶" : "▼"}</span>
                    <h3 className="font-display font-semibold text-base text-paper">{group.label}</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stamp-red/20 text-stamp-red font-bold border border-stamp-red/30">
                      {group.items.length} {group.items.length === 1 ? "ticket" : "tickets"}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-paper/50">
                    {isCollapsed ? "click to expand" : "click to collapse"}
                  </span>
                </div>
              )}

              {/* Group Cards */}
              {!isCollapsed && (
                <div className="space-y-3">
                  {group.items.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      selected={selected.includes(t.id)}
                      onToggleSelect={canWrite ? toggleSelect : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {tickets.length === 0 && (
          <div className="paper-surface rounded-lg p-12 text-center text-ink space-y-2">
            <p className="font-display text-lg font-medium">No exception tickets found</p>
            <p className="text-xs text-ink-600 font-mono">
              Try adjusting your risk/confidence filters or upload a new invoice batch.
            </p>
          </div>
        )}
      </div>

      {mergeOpen && (
        <MergeConfirmModal
          ticketIds={selected}
          aiReason="Both tickets flag the same vendor and invoice pattern within a 40-minute window — likely one underlying event."
          onClose={() => setMergeOpen(false)}
          onDecided={() => setSelected([])}
        />
      )}
    </div>
  );
}
