import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchFolders } from "../api/client.js";
import { Building2, ChevronRight, AlertTriangle, Folder } from "lucide-react";

/**
 * Vendors page — vendor listing using fetchFolders() data.
 * Grouped by category, showing invoice count per vendor.
 */
export default function VendorsPage() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchFolders()
      .then((data) => setFolders(data || []))
      .finally(() => setLoading(false));
  }, []);

  // Group by category
  const filtered = folders.filter((f) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (f.vendor || f.folder || "").toLowerCase().includes(q) ||
      (f.category || "").toLowerCase().includes(q)
    );
  });

  const byCategory = filtered.reduce((acc, f) => {
    const cat = f.category || "Uncategorised";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const totalVendors = folders.length;
  const totalInvoices = folders.reduce((s, f) => s + (f.count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-paper">Vendors</h2>
          <p className="text-sm text-paper/60 mt-1">
            {loading
              ? "Loading vendor data…"
              : `${totalVendors} vendors · ${totalInvoices} total invoices`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor or category…"
          className="w-full bg-ink-800 border border-ink-600/50 rounded-lg px-4 py-2.5
                     text-paper text-sm font-sans placeholder-paper/30
                     focus:outline-none focus:border-ink-600 transition-colors"
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-ink-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* Vendor grid by category */}
      {!loading && Object.keys(byCategory).length === 0 && (
        <div className="paper-surface rounded-xl p-12 text-ink text-center space-y-3">
          <Building2 size={36} className="mx-auto text-ink-600" strokeWidth={1.2} />
          <p className="font-display text-lg font-semibold">
            {search ? "No vendors match your search" : "No vendors found"}
          </p>
          <p className="text-sm text-ink-600 font-sans">
            Upload invoice batches to automatically classify vendors.
          </p>
        </div>
      )}

      {!loading &&
        Object.entries(byCategory).map(([category, vendors]) => (
          <div key={category} className="space-y-3">
            {/* Category heading */}
            <div className="flex items-center gap-3">
              <Folder size={14} className="text-ink-600" strokeWidth={1.8} />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-ink-600">
                {category}
              </h3>
              <div className="flex-1 h-px bg-ink-700/60" />
              <span className="text-[10px] font-mono text-ink-600">
                {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Vendor cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vendors.map((f) => {
                const vendorName = f.vendor || f.folder;
                const flagged = f.flagged_count || 0;
                return (
                  <Link
                    key={f.folder}
                    to={`/folders/${encodeURIComponent(f.folder)}`}
                    className="block bg-ink-800 border border-ink-600/30 rounded-xl p-4
                               hover:border-ink-600/70 hover:bg-ink-700/60
                               transition-all duration-150 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2
                            size={13}
                            className="text-ink-600 shrink-0"
                            strokeWidth={1.8}
                          />
                          <p className="text-sm font-semibold text-paper truncate">
                            {vendorName}
                          </p>
                        </div>
                        <p className="text-xs font-mono text-ink-600 mt-1.5">
                          <span className="font-bold text-paper/70">{f.count || 0}</span>
                          {" "}invoice{(f.count || 0) !== 1 ? "s" : ""}
                          {flagged > 0 && (
                            <span className="ml-2 text-stamp-amber">
                              · {flagged} flagged
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-ink-600 group-hover:text-paper/60 shrink-0 mt-0.5 transition-colors"
                        strokeWidth={1.8}
                      />
                    </div>
                    {flagged > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-stamp-amber">
                        <AlertTriangle size={10} strokeWidth={2} />
                        {flagged} invoice{flagged !== 1 ? "s" : ""} flagged for review
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
