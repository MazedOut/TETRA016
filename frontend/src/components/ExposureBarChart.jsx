import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { fmtCurrency } from "../utils/format.js";

/**
 * ExposureBarChart — Vertical bar chart showing ₹ financial exposure by exception type.
 * A rare-but-expensive flag will visibly stand out from a common-but-cheap one.
 *
 * Props: data = [{ type, count, exposure }]
 */

const EXCEPTION_LABELS = {
  duplicate_invoice: "Duplicate",
  invalid_gstin: "Invalid GSTIN",
  amount_mismatch: "Amt Mismatch",
  internal_math_error: "Math Error",
  phantom_vendor: "Phantom Vendor",
  typo_squatting_vendor: "Typo Vendor",
  pdf_metadata_tamper: "Metadata",
  invisible_text_detected: "Hidden Text",
  benford_deviation: "Benford",
  vendor_activity_anomaly: "Vendor Anomaly",
  needs_review: "Needs Review",
  date_mismatch: "Date Mismatch",
  unknown: "Other",
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-paper border border-ink-600/30 rounded-lg px-3 py-2 shadow-md max-w-[180px]">
      <p className="text-xs font-mono font-bold text-ink mb-1">{label}</p>
      <p className="text-sm font-display font-semibold text-stamp-red">{fmtCurrency(d.value)}</p>
      <p className="text-[10px] font-mono text-ink-600 mt-0.5">financial exposure</p>
    </div>
  );
}

function formatYAxis(value) {
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value}`;
}

export default function ExposureBarChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="paper-surface rounded-xl p-6 text-ink flex items-center justify-center h-48">
        <p className="text-sm font-mono text-ink-600 italic">No exposure data yet.</p>
      </div>
    );
  }

  const sorted = [...data]
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 8)
    .map(d => ({
      ...d,
      label: EXCEPTION_LABELS[d.type] || d.type,
    }));

  return (
    <div className="paper-surface rounded-xl p-6 text-ink">
      <h3 className="font-display text-base font-semibold mb-1">Financial Exposure by Flag Type</h3>
      <p className="text-xs font-mono text-ink-600 mb-4">₹ at risk per exception category</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={sorted}
          margin={{ left: 8, right: 8, top: 8, bottom: 32 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#EAE2CD" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#1B2430" }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 11, fill: "#3C4C61" }}
            width={54}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(27,36,48,0.05)" }} />
          <Bar dataKey="exposure" radius={[4, 4, 0, 0]}>
            {sorted.map((entry, i) => (
              <Cell
                key={entry.type}
                fill={i === 0 ? "#B23A2E" : i === 1 ? "#C8922A" : "#3C4C61"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
