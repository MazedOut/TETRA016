import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import ExceptionQueue from "./pages/ExceptionQueue.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import UploadBatch from "./pages/UploadBatch.jsx";
import Reports from "./pages/Reports.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/upload", label: "Batch Upload" },
  { to: "/exceptions", label: "Exception Queue" },
  { to: "/reports", label: "Reports" },
];

function Shell({ children }) {
  const [mode, setMode] = useState("auditor"); // Auditor / MSME mode toggle

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-600 bg-ink sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="stamp-badge w-9 h-9 text-stamp-red text-[9px] font-mono font-bold flex items-center justify-center">
              IRS
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none">Invoice Risk Scanner</h1>
              <p className="text-[11px] text-ink-600 font-mono tracking-wide">rule &rarr; cache &rarr; AI</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "px-3 py-1.5 text-sm rounded-md font-medium transition-colors " +
                  (isActive ? "bg-paper text-ink" : "text-paper/70 hover:text-paper hover:bg-ink-700")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 bg-ink-700 rounded-full p-1 text-xs font-mono">
            <button
              onClick={() => setMode("auditor")}
              className={"px-3 py-1 rounded-full transition-colors " + (mode === "auditor" ? "bg-paper text-ink" : "text-paper/60")}
            >
              Auditor
            </button>
            <button
              onClick={() => setMode("msme")}
              className={"px-3 py-1 rounded-full transition-colors " + (mode === "msme" ? "bg-paper text-ink" : "text-paper/60")}
            >
              MSME
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-ink-600 py-4">
        <p className="max-w-6xl mx-auto px-6 text-[11px] font-mono text-ink-600">
          Every place the model could be wrong, there's a form, not an assumption.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/exceptions" element={<ExceptionQueue />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/upload" element={<UploadBatch />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
