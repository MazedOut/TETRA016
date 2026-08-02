import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

/**
 * ExceptionBarChart — Horizontal bar chart showing which flag types fire most.
 * Horizontal layout because exception type names are long.
 *
 * Props: data = [{ type, count, exposure }]
 */

const CHART_PALETTE = [
  "#B23A2E",  // stamp-red
  "#C8922A",  // stamp-amber  
  "#2F6F62",  // stamp-green
  "#4F6D7A",  // muted slate-teal
  "#6B5B95",  // muted indigo
  "#5B8C85",  // muted cyan-green
  "#A45D5D",  // muted rose
  "#8B7355",  // warm bronze
];

const EXCEPTION_LABELS = {
  duplicate_invoice: "Duplicate Invoice",
  invalid_gstin: "Invalid GSTIN",
  amount_mismatch: "Amount Mismatch",
  internal_math_error: "Math Error",
  phantom_vendor: "Phantom Vendor",
  typo_squatting_vendor: "Typo-Squatting",
  pdf_metadata_tamper: "Metadata Tamper",
  invisible_text_detected: "Hidden Text",
  benford_deviation: "Benford Deviation",
  vendor_activity_anomaly: "Vendor Anomaly",
  needs_review: "Needs Review",
  date_mismatch: "Date Mismatch",
  unknown: "Other",
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-paper border border-ink-600/30 rounded-lg px-3 py-2 shadow-md">
      <p className="text-xs font-mono font-bold text-ink">{EXCEPTION_LABELS[label] || label}</p>
      <p className="text-sm font-display font-semibold text-stamp-red">{payload[0].value} flags</p>
    </div>
  );
}

export default function ExceptionBarChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="paper-surface rounded-xl p-6 text-ink flex items-center justify-center h-48">
        <p className="text-sm font-mono text-ink-600 italic">No exception data yet.</p>
      </div>
    );
  }

  // Take top 8, sorted by count desc
  const sorted = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(d => ({ ...d, label: EXCEPTION_LABELS[d.type] || d.type }));

  const chartHeight = Math.max(180, sorted.length * 40);

  return (
    <div className="paper-surface rounded-xl p-6 text-ink flex flex-col h-full">
      <h3 className="font-display text-base font-semibold mb-1">Exception Type Frequency</h3>
      <p className="text-xs font-mono text-ink-600 mb-4">Flags fired across all tickets</p>
      <div className="flex-1" style={{ minHeight: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#EAE2CD"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontFamily: "IBM Plex Mono", fontSize: 11, fill: "#3C4C61" }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontFamily: "IBM Plex Mono", fontSize: 11, fill: "#1B2430" }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(27,36,48,0.05)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sorted.map((entry, i) => (
                <Cell
                  key={entry.type}
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
