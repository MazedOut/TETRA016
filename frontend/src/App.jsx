import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import ExceptionQueue from "./pages/ExceptionQueue.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import UploadBatch from "./pages/UploadBatch.jsx";
import Reports from "./pages/Reports.jsx";
import FolderDetail from "./pages/FolderDetail.jsx";
import DuplicateComparison from "./pages/DuplicateComparison.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import VendorsPage from "./pages/VendorsPage.jsx";
import AuditTrailPage from "./pages/AuditTrailPage.jsx";
import MsmeTrackerPage from "./pages/MsmeTrackerPage.jsx";
import GstinLookupsPage from "./pages/GstinLookupsPage.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { resetDemoData } from "./api/client.js";
import { useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  Building2,
  Upload,
  BarChart2,
  Clock,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Timer,
} from "lucide-react";

// ─── Sidebar nav section heading ───────────────────────────────────────────
function NavSection({ label }) {
  return (
    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-600 px-3 pt-5 pb-1.5">
      {label}
    </p>
  );
}

// ─── Sidebar nav item ───────────────────────────────────────────────────────
function SidebarLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        "sidebar-link" + (isActive ? " active" : "")
      }
    >
      <Icon size={15} strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}

// ─── Shell with sidebar ─────────────────────────────────────────────────────
function Shell({ children }) {
  const { role, logout, canWrite } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  async function handleReset() {
    if (!window.confirm("Clear all test invoices and tickets from the database?")) return;
    setResetting(true);
    try {
      await resetDemoData();
      setResetMsg("Cleared");
      setTimeout(() => {
        setResetMsg("");
        window.location.reload();
      }, 800);
    } catch {
      setResetMsg("Failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Sidebar ── */}
      <aside className="app-sidebar">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-ink-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-stamp-red/90 flex items-center justify-center shrink-0">
              <ShieldCheck size={14} strokeWidth={2.5} className="text-paper" />
            </div>
            <div>
              <h1 className="font-display text-[15px] font-bold leading-none text-paper tracking-tight">
                IRS
              </h1>
              <p className="text-[10px] font-mono text-ink-600 mt-0.5 leading-none">
                Invoice Risk Scanner
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          <NavSection label="Workspace" />
          <SidebarLink to="/" icon={LayoutDashboard} label="Overview" end />
          <SidebarLink to="/exceptions" icon={ListChecks} label="Review Queue" />
          <SidebarLink to="/invoices-list" icon={FileText} label="Invoices" />
          <SidebarLink to="/vendors" icon={Building2} label="Vendors" />

          <NavSection label="Operations" />
          <SidebarLink to="/upload" icon={Upload} label="Upload Batch" />
          <SidebarLink to="/reports" icon={BarChart2} label="Reports" />

          <NavSection label="Tools" />
          <SidebarLink to="/msme-tracker" icon={Timer} label="MSME Tracker" />
          <SidebarLink to="/gstin-logs" icon={ShieldCheck} label="GSTIN Lookups" />

          <NavSection label="Control" />
          <SidebarLink to="/audit-trail" icon={Clock} label="Audit Trail" />
        </nav>

        {/* Bottom: mode + role actions */}
        <div className="border-t border-ink-700/60 px-3 py-4 space-y-3">
          {/* Role indicator */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-ink-600 uppercase tracking-wider">
                Signed in as
              </p>
              <p className="text-xs font-semibold text-paper mt-0.5">
                {role === "auditor" ? "Auditor" : "MSME / Vendor"}
              </p>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                role === "auditor"
                  ? "bg-stamp-red/15 text-stamp-red border-stamp-red/30"
                  : "bg-stamp-green/15 text-stamp-green border-stamp-green/30"
              }`}
            >
              {role === "auditor" ? "AUDITOR" : "MSME"}
            </span>
          </div>

          {/* Mode switch */}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full text-xs font-medium text-ink-600 hover:text-paper
                       px-2 py-1.5 rounded-md hover:bg-ink-700/60 transition-all duration-150"
            title="Switch role / Sign out"
          >
            <LogOut size={13} strokeWidth={1.8} />
            <span>Switch to {role === "auditor" ? "MSME View" : "Auditor Mode"}</span>
          </button>

          {/* Dev reset — auditor only */}
          {canWrite && (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="text-[10px] font-mono text-ink-600 hover:text-stamp-red/70 transition-colors
                         disabled:opacity-50 px-1"
              title="Dev Tool: Wipe Invoice and Ticket tables"
            >
              {resetMsg || (resetting ? "Resetting…" : "Reset demo data")}
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="app-main flex-1">
        <main className="flex-1 px-8 py-8 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
        <footer className="border-t border-ink-700/40 py-3 px-8">
          <p className="text-[11px] font-mono text-ink-600 max-w-[1320px] mx-auto">
            IRS · rule → cache → AI · Every place the model could be wrong, there&apos;s a form, not an assumption.
            {!canWrite && (
              <span className="ml-3 text-stamp-green/70">MSME view — read-only</span>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Invoices list placeholder (routes to exception queue filtered) ──────────
function InvoicesListPage() {
  const navigate = useNavigate();
  // Redirect to exceptions — the invoice list IS the exception queue when viewed flat
  // but with all invoices. We show a simple FolderView-style browser.
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-paper">Invoices</h2>
        <p className="text-sm text-paper/60 mt-1">
          Browse all invoices by folder, vendor, or category.
        </p>
      </div>
      <div className="paper-surface rounded-xl p-8 text-ink text-center space-y-4">
        <FileText size={40} className="mx-auto text-ink-600" strokeWidth={1.2} />
        <div>
          <p className="font-display text-lg font-semibold">Browse by Vendor &amp; Category</p>
          <p className="text-sm text-ink-600 font-sans mt-1">
            Invoices are organized into vendor and category folders.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => navigate("/vendors")}
            className="bg-ink text-paper px-5 py-2 rounded-lg text-sm font-medium
                       hover:bg-ink-700 active:scale-[0.97] transition-all duration-150"
          >
            Browse by Vendor
          </button>
          <button
            onClick={() => navigate("/exceptions")}
            className="bg-stamp-red text-paper px-5 py-2 rounded-lg text-sm font-medium
                       hover:bg-stamp-red/90 active:scale-[0.97] transition-all duration-150"
          >
            View Review Queue
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Route tree ─────────────────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exceptions" element={<ExceptionQueue />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/invoices-list" element={<InvoicesListPage />} />
        <Route path="/upload" element={<UploadBatch />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/folders/:folderName" element={<FolderDetail />} />
        <Route path="/invoices/:id/compare/:targetId" element={<DuplicateComparison />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/audit-trail" element={<AuditTrailPage />} />
        <Route path="/msme-tracker" element={<MsmeTrackerPage />} />
        <Route path="/gstin-logs" element={<GstinLookupsPage />} />
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
