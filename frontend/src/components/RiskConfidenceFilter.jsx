import { useState } from "react";

/**
 * Dual-scale filter — risk score and confidence score as separate,
 * independently filterable axes. Never rendered as one blended slider,
 * because they measure two different things (fraud likelihood vs.
 * extraction certainty).
 */
export default function RiskConfidenceFilter({ onChange }) {
  const [minRisk, setMinRisk] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  function emit(next) {
    onChange?.({ minRisk, minConfidence, status, query, ...next });
  }

  return (
    <div className="paper-surface rounded-lg p-4 text-ink flex flex-wrap items-end gap-5">
      <label className="flex flex-col text-xs font-mono min-w-[160px]">
        Search vendor / invoice
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            emit({ query: e.target.value });
          }}
          placeholder="e.g. Anand Hardware"
          className="mt-1 bg-paper border border-ink-600/30 rounded-md px-2 py-1.5 text-sm font-body"
        />
      </label>

      <label className="flex flex-col text-xs font-mono min-w-[160px]">
        Min. risk score: <span className="text-stamp-red">{minRisk}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={minRisk}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMinRisk(v);
            emit({ minRisk: v });
          }}
          className="mt-2 accent-stamp-red"
        />
      </label>

      <label className="flex flex-col text-xs font-mono min-w-[160px]">
        Min. confidence: <span className="text-ink-700">{minConfidence}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={minConfidence}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMinConfidence(v);
            emit({ minConfidence: v });
          }}
          className="mt-2 accent-ink-700"
        />
      </label>

      <label className="flex flex-col text-xs font-mono">
        Status
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            emit({ status: e.target.value });
          }}
          className="mt-1 bg-paper border border-ink-600/30 rounded-md px-2 py-1.5 text-sm font-body"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="in-review">In review</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
        </select>
      </label>
    </div>
  );
}
