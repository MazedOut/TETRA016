import { useEffect, useState } from "react";
import { fetchTickets, submitBulkResolve } from "../api/client.js";
import TicketCard from "../components/TicketCard.jsx";
import RiskConfidenceFilter from "../components/RiskConfidenceFilter.jsx";
import MergeConfirmModal from "../components/MergeConfirmModal.jsx";
import FolderView from "../components/FolderView.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Search,
  SlidersHorizontal,
  CheckCheck,
  GitMerge,
  X,
  ChevronDown,
  ChevronUp,
  Folder,
} from "lucide-react";

// Human-readable exception type labels (for category grouping)
const EXCEPTION_LABELS = {
  duplicate_invoice: "Duplicate Invoices",
  invalid_gstin: "Invalid GSTIN",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Calculation Errors",
  phantom_vendor: "Phantom Vendors",
  typo_squatting_vendor: "Vendor Typo-Squatting",
  pdf_metadata_tamper: "Document Metadata Anomaly",
  invisible_text_detected: "Hidden Text Detected",
  benford_deviation: "Benford Law Deviation",
  vendor_activity_anomaly: "Vendor Activity Anomaly",
  needs_review: "Needs Review",
};

// Risk level filter chips config
const RISK_CHIPS = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical", min: 75 },
  { key: "high", label: "High", min: 50, max: 74 },
  { key: "medium", label: "Medium", min: 25, max: 49 },
  { key: "low", label: "Low", max: 24 },
];

const CHIP_ACTIVE = {
  all: "bg-paper/10 text-paper border-paper/20",
  critical: "bg-stamp-red/20 text-stamp-red border-stamp-red/40",
  high: "bg-stamp-red/10 text-stamp-red border-stamp-red/20",
  medium: "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30",
  low: "bg-stamp-green/15 text-stamp-green border-stamp-green/30",
};
const CHIP_INACTIVE =
  "bg-transparent text-paper/40 border-ink-600/30 hover:border-ink-600/60 hover:text-paper/70";

