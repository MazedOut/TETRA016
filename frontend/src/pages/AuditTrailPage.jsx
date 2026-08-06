import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchTickets, fetchAuditTrail } from "../api/client.js";
import { Clock, Search, FileText, ChevronRight, Shield } from "lucide-react";

/**
 * Global Audit Trail page.
 * Search for an invoice → view its full audit trail.
 * Per-invoice audit trail slide-out is still available in InvoiceDetail.
 */
export default function AuditTrailPage() {
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [trail, setTrail] = useState(null);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [auditFilter, setAuditFilter] = useState("all");

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    setSelectedInvoice(null);
    setTrail(null);
    try {
      const results = await fetchTickets({ query: query.trim() });
      setTickets(results || []);
    } catch {
      setTickets([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  async function selectInvoice(ticket) {
    setSelectedInvoice(ticket);
    setTrail(null);
    setLoadingTrail(true);
    setAuditFilter("all");
    try {
      const result = await fetchAuditTrail(ticket.invoiceId);
      setTrail(result.events || []);
    } catch {
      setTrail([]);
    } finally {
      setLoadingTrail(false);
    }
  }

  const filteredTrail = trail
    ? trail.filter((e) => auditFilter === "all" || e.category === auditFilter)
    : [];

  const CATEGORY_COLORS = {
    pipeline: "border-paper/30 bg-paper/10",
    validation: "border-stamp-amber/50 bg-stamp-amber/10",
    forensics: "border-stamp-red/50 bg-stamp-red/10",
    scoring: "border-paper/30 bg-paper/10",
    ai: "border-stamp-amber/50 bg-stamp-amber/10",
    security: "border-stamp-green/50 bg-stamp-green/10",
    audit: "border-paper/30 bg-paper/10",
  };

  const CATEGORY_DOT = {
    pipeline: "border-paper/40",
    validation: "border-stamp-amber",
    forensics: "border-stamp-red",
    scoring: "border-paper/40",
    ai: "border-stamp-amber",
    security: "border-stamp-green",
    audit: "border-paper/40",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-semibold text-paper">Audit Trail</h2>
        <p className="text-sm text-paper/60 mt-1">
          Search for an invoice to view its complete audit history and SHA-256 integrity record.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-paper/30"
            strokeWidth={2}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Invoice number, vendor name, or GSTIN…"
            className="w-full bg-ink-800 border border-ink-600/50 rounded-lg pl-9 pr-4 py-2.5
                       text-paper text-sm font-sans placeholder-paper/30
                       focus:outline-none focus:border-ink-600 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="bg-stamp-red text-paper px-5 py-2.5 rounded-lg text-sm font-medium
                     hover:bg-stamp-red/90 active:scale-[0.97] disabled:opacity-50
                     transition-all duration-150"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Results + trail two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: search results */}
        <div className="space-y-3">
          {!searched && !searching && (
            <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-8 text-center space-y-3">
              <Clock size={32} className="mx-auto text-ink-600" strokeWidth={1.2} />
              <p className="text-sm font-medium text-paper/60">
                Search for an invoice to view its audit trail
              </p>
            </div>
          )}

          {searching && (
            <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-6 text-center">
              <div className="w-5 h-5 border-2 border-paper/20 border-t-paper/60 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-paper/50 mt-3 font-mono">Searching…</p>
            </div>
          )}

          {searched && tickets.length === 0 && (
            <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-8 text-center space-y-2">
              <FileText size={28} className="mx-auto text-ink-600" strokeWidth={1.2} />
              <p className="text-sm font-medium text-paper/70">No invoices found</p>
              <p className="text-xs text-paper/40 font-mono">
                Try a different invoice number or vendor name
              </p>
            </div>
          )}

          {tickets.map((t) => {
            const isSelected = selectedInvoice?.invoiceId === t.invoiceId;
            return (
              <button
                key={t.id}
                onClick={() => selectInvoice(t)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? "bg-ink-700 border-ink-600"
                    : "bg-ink-800 border-ink-600/30 hover:border-ink-600/60 hover:bg-ink-700/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-paper truncate">
                      {t.invoiceId}
                    </p>
                    <p className="text-xs text-paper/60 mt-0.5 truncate">{t.vendor}</p>
                    <p className="text-[10px] font-mono text-ink-600 mt-1">{t.flag}</p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`shrink-0 mt-0.5 transition-colors ${
                      isSelected ? "text-paper/60" : "text-ink-600"
                    }`}
                    strokeWidth={1.8}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: audit trail */}
        <div className="lg:col-span-2">
          {!selectedInvoice && (
            <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-12 text-center space-y-3 h-full flex flex-col items-center justify-center">
              <Shield size={36} className="text-ink-600" strokeWidth={1.2} />
              <p className="text-sm font-medium text-paper/60">
                Select an invoice to view its audit trail
              </p>
              <p className="text-xs text-paper/30 font-mono max-w-xs text-center">
                Every action is recorded and SHA-256 sealed for tamper-evidence
              </p>
            </div>
          )}

          {selectedInvoice && (
            <div className="bg-ink-800 border border-ink-600/30 rounded-xl overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-ink-600/30">
                <div>
                  <h3 className="font-display text-base font-semibold text-paper">
                    {selectedInvoice.invoiceId}
                  </h3>
                  <p className="text-xs font-mono text-paper/40 mt-0.5">
                    {selectedInvoice.vendor} · {trail?.length ?? "…"} events
                  </p>
                </div>
                <Link
                  to={`/invoices/${selectedInvoice.invoiceId}`}
                  className="text-xs font-mono text-paper/50 hover:text-paper transition-colors
                             px-3 py-1.5 rounded-md hover:bg-ink-700/60 flex items-center gap-1.5"
                >
                  Open investigation
                  <ChevronRight size={11} strokeWidth={2} />
                </Link>
              </div>

              {/* Category filter */}
              <div className="px-5 py-3 border-b border-ink-600/20 flex gap-1.5 flex-wrap">
                {["all", "pipeline", "validation", "forensics", "scoring", "ai", "security", "audit"].map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setAuditFilter(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                        auditFilter === cat
                          ? "bg-paper/10 text-paper font-semibold"
                          : "text-paper/40 hover:text-paper/70 hover:bg-ink-700/50"
                      }`}
                    >
                      {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  )
                )}
              </div>

              {/* Timeline */}
              <div className="px-5 py-4 max-h-[560px] overflow-y-auto">
                {loadingTrail && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-paper/20 border-t-paper/60 rounded-full animate-spin" />
                  </div>
                )}

                {!loadingTrail && filteredTrail.length === 0 && (
                  <p className="text-center text-paper/40 text-sm font-mono py-8">
                    No events for this filter
                  </p>
                )}

                {!loadingTrail && filteredTrail.length > 0 && (
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-ink-600/40" />
                    <div className="space-y-1">
                      {filteredTrail.map((event, i) => {
                        const time = event.timestamp
                          ? new Date(event.timestamp).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            })
                          : "";
                        const date = event.timestamp
                          ? new Date(event.timestamp).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "";
                        const dotColor = CATEGORY_DOT[event.category] || "border-paper/30";
                        return (
                          <div key={i} className="relative pl-10 py-2.5 group">
                            <div
                              className={`absolute left-2.5 top-3.5 w-3 h-3 rounded-full border-2 bg-ink-800 ${dotColor}
                                         group-hover:scale-125 transition-transform`}
                            />
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {event.icon && (
                                    <span className="text-sm">{event.icon}</span>
                                  )}
                                  <span className="text-sm font-semibold text-paper">
                                    {event.label}
                                  </span>
                                </div>
                                {event.detail && (
                                  <p className="text-xs text-paper/50 font-mono mt-0.5 break-words">
                                    {event.detail}
                                  </p>
                                )}
                                <p className="text-[10px] text-paper/30 font-mono mt-0.5">
                                  {event.actor !== "system" && (
                                    <span className="text-stamp-amber">{event.actor} · </span>
                                  )}
                                  {date} {time}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SHA integrity footer */}
              <div className="px-5 py-3 border-t border-ink-600/20 flex items-center gap-2">
                <Shield size={12} className="text-stamp-green" strokeWidth={2} />
                <span className="text-[10px] font-mono text-stamp-green/70">
                  SHA-256 integrity sealing active
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
