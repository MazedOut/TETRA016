import { useState } from "react";
import { generateReport } from "../api/client.js";
import { useMode } from "../context/ModeContext.jsx";

const EXCEPTION_TYPES = [
  "duplicate_invoice",
  "invalid_gstin",
  "amount_mismatch",
  "sequence_gap",
  "phantom_vendor",
  "typo_squatting_vendor",
  "pdf_metadata_tamper",
  "invisible_text_detected",
  "benford_deviation",
  "vendor_activity_anomaly",
];

const TYPE_LABELS = {
  duplicate_invoice: "Duplicate Invoice",
  invalid_gstin: "Invalid GSTIN",
  amount_mismatch: "Amount Mismatch",
  sequence_gap: "Sequence Gap",
  phantom_vendor: "Phantom Vendor",
  typo_squatting_vendor: "Typo Squatting",
  pdf_metadata_tamper: "Metadata Tamper",
  invisible_text_detected: "Hidden Text",
  benford_deviation: "Benford Deviation",
  vendor_activity_anomaly: "Vendor Activity Anomaly",
};

export default function Reports() {
  const { mode } = useMode();
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-08-01");
  const [minRisk, setMinRisk] = useState(0);
  const [types, setTypes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  function toggleType(t) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setGenerating(true);
    try {
      const data = await generateReport({ from, to, minRisk, types });
      setResult(data);
    } catch (err) {
      alert("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-paper">Portfolio audit report</h2>
        <p className="text-sm text-paper/80 mt-1 font-sans">
          Generate an end-to-end portfolio analysis across all invoices in the system.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="paper-surface rounded-lg p-6 text-ink space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-semibold text-ink">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono text-ink font-medium"
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono text-ink font-medium"
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-ink">
          Minimum risk score filter: <span className="text-stamp-red font-mono font-bold">{minRisk}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={minRisk}
            onChange={(e) => setMinRisk(Number(e.target.value))}
            className="mt-2 w-full accent-stamp-red"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-ink mb-2">Filter by exception types</legend>
          <div className="flex flex-wrap gap-2">
            {EXCEPTION_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => toggleType(t)}
                className={
                  "text-xs font-mono px-3 py-1.5 rounded-full border font-medium transition-colors " +
                  (types.includes(t)
                    ? "bg-stamp-red text-paper border-stamp-red shadow"
                    : "bg-paper text-ink border-ink-600/30 hover:border-stamp-red")
                }
              >
                {TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={generating}
            className="bg-stamp-red text-paper px-5 py-2.5 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-stamp-red/90 transition shadow"
          >
            {generating ? "Running portfolio analysis…" : "Generate report"}
          </button>
        </div>
      </form>

      {result && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="bg-paper-surface rounded-lg p-6 border border-ink-600/30 text-ink space-y-4 shadow">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-ink-600/20 pb-3">
              <h3 className="font-display text-xl font-semibold text-ink">Auditor Summary Report</h3>
              <span className="text-xs font-mono bg-ink/10 px-3 py-1 rounded-full text-ink font-bold">
                Range: {result.from} &rarr; {result.to}
              </span>
            </div>

            <p className="text-sm leading-relaxed font-sans text-ink font-medium">{result.summary}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="bg-paper rounded p-3 text-center border border-ink-600/20 shadow-sm">
                <span className="text-xs text-ink-700 font-mono block font-bold">Invoices Analyzed</span>
                <span className="font-display text-2xl font-bold text-ink">{result.invoices_analyzed}</span>
              </div>
              <div className="bg-paper rounded p-3 text-center border border-ink-600/20 shadow-sm">
                <span className="text-xs text-stamp-red font-mono block font-bold">High Risk</span>
                <span className="font-display text-2xl font-bold text-stamp-red">{result.high_risk_count}</span>
              </div>
              <div className="bg-paper rounded p-3 text-center border border-ink-600/20 shadow-sm">
                <span className="text-xs text-stamp-amber font-mono block font-bold">ITC at Risk</span>
                <span className="font-display text-xl font-bold text-stamp-amber">₹{Number(result.itc_at_risk_inr || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="bg-paper rounded p-3 text-center border border-ink-600/20 shadow-sm">
                <span className="text-xs text-ink-700 font-mono block font-bold">MSME Penalty</span>
                <span className="font-display text-xl font-bold text-ink">₹{Number(result.msme_penalty_exposure_inr || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Insufficient Data Warnings */}
          {result.insufficient_data_notes?.length > 0 && (
            <div className="bg-stamp-amber/15 border border-stamp-amber/40 rounded-lg p-5 text-ink space-y-2 shadow-sm">
              <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-stamp-amber">
                Historical Evidence Sample Size Notes
              </h4>
              <ul className="space-y-1.5 text-xs font-mono text-ink font-semibold">
                {result.insufficient_data_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{note.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Flagged Invoices Breakdown */}
          {result.flagged_invoices?.length > 0 && (
            <div className="paper-surface rounded-lg p-6 text-ink space-y-4">
              <h4 className="font-display text-lg font-semibold text-ink">Flagged Invoice Portfolio Detail</h4>
              <div className="space-y-3">
                {result.flagged_invoices.map((inv) => (
                  <div key={inv.id} className="border border-ink-600/20 rounded-md p-4 space-y-2 hover:border-ink-600/40 transition bg-paper shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-stamp-red">{inv.invoice_number}</span>
                        <span className="text-xs font-mono text-ink-700 font-medium">{inv.vendor_name} ({inv.vendor_gstin})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-ink">₹{Number(inv.total_amount || 0).toFixed(2)}</span>
                        <span className="stamp-badge text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-stamp-red/10 text-stamp-red border border-stamp-red/30">
                          Score: {inv.risk_score}
                        </span>
                      </div>
                    </div>

                    {inv.tickets?.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {inv.tickets.map((t) => (
                          <div key={t.id} className="text-xs bg-paper-surface p-2 rounded border border-ink-600/10">
                            <span className="font-mono font-bold text-stamp-red block">{t.check}</span>
                            <p className="text-ink font-medium mt-0.5">{mode === "msme" ? (t.msme_narrative || t.narrative) : t.narrative}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