export default function ExceptionQueue() {
  const { mode, canWrite } = useAuth();
  const isMsme = mode === "msme";

  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [groupBy, setGroupBy] = useState("exception_type");
  const [collapsed, setCollapsed] = useState({});
  const [bulkResolving, setBulkResolving] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [riskChip, setRiskChip] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  function loadTickets() {
    const params = { ...filters };
    if (searchQuery.trim()) params.query = searchQuery.trim();
    fetchTickets(params).then(setTickets);
  }

  useEffect(() => {
    loadTickets();
  }, [filters]);

  // Filter tickets client-side by risk chip
  const displayTickets = tickets.filter((t) => {
    const chip = RISK_CHIPS.find((c) => c.key === riskChip);
    if (!chip || riskChip === "all") return true;
    if (chip.min !== undefined && t.riskScore < chip.min) return false;
    if (chip.max !== undefined && t.riskScore > chip.max) return false;
    return true;
  });

  function handleSearch(e) {
    e.preventDefault();
    loadTickets();
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selected.length === displayTickets.length) {
      setSelected([]);
    } else {
      setSelected(displayTickets.map((t) => t.id));
    }
  }

  function toggleCollapse(key) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleBulkResolve() {
    if (selected.length === 0) return;
    setBulkResolving(true);
    try {
      await submitBulkResolve(selected, "Bulk resolved from review queue");
      setSelected([]);
      loadTickets();
    } catch {
      // silent — keep existing behavior
    } finally {
      setBulkResolving(false);
    }
  }

  // Grouping
  function getGrouped() {
    if (groupBy === "flat") {
      return [{ key: "all", label: `All (${displayTickets.length})`, items: displayTickets }];
    }
    if (groupBy === "exception_type") {
      const groups = {};
      displayTickets.forEach((t) => {
        const key = t.flag || "other";
        const label = EXCEPTION_LABELS[key] || key.replace(/_/g, " ");
        if (!groups[key]) groups[key] = { key, label, items: [] };
        groups[key].items.push(t);
      });
      return Object.values(groups).sort((a, b) => b.items.length - a.items.length);
    }
    if (groupBy === "risk_level") {
      const groups = {
        critical: { key: "critical", label: "Critical (Score ≥ 75)", items: [] },
        high: { key: "high", label: "High (Score 50–74)", items: [] },
        medium: { key: "medium", label: "Medium (Score 25–49)", items: [] },
        low: { key: "low", label: "Low (Score < 25)", items: [] },
      };
      displayTickets.forEach((t) => {
        if (t.riskScore >= 75) groups.critical.items.push(t);
        else if (t.riskScore >= 50) groups.high.items.push(t);
        else if (t.riskScore >= 25) groups.medium.items.push(t);
        else groups.low.items.push(t);
      });
      return Object.values(groups).filter((g) => g.items.length > 0);
    }
    if (groupBy === "invoice") {
      const groups = {};
      displayTickets.forEach((t) => {
        const key = t.invoiceId || "unknown";
        if (!groups[key])
          groups[key] = { key, label: `${t.invoiceId} — ${t.vendor || "Unknown"}`, items: [] };
        groups[key].items.push(t);
      });
      return Object.values(groups);
    }
    return [{ key: "all", label: "All", items: displayTickets }];
  }

  const grouped = getGrouped();

  // Group-by tabs
  const GROUP_TABS = [
    { key: "exception_type", label: "By Type" },
    { key: "risk_level", label: "By Risk" },
    { key: "invoice", label: "By Invoice" },
    { key: "flat", label: "All" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper">
            Review Queue
            {isMsme && (
              <span className="ml-3 text-sm font-sans font-normal text-stamp-amber">
                MSME View
              </span>
            )}
          </h2>
          <p className="text-sm text-paper/50 mt-1">
            {isMsme
              ? "Plain-language summaries of invoice issues requiring your attention."
              : `${displayTickets.length} exception${displayTickets.length !== 1 ? "s" : ""} · sorted by risk score`}
          </p>
        </div>

        {/* Folder toggle */}
        <button
          onClick={() => setShowFolders(!showFolders)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border
                       transition-all duration-150
                       ${showFolders
                         ? "bg-ink-700 border-ink-600 text-paper"
                         : "bg-transparent border-ink-600/30 text-paper/50 hover:border-ink-600/60 hover:text-paper/70"
                       }`}
        >
          <Folder size={13} strokeWidth={1.8} />
          {showFolders ? "Hide Folders" : "Folder View"}
        </button>
      </div>

      {/* Folder system */}
      {showFolders && (
        <FolderView
          selectedFolder={filters.folder}
          onSelectFolder={(f) => setFilters((prev) => ({ ...prev, folder: f }))}
        />
      )}

      {/* ── Search + Risk filter chips ── */}
      <div className="space-y-3">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-paper/30"
              strokeWidth={2}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice number, vendor, or GSTIN…"
              className="w-full bg-ink-800 border border-ink-600/40 rounded-lg pl-9 pr-4 py-2.5
                         text-paper text-sm font-sans placeholder-paper/25
                         focus:outline-none focus:border-ink-600 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="bg-ink-700 border border-ink-600/40 text-paper/70 px-4 py-2.5
                       rounded-lg text-sm font-medium hover:bg-ink-600/60 hover:text-paper
                       transition-all duration-150 flex items-center gap-2"
          >
            <Search size={13} strokeWidth={2} />
            Search
          </button>

          {/* Advanced filter toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`border px-3 py-2.5 rounded-lg text-sm transition-all duration-150
                         flex items-center gap-1.5 font-medium
                         ${showAdvancedFilter
                           ? "bg-ink-700 border-ink-600 text-paper"
                           : "bg-transparent border-ink-600/30 text-paper/40 hover:text-paper/70 hover:border-ink-600/60"
                         }`}
          >
            <SlidersHorizontal size={13} strokeWidth={1.8} />
            Filters
          </button>
        </form>

        {/* Risk filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {RISK_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setRiskChip(chip.key)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150
                           ${riskChip === chip.key ? CHIP_ACTIVE[chip.key] : CHIP_INACTIVE}`}
            >
              {chip.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Group-by selector */}
          <div className="flex items-center gap-1 bg-ink-700/60 p-0.5 rounded-lg border border-ink-600/30">
            {GROUP_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setGroupBy(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                             ${groupBy === tab.key
                               ? "bg-ink-600 text-paper"
                               : "text-paper/40 hover:text-paper/70"
                             }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced filter panel */}
      {showAdvancedFilter && (
        <div className="animate-fadeIn">
          <RiskConfidenceFilter onChange={setFilters} />
        </div>
      )}

      {/* ── Bulk action bar (auditor only) ── */}
      {canWrite && selected.length > 0 && (
        <div
          className="bg-ink-800 border border-stamp-amber/30 rounded-xl p-3
                     flex items-center justify-between flex-wrap gap-3 animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.length === displayTickets.length && displayTickets.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-ink-600/50 text-stamp-red focus:ring-stamp-red accent-stamp-red"
            />
            <span className="text-sm font-medium text-paper">
              {selected.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkResolve}
              disabled={bulkResolving}
              className="flex items-center gap-1.5 bg-stamp-green text-paper px-4 py-2 rounded-lg
                         text-xs font-medium hover:bg-stamp-green/90 active:scale-[0.97]
                         disabled:opacity-50 transition-all duration-150"
            >
              <CheckCheck size={13} strokeWidth={2} />
              {bulkResolving ? "Resolving…" : `Resolve ${selected.length}`}
            </button>
            {selected.length === 2 && (
              <button
                onClick={() => setMergeOpen(true)}
                className="flex items-center gap-1.5 border border-stamp-amber/40 text-stamp-amber
                           bg-stamp-amber/5 hover:bg-stamp-amber/10 px-4 py-2 rounded-lg
                           text-xs font-medium transition-all duration-150"
              >
                <GitMerge size={13} strokeWidth={2} />
                Propose Merge
              </button>
            )}
            <button
              onClick={() => setSelected([])}
              className="p-2 text-paper/40 hover:text-paper/70 rounded-md hover:bg-ink-700/50
                         transition-colors"
              aria-label="Deselect all"
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Ticket groups ── */}
      <div className="space-y-6">
        {grouped.map((group) => {
          const isCollapsed = !!collapsed[group.key];
          return (
            <div key={group.key} className="space-y-3">
              {/* Group section header */}
              {groupBy !== "flat" && (
                <button
                  onClick={() => toggleCollapse(group.key)}
                  className="w-full flex items-center justify-between py-2.5 px-4
                             bg-ink-800/60 hover:bg-ink-800 border border-ink-600/20
                             hover:border-ink-600/50 rounded-xl transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronDown size={13} className="text-paper/40" strokeWidth={2} />
                    ) : (
                      <ChevronUp size={13} className="text-paper/40" strokeWidth={2} />
                    )}
                    <h3 className="text-sm font-semibold text-paper">{group.label}</h3>
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full
                                   bg-stamp-red/15 text-stamp-red border border-stamp-red/20"
                    >
                      {group.items.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-paper/30">
                    {isCollapsed ? "expand" : "collapse"}
                  </span>
                </button>
              )}

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

        {/* Empty state */}
        {displayTickets.length === 0 && (
          <div className="bg-ink-800 border border-ink-600/20 rounded-xl p-12 text-center space-y-3">
            <CheckCheck size={36} className="mx-auto text-stamp-green/40" strokeWidth={1.2} />
            <p className="font-display text-lg font-semibold text-paper">
              No exceptions found
            </p>
            <p className="text-sm text-paper/40 font-sans max-w-xs mx-auto">
              {searchQuery || riskChip !== "all"
                ? "Try adjusting your filters or search query."
                : "All invoices are clear. Upload a new batch to continue screening."}
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
