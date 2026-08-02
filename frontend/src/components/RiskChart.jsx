import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

/**
 * Recharts risk distribution / monthly anomaly trend visualization.
 */
export default function RiskChart({ data }) {
  return (
    <div className="paper-surface rounded-xl p-6 text-ink h-full flex flex-col">
      <h3 className="font-display text-lg font-semibold mb-4">Risk score distribution</h3>
      <div className="flex-1 min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data || []} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAE2CD" />
          <XAxis dataKey="bucket" tick={{ fontFamily: "IBM Plex Mono", fontSize: 12, fill: "#1B2430" }} />
          <YAxis tick={{ fontFamily: "IBM Plex Mono", fontSize: 12, fill: "#1B2430" }} />
          <Tooltip
            contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12, borderRadius: 8, border: "1px solid #1B2430" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {(data || []).map((entry, i) => {
              const colors = ["#2F6F62", "#5B8C85", "#C8922A", "#A45D5D", "#B23A2E"];
              return <Cell key={entry.bucket} fill={colors[i % colors.length]} />;
            })}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
