import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchStats,
  fetchRiskDistribution,
  fetchExceptionBreakdown,
  fetchFlagsOverTime,
} from "../api/client.js";
import { fmtCurrency, formatExceptionSummary } from "../utils/format.js";
import StatsCards from "../components/StatsCards.jsx";
import RiskChart from "../components/RiskChart.jsx";
import RiskDonut from "../components/RiskDonut.jsx";
import ExceptionBarChart from "../components/ExceptionBarChart.jsx";
import ExposureBarChart from "../components/ExposureBarChart.jsx";

import { useAuth } from "../context/AuthContext.jsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ShieldAlert,
  ListChecks,
  DollarSign,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Activity,
} from "lucide-react";

// ─── Trend chart (rendered only when backend provides series) ────────────────
function TrendChart({ series }) {
  if (!series?.length) return null;
  return (
    <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-paper mb-0.5">Flag Activity Over Time</h3>
      <p className="text-xs font-mono text-paper/40 mb-4">Weekly flag count by invoice date</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={series} margin={{ left: -16, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,76,97,0.4)" />
          <XAxis
            dataKey="week"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#3C4C61" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 10, fill: "#3C4C61" }}
          />
          <Tooltip
            contentStyle={{
              fontFamily: "IBM Plex Mono",
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #3C4C61",
              backgroundColor: "#232E3D",
              color: "#F6F1E4",
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

// ─── Action Required item ────────────────────────────────────────────────────
function ActionItem({ icon: Icon, iconVariant, title, subtitle, cta, to }) {
  const variantStyles = {
    danger: "bg-stamp-red/10 text-stamp-red border-stamp-red/20",
    warning: "bg-stamp-amber/10 text-stamp-amber border-stamp-amber/20",
    info: "bg-ink-700 text-paper/60 border-ink-600/30",
  };

  const iconStyle = variantStyles[iconVariant] ?? variantStyles.info;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-ink-800 border border-ink-600/30
                    hover:border-ink-600/60 transition-all duration-150 group">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-paper">{title}</p>
        <p className="text-xs text-paper/50 font-sans mt-0.5">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="flex items-center gap-1 text-xs font-medium text-paper/50
                   group-hover:text-paper transition-colors whitespace-nowrap"
      >
        {cta}
        <ChevronRight size={12} strokeWidth={2} />
      </Link>
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ children }) {
  return (
    <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-paper/40 mb-3">
      {children}
    </h3>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { mode } = useAuth();
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

  const showTrend = trend?.supported && trend?.series?.length > 1;
  const openTickets = stats?.openTickets ?? 0;
  const highRisk = stats?.highRiskCount ?? 0;
  const itcAtRisk = stats?.itcAtRiskInr ?? 0;
  const msmeExposure = stats?.msmePenaltyExposureInr ?? 0;

  // Determine if there's anything actionable
  const hasActions = openTickets > 0 || highRisk > 0 || itcAtRisk > 0 || msmeExposure > 0;

  return (
    <div className="space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper">Overview</h2>
          <p className="text-sm text-paper/50 mt-1 font-sans">
            {mode === "msme"
              ? "Your invoice health summary"
              : "Risk intelligence command center"}
          </p>
        </div>
        <Link
          to="/upload"
          className="bg-stamp-red text-paper px-4 py-2 rounded-lg text-sm font-medium
                     hover:bg-stamp-red/90 active:scale-[0.97] transition-all duration-150 shadow-sm"
        >
          Upload Invoices
        </Link>
      </div>

      {/* ── KPI strip ── */}
      <StatsCards stats={stats} />

      {/* ── ACTION REQUIRED ── */}
      {stats && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>Action Required</SectionHeading>
            {!hasActions && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-stamp-green">
                <CheckCircle size={12} strokeWidth={2} />
                All clear
              </span>
            )}
          </div>

          {hasActions ? (
            <div className="space-y-2">
              {highRisk > 0 && (
                <ActionItem
                  icon={ShieldAlert}
                  iconVariant="danger"
                  title={`${highRisk} High-Risk Invoice${highRisk !== 1 ? "s" : ""}`}
                  subtitle={mode === "msme"
                    ? "These invoices have serious issues that need attention"
                    : "Risk score ≥ 60 — requires immediate investigation"}
                  cta="Review"
                  to="/exceptions"
                />
              )}
              {openTickets > 0 && (
                <ActionItem
                  icon={ListChecks}
                  iconVariant="warning"
                  title={`${openTickets} Open Exception${openTickets !== 1 ? "s" : ""}`}
                  subtitle={mode === "msme"
                    ? "Flagged invoices waiting for your response"
                    : "Unresolved findings awaiting auditor decision"}
                  cta="Review Queue"
                  to="/exceptions"
                />
              )}
              {itcAtRisk > 0 && (
                <ActionItem
                  icon={DollarSign}
                  iconVariant="danger"
                  title={`${fmtCurrency(itcAtRisk)} ITC at Risk`}
                  subtitle={mode === "msme"
                    ? `You may not be able to claim ${fmtCurrency(itcAtRisk)} of tax credit until issues are resolved`
                    : "Input Tax Credit tied to invoices with unresolved flags"}
                  cta="View Invoices"
                  to="/exceptions"
                />
              )}
              {msmeExposure > 0 && (
                <ActionItem
                  icon={AlertTriangle}
                  iconVariant="warning"
                  title={`${fmtCurrency(msmeExposure)} MSME Penalty Exposure`}
                  subtitle={mode === "msme"
                    ? "Payments approaching 45-day deadline — late payment may attract interest"
                    : "Invoices at risk of MSME 45-day payment breach"}
                  cta="View"
                  to="/"
                />
              )}
            </div>
          ) : (
            <div className="bg-ink-800 border border-stamp-green/20 rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-stamp-green/10 border border-stamp-green/20
                              flex items-center justify-center">
                <CheckCircle size={18} className="text-stamp-green" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-paper">No unresolved exceptions</p>
                <p className="text-xs text-paper/50 mt-0.5">
                  All invoices have been reviewed. Upload a new batch to continue.
                </p>
              </div>
              <Link
                to="/upload"
                className="ml-auto text-xs font-medium text-paper/50 hover:text-paper
                           flex items-center gap-1 transition-colors"
              >
                Upload Batch <ChevronRight size={12} strokeWidth={2} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Risk overview analytics ── */}
      <div className="space-y-3">
        <SectionHeading>Risk Overview</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RiskDonut stats={stats} />
          <ExceptionBarChart data={breakdown} />
        </div>
      </div>

      {/* ── Exposure & trend ── */}
      <div className="space-y-3">
        <SectionHeading>Financial Exposure</SectionHeading>
        <div className={`grid grid-cols-1 ${showTrend ? "lg:grid-cols-2" : ""} gap-5`}>
          <ExposureBarChart data={breakdown} />
          {showTrend && <TrendChart series={trend.series} />}
        </div>
      </div>

      {/* ── Risk score distribution + sidebar ── */}
      <div className="space-y-3">
        <SectionHeading>Analytics</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <RiskChart data={dist} />
          </div>

          {/* Top drivers + recent exceptions */}
          <div className="space-y-4">
            <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={13} className="text-paper/40" strokeWidth={1.8} />
                <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
                  Top Risk Drivers
                </h4>
              </div>
              <ul className="space-y-1.5">
                {stats?.topDrivers?.map((d) => (
                  <li
                    key={d.type}
                    className="flex justify-between items-center px-3 py-2 rounded-lg
                               bg-ink-700/50 border border-ink-600/20
                               hover:border-ink-600/40 transition-all duration-150"
                  >
                    <span className="text-xs text-paper/70 font-sans capitalize">
                      {d.type.replace(/_/g, " ")}
                    </span>
                    <span className="bg-stamp-red/15 text-stamp-red font-bold font-mono
                                     text-[10px] px-2 py-0.5 rounded-full border border-stamp-red/20">
                      {d.count}
                    </span>
                  </li>
                ))}
                {!stats?.topDrivers?.length && (
                  <p className="text-xs text-paper/30 italic font-mono py-2">
                    No risk drivers yet
                  </p>
                )}
              </ul>
            </div>

            <div className="bg-ink-800 border border-ink-600/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-paper/40" strokeWidth={1.8} />
                <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
                  Recent Exceptions
                </h4>
              </div>
              <ul className="space-y-2.5">
                {stats?.recentExceptions?.map((e) => (
                  <li key={e.id} className="border-l-2 border-stamp-red/40 pl-3">
                    <Link
                      to="/exceptions"
                      className="text-xs font-mono font-bold hover:underline text-paper/80"
                    >
                      {e.id}
                    </Link>
                    <p className="text-[11px] text-paper/40 mt-0.5 leading-tight line-clamp-2 font-sans">
                      {formatExceptionSummary(e)}
                    </p>
                  </li>
                ))}
                {!stats?.recentExceptions?.length && (
                  <p className="text-xs text-paper/30 italic font-mono py-2">
                    No recent exceptions
                  </p>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
