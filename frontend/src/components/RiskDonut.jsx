import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * RiskDonut — Pie/donut chart showing invoice count by risk level.
 * Colors use the platform's existing stamp palette (cream/dark-navy).
 *
 * Props: data = { by_risk_level: { low, medium, high } }
 *        or stats object from /api/stats
 */

const RISK_COLORS = {
  high: "#B23A2E",    // stamp-red
  medium: "#C8922A",  // stamp-amber
  low: "#2F6F62",     // stamp-green
};

const RISK_LABELS = {
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
};

const CUSTOM_LEGEND = ({ payload }) => (
  <ul className="flex gap-4 justify-center flex-wrap mt-2">
    {payload.map((entry) => (
      <li key={entry.value} className="flex items-center gap-1.5 text-xs font-mono text-ink">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: entry.color }}
        />
        {entry.value}
      </li>
    ))}
  </ul>
);

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-paper border border-ink-600/30 rounded-lg px-3 py-2 shadow-md">
      <p className="text-xs font-mono font-bold text-ink">{d.name}</p>
      <p className="text-sm font-display font-semibold text-ink">{d.value} invoices</p>
    </div>
  );
}

export default function RiskDonut({ stats }) {
  const byRisk = stats?.byRiskLevel || stats?.by_risk_level || {};
  const data = [
    { name: RISK_LABELS.high,   value: byRisk.high   || 0, key: "high" },
    { name: RISK_LABELS.medium, value: byRisk.medium || 0, key: "medium" },
    { name: RISK_LABELS.low,    value: byRisk.low    || 0, key: "low" },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="paper-surface rounded-xl p-6 text-ink flex items-center justify-center h-48">
        <p className="text-sm font-mono text-ink-600 italic">No risk data yet.</p>
      </div>
    );
  }

  return (
    <div className="paper-surface rounded-xl p-6 text-ink flex flex-col h-full">
      <h3 className="font-display text-base font-semibold mb-1">Risk Level Distribution</h3>
      <p className="text-xs font-mono text-ink-600 mb-4">{total} invoices by risk tier</p>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={RISK_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CUSTOM_LEGEND />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
