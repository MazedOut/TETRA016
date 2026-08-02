import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import ExceptionQueue from "./pages/ExceptionQueue.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import UploadBatch from "./pages/UploadBatch.jsx";
import Reports from "./pages/Reports.jsx";
import FolderDetail from "./pages/FolderDetail.jsx";
import DuplicateComparison from "./pages/DuplicateComparison.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { resetDemoData } from "./api/client.js";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/upload", label: "Batch Upload" },
  { to: "/exceptions", label: "Exception Queue" },
  { to: "/reports", label: "Reports" },
];

const ROLE_STYLES = {
  auditor: {
    badge: "bg-stamp-red/15 border-stamp-red/40 text-stamp-red",
    icon: "🔍",
  },
  msme: {
    badge: "bg-stamp-green/15 border-stamp-green/40 text-stamp-green",
    icon: "📄",
  },
};

function Shell({ children }) {
  const { role, logout, canWrite } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  async function handleReset() {
    if (!window.confirm("Clear all test invoices and tickets from the database?")) return;
    setResetting(true);
    try {
      await resetDemoData();
      setResetMsg("Data cleared!");
      setTimeout(() => {
        setResetMsg("");
        window.location.reload();
      }, 800);
    } catch {
      setResetMsg("Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.auditor;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dark-navy header — uses border-b as depth cue, NOT box-shadow (see index.css) */}
      <header className="border-b border-ink-600 bg-ink sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="stamp-badge w-9 h-9 text-stamp-red text-[9px] font-mono font-bold flex items-center justify-center">
              IRS
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none text-paper">
                Invoice Risk Scanner
              </h1>
              <p className="text-[11px] text-ink-600 font-mono tracking-wide">
                rule &rarr; cache &rarr; AI
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "px-3 py-2 text-sm rounded-lg font-medium transition-all duration-150 " +
                  (isActive
                    ? "bg-paper text-ink shadow-sm"
                    : "text-paper/70 hover:text-paper hover:bg-ink-700 active:scale-[0.97]")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Dev reset — auditor only */}
            {canWrite && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="text-xs font-mono px-3 py-1.5 rounded-lg bg-ink-700 hover:bg-stamp-red/20
                           text-paper/80 hover:text-stamp-red border border-ink-600 transition-all duration-150
                           active:scale-[0.97] disabled:opacity-50"
                title="Dev Tool: Wipe Invoice and Ticket tables"
              >
                {resetMsg || (resetting ? "Resetting..." : "Reset demo data")}
              </button>
            )}

            {/* Role badge + switch */}
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border font-semibold ${roleStyle.badge}`}
              >
                <span>{roleStyle.icon}</span>
                {role === "auditor" ? "Auditor" : "MSME"}
              </span>
              <button
                onClick={logout}
                className="text-xs font-mono text-paper/50 hover:text-paper/80 transition-all duration-150
                           px-2 py-1 rounded-lg hover:bg-ink-700 active:scale-[0.97]"
                title="Switch role"
              >
                Switch ↩
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 8px spacing grid: py-8 = 32px, px-6 = 24px */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-ink-600 py-4">
        <p className="max-w-6xl mx-auto px-6 text-[11px] font-mono text-ink-600">
          Every place the model could be wrong, there&apos;s a form, not an assumption.
          {!canWrite && (
            <span className="ml-3 text-stamp-green/70">
              MSME view — read-only
            </span>
          )}
        </p>
      </footer>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exceptions" element={<ExceptionQueue />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/upload" element={<UploadBatch />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/folders/:folderName" element={<FolderDetail />} />
        <Route path="/invoices/:id/compare/:targetId" element={<DuplicateComparison />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
