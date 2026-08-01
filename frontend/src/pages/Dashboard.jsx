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
      <RiskChart data={dist} />
      <FolderView />
    </div>
  );
}
