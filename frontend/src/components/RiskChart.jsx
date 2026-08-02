import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
          <Bar dataKey="count" fill="#B23A2E" radius={[4, 4, 0, 0]} />
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
