import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchStats,
  fetchRiskDistribution,
  fetchExceptionBreakdown,
  fetchFlagsOverTime,
} from "../api/client.js";
import { fmtCurrency } from "../utils/format.js";
import StatsCards from "../components/StatsCards.jsx";
import RiskChart from "../components/RiskChart.jsx";
import RiskDonut from "../components/RiskDonut.jsx";
import ExceptionBarChart from "../components/ExceptionBarChart.jsx";
import ExposureBarChart from "../components/ExposureBarChart.jsx";
import FolderView from "../components/FolderView.jsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/**
 * Landing view: processed/valid/invalid/needs-review counts, exception analytics,
 * risk distribution donut, exposure chart, and optional flags-over-time trend.
 */

// Trend chart — only rendered if backend says data has enough spread
function TrendChart({ series }) {
  if (!series?.length) return null;
  return (
    <div className="paper-surface rounded-xl p-6 text-ink">
      <h3 className="font-display text-base font-semibold mb-1">Flag Activity Over Time</h3>
      <p className="text-xs font-mono text-ink-600 mb-4">Weekly flag count by invoice date</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={series} margin={{ left: -16, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAE2CD" />
          <XAxis
            dataKey="week"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#3C4C61" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 11, fill: "#3C4C61" }}
          />
          <Tooltip
            contentStyle={{
              fontFamily: "IBM Plex Mono",
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #3C4C61",
              backgroundColor: "#F6F1E4",
              color: "#1B2430",
            }}
          />
          <Line
            type="monotone"
            dataKey="flags"
            stroke="#B23A2E"
            strokeWidth={2}
            dot={{ fill: "#B23A2E", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [dist, setDist] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    fetchStats().then(setStats);
    fetchRiskDistribution().then(setDist);
    fetchExceptionBreakdown().then(setBreakdown);
    fetchFlagsOverTime().then(setTrend);
  }, []);

  // Dashboard summary string — computed from real aggregate data
  const summaryString = stats
    ? `${fmtCurrency(stats.itcAtRiskInr)} at risk across ${stats.uniqueVendors ?? "—"} vendors · ${stats.openTickets} open tickets`
    : null;

  const showTrend = trend?.supported && trend?.series?.length > 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-2xl font-semibold">Screening overview</h2>
          {/* One-line "so what" summary — computed from real numbers */}
          {summaryString ? (
            <p className="text-sm font-mono text-stamp-red font-semibold mt-1 truncate">
              {summaryString}
            </p>
          ) : (
            <p className="text-sm text-paper/60 mt-1">
              100% rule-based screening across every uploaded invoice, this batch.
            </p>
          )}
        </div>
        <Link
          to="/upload"
          className="bg-stamp-red text-paper px-4 py-2 rounded-lg text-sm font-medium
                     hover:brightness-110 active:scale-[0.97] transition-all duration-150 shadow-sm shrink-0"
        >
          Upload invoices
        </Link>
      </div>

      {/* Stats cards row */}
      <StatsCards stats={stats} />

      {/* Analytics grid — row 1: donut + exception bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RiskDonut stats={stats} />
        <ExceptionBarChart data={breakdown} />
      </div>

      {/* Analytics grid — row 2: exposure chart + (trend or risk score dist) */}
      <div className={`grid grid-cols-1 ${showTrend ? "lg:grid-cols-2" : ""} gap-6`}>
        <ExposureBarChart data={breakdown} />
        {showTrend && <TrendChart series={trend.series} />}
      </div>

      {/* Risk score distribution (existing chart) + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RiskChart data={dist} />
        </div>
        <div className="paper-surface rounded-xl p-6 text-ink space-y-6">
          <div>
            <h3 className="font-display text-base font-semibold mb-3">Top Risk Drivers</h3>
            <ul className="space-y-2">
              {stats?.topDrivers?.map(d => (
                <li
                  key={d.type}
                  className="flex justify-between items-center bg-paper border border-ink-600/20
                             px-3 py-2 rounded-lg hover:border-ink-600/40 transition-all duration-150"
                >
                  <span className="font-mono text-xs font-semibold truncate mr-2">
                    {d.type.replace(/_/g, " ")}
                  </span>
                  <span className="bg-stamp-red/10 text-stamp-red font-bold font-mono text-xs px-2 py-0.5 rounded-full shrink-0">
                    {d.count}
                  </span>
                </li>
              ))}
              {!stats?.topDrivers?.length && (
                <p className="text-xs text-ink-600 italic">No open risk drivers.</p>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-base font-semibold mb-3">Recent Exceptions</h3>
            <ul className="space-y-3">
              {stats?.recentExceptions?.map(e => (
                <li key={e.id} className="border-l-2 border-stamp-red pl-3">
                  <Link
                    to="/exceptions"
                    className="text-xs font-mono font-bold hover:underline text-ink"
                  >
                    {e.id}
                  </Link>
                  <p className="text-[11px] text-ink-700 mt-0.5 leading-tight line-clamp-2">
                    {e.narrative}
                  </p>
                </li>
              ))}
              {!stats?.recentExceptions?.length && (
                <p className="text-xs text-ink-600 italic">No recent exceptions.</p>
              )}
            </ul>
          </div>
        </div>
      </div>

      <FolderView />
    </div>
  );
}
