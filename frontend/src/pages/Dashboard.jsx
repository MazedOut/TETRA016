import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStats, fetchRiskDistribution } from "../api/client.js";
import StatsCards from "../components/StatsCards.jsx";
import RiskChart from "../components/RiskChart.jsx";
import FolderView from "../components/FolderView.jsx";

/**
 * Landing view: processed/valid/invalid/needs-review counts, exceptions by
 * type, risk distribution, ITC-at-risk card, vendor analytics.
 */
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [dist, setDist] = useState([]);

  useEffect(() => {
    fetchStats().then(setStats);
    fetchRiskDistribution().then(setDist);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Screening overview</h2>
          <p className="text-sm text-paper/60 mt-1">
            100% rule-based screening across every uploaded invoice, this batch.
          </p>
        </div>
        <Link to="/upload" className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium hover:brightness-110 transition">
          Upload invoices
        </Link>
      </div>

      <StatsCards stats={stats} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RiskChart data={dist} />
        </div>
        <div className="paper-surface rounded-lg p-6 text-ink space-y-6">
          <div>
            <h3 className="font-display text-lg font-semibold mb-3">Top Risk Drivers</h3>
            <ul className="space-y-2">
              {stats?.topDrivers?.map(d => (
                <li key={d.type} className="flex justify-between items-center bg-paper border border-ink-600/20 px-3 py-2 rounded">
                  <span className="font-mono text-xs font-semibold">{d.type}</span>
                  <span className="bg-stamp-red/10 text-stamp-red font-bold font-mono text-xs px-2 py-0.5 rounded-full">{d.count}</span>
                </li>
              ))}
              {!stats?.topDrivers?.length && <p className="text-xs text-ink-600 italic">No open risk drivers.</p>}
            </ul>
          </div>
          
          <div>
            <h3 className="font-display text-lg font-semibold mb-3">Recent Exceptions</h3>
            <ul className="space-y-3">
              {stats?.recentExceptions?.map(e => (
                <li key={e.id} className="border-l-2 border-stamp-red pl-3">
                  <Link to={`/exceptions`} className="text-xs font-mono font-bold hover:underline text-ink">{e.id}</Link>
                  <p className="text-[11px] text-ink-700 mt-0.5 leading-tight line-clamp-2">{e.narrative}</p>
                </li>
              ))}
              {!stats?.recentExceptions?.length && <p className="text-xs text-ink-600 italic">No recent exceptions.</p>}
            </ul>
          </div>
        </div>
      </div>

      <FolderView />
    </div>
  );
}
