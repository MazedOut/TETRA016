import { useState } from "react";
import { generateReport } from "../api/client.js";
import { fmtCurrency } from "../utils/format.js";
import { BarChart2, CheckCircle2, ShieldAlert, Download, Clock } from "lucide-react";

/**
 * Reports page — generate and view PDF/CSV style reports.
 */
export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [dateRange, setDateRange] = useState("30");
  const [exceptionTypes, setExceptionTypes] = useState([
    "duplicate_invoice",
    "amount_mismatch",
  ]);

  const EXCEPTION_OPTIONS = [
    { id: "duplicate_invoice", label: "Duplicates" },
    { id: "invalid_gstin", label: "Invalid GSTIN" },
    { id: "amount_mismatch", label: "Amount Mismatches" },
    { id: "phantom_vendor", label: "Phantom Vendors" },
    { id: "pdf_metadata_tamper", label: "Metadata Tampering" },
    { id: "invisible_text_detected", label: "Hidden Text" },
  ];

  function toggleException(id) {
    setExceptionTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (exceptionTypes.length === 0) {
      setError("Please select at least one exception type to include.");
      return;
    }
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const data = await generateReport({ dateRange, types: exceptionTypes });
      setReport(data);
    } catch (err) {
      setError("Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-semibold text-paper">Reports</h2>
        <p className="text-sm text-paper/60 mt-1">
          Generate compliance and exposure reports across your vendor portfolio.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleGenerate} className="bg-ink-800 border border-ink-600/40 rounded-xl p-6 space-y-6">
        {/* Date Range */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40 block">
            Reporting Period
          </label>
          <div className="flex flex-wrap gap-3">
            {[
              { val: "7", label: "Last 7 Days" },
              { val: "30", label: "Last 30 Days" },
              { val: "90", label: "Last 90 Days" },
              { val: "all", label: "All Time" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setDateRange(opt.val)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                            ${
                              dateRange === opt.val
                                ? "bg-ink-700 border-ink-600 text-paper"
                                : "bg-transparent border-ink-600/30 text-paper/50 hover:border-ink-600/60 hover:text-paper"
                            }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exception Types */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40 block">
            Include Exception Types
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {EXCEPTION_OPTIONS.map((opt) => {
              const active = exceptionTypes.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleException(opt.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors
                              ${
                                active
                                  ? "bg-ink-700/60 border-ink-600 text-paper"
                                  : "bg-transparent border-ink-600/30 text-paper/40 hover:border-ink-600/60 hover:text-paper/70"
                              }`}
                >
                  <div
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0
                                ${
                                  active
                                    ? "bg-stamp-red border-stamp-red"
                                    : "border-ink-600/60"
                                }`}
                  >
                    {active && <CheckCircle2 size={12} className="text-ink" strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-stamp-red/10 border border-stamp-red/30 rounded-lg p-3 text-sm text-stamp-red flex items-center gap-2">
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full sm:w-auto bg-stamp-red text-paper
                       px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-stamp-red/90
                       active:scale-[0.97] disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-paper/20 border-t-paper rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <BarChart2 size={16} />
                Generate Report
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      {report && (
        <div className="bg-ink-800 border border-ink-600/40 rounded-xl p-6 space-y-6 animate-slideUp">
          <div className="flex items-center justify-between border-b border-ink-600/30 pb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-paper">Exposure Summary</h3>
              <p className="text-xs text-paper/40 font-mono mt-1">
                Generated {new Date().toLocaleString()}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-ink-700/60 border border-ink-600/40
                               rounded-lg text-sm font-medium text-paper/70 hover:text-paper hover:bg-ink-700 transition-colors">
              <Download size={14} />
              Export PDF
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-ink-700/30 rounded-lg border border-ink-600/20">
              <p className="text-[10px] font-mono text-paper/40 uppercase tracking-widest mb-1">Total Flags</p>
              <p className="text-2xl font-display font-bold text-paper">{report.totalFlags}</p>
            </div>
            <div className="p-4 bg-stamp-red/10 rounded-lg border border-stamp-red/20">
              <p className="text-[10px] font-mono text-stamp-red/70 uppercase tracking-widest mb-1">High Risk</p>
              <p className="text-2xl font-display font-bold text-stamp-red">{report.highRiskCount}</p>
            </div>
            <div className="p-4 bg-stamp-amber/10 rounded-lg border border-stamp-amber/20">
              <p className="text-[10px] font-mono text-stamp-amber/70 uppercase tracking-widest mb-1">Total Exposure</p>
              <p className="text-2xl font-display font-bold text-stamp-amber">
                {fmtCurrency(report.totalExposureInr)}
              </p>
            </div>
            <div className="p-4 bg-ink-700/30 rounded-lg border border-ink-600/20">
              <p className="text-[10px] font-mono text-paper/40 uppercase tracking-widest mb-1">Vendors Affected</p>
              <p className="text-2xl font-display font-bold text-paper">{report.vendorsAffected}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40 mb-3">
              Breakdown by Category
            </h4>
            <div className="space-y-2">
              {report.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-ink-700/20 border border-ink-600/10 rounded-lg">
                  <span className="text-sm text-paper/70">{item.type.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-paper/40">{item.count} flags</span>
                    <span className="text-sm font-mono font-semibold text-stamp-amber">
                      {fmtCurrency(item.exposure)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
