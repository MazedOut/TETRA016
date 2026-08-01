import { useState } from "react";
import { generateReport } from "../api/client.js";

const EXCEPTION_TYPES = [
  "Duplicate invoice",
  "GSTIN checksum failed",
  "Amount / tax mismatch",
  "Sequence gap",
  "Phantom vendor",
  "Off-hours submission",
  "45-day MSME breach risk",
];

/**
 * Report generation form and export (filtered PDF snapshot, exception
 * report, vendor risk report). The person picks scope before export —
 * never one fixed dump.
 */
export default function Reports() {
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-06-30");
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
    const data = await generateReport({ from, to, minRisk, types });
    setGenerating(false);
    setResult(data);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Reports</h2>
        <p className="text-sm text-paper/60 mt-1">
          Choose the scope before exporting — every report is a deliberate snapshot, not a fixed dump.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="paper-surface rounded-lg p-6 text-ink space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-medium">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block text-sm font-medium">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          Minimum risk score: <span className="text-stamp-red font-mono">{minRisk}</span>
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
          <legend className="text-sm font-medium mb-2">Exception types to include</legend>
          <div className="flex flex-wrap gap-2">
            {EXCEPTION_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => toggleType(t)}
                className={
                  "text-xs font-mono px-3 py-1.5 rounded-full border transition-colors " +
                  (types.includes(t)
                    ? "bg-stamp-red text-paper border-stamp-red"
                    : "bg-paper text-ink border-ink-600/30 hover:border-stamp-red")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={generating}
            className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate report"}
          </button>
        </div>
      </form>

      {result && (
        <div className="paper-surface rounded-lg p-5 text-ink text-sm font-mono">
          Report generated for {result.from} &rarr; {result.to}
          {result.types?.length > 0 && <span>, {result.types.length} exception type(s) included</span>}.
          {result.url ? (
            <a href={result.url} className="text-stamp-red hover:underline ml-1">
              Download
            </a>
          ) : (
            <span className="text-ink-600 ml-1">(mock — wire result.url once the backend export endpoint exists)</span>
          )}
        </div>
      )}
    </div>
  );
}
