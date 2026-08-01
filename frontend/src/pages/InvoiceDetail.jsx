import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchInvoiceDetail } from "../api/client.js";
import ResolutionForm from "../components/ResolutionForm.jsx";
import VendorCorrectionForm from "../components/VendorCorrectionForm.jsx";
import { useMode } from "../context/ModeContext.jsx";

const EXCEPTION_TITLES = {
  duplicate_invoice: "Duplicate Invoice Detected",
  invalid_gstin: "Invalid GSTIN Checksum",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Subtotal Math Calculation Error",
  phantom_vendor: "Unregistered / Phantom Vendor",
  typo_squatting_vendor: "Vendor Name Typo-Squatting",
  pdf_metadata_tamper: "PDF Document Metadata Modified",
  invisible_text_detected: "Hidden Text Detected",
  benford_deviation: "Benford Law Numeric Anomaly",
  vendor_activity_anomaly: "Vendor Volume Anomaly",
  needs_review: "Needs Human Review",
};

function confidenceColor(scorePct) {
  if (scorePct >= 80) return "text-stamp-green font-bold";
  if (scorePct >= 60) return "text-stamp-amber font-bold";
  return "text-stamp-red font-bold";
}

function buildDisputeMailto(invoice) {
  const subject = encodeURIComponent(`Query regarding invoice ${invoice.id}`);
  const flagLines = (invoice.flags || []).map((f) => `- ${f.type}: ${f.detail}`).join("\n");
  const body = encodeURIComponent(
    `Hello,\n\nWhile reconciling invoice ${invoice.id}, our system flagged the following:\n\n${flagLines}\n\nCould you confirm or correct the details above at your earliest convenience?\n\nThanks,\n`
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const { mode } = useMode();
  const [invoice, setInvoice] = useState(null);
  const [showResolve, setShowResolve] = useState(false);
  const [showVendorCorrect, setShowVendorCorrect] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    fetchInvoiceDetail(id).then(setInvoice);
  }, [id]);

  if (!invoice) return <p className="text-sm text-paper/60 p-6">Loading invoice…</p>;

  const overallConfPct = Math.round((invoice.extractionConfidence || 0) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <Link to="/exceptions" className="text-xs font-mono text-paper/50 hover:text-paper">
            &larr; back to queue
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="font-display text-2xl font-semibold">{invoice.id}</h2>
            {invoice.folder && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-ink-700 text-paper border border-ink-600">
                📁 {invoice.folder}
              </span>
            )}
          </div>
          <p className="text-sm text-paper/60 mt-0.5">
            {invoice.vendor} &bull; <span className="font-mono text-xs">{invoice.gstin}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.fileUrl && (
            <a
              href={invoice.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-paper text-ink border border-ink-600/30 px-4 py-2 rounded-md text-sm font-medium hover:bg-paper-dim transition-colors"
            >
              📄 View Original Document ↗
            </a>
          )}
          <a
            href={buildDisputeMailto(invoice)}
            className="bg-ink-700 border border-ink-600 text-paper px-4 py-2 rounded-md text-sm font-medium hover:bg-ink-600 transition-colors"
          >
            Draft dispute email
          </a>
          <button
            onClick={() => setShowResolve(true)}
            disabled={resolved}
            className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-stamp-red/90 transition-colors"
          >
            {resolved ? "Resolved" : "Resolve ticket"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Viewer Frame */}
        <div className="paper-surface rounded-lg p-4 text-ink min-h-[460px] flex flex-col items-center justify-center">
          {invoice.fileUrl ? (
            <iframe
              src={invoice.fileUrl}
              title={`Invoice File ${invoice.id}`}
              className="w-full h-[520px] rounded border border-ink-600/20"
            />
          ) : (
            <div className="text-center text-ink-600 text-sm font-mono p-8 space-y-2">
              <p className="font-semibold text-ink">Original PDF / Scan Document</p>
              <p className="text-xs">No stored file bytes associated with this record.</p>
            </div>
          )}
        </div>

        {/* Extracted Fields & Flags */}
        <div className="paper-surface rounded-lg p-6 text-ink space-y-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold">Extracted fields</h3>
            <button onClick={() => setShowVendorCorrect(true)} className="text-xs font-mono text-stamp-red hover:underline">
              correct vendor details
            </button>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[11px] uppercase tracking-wider text-ink-600 font-mono font-bold">
                Overall extraction confidence
              </span>
              <span className={`text-xs font-mono ${confidenceColor(overallConfPct)}`}>{overallConfPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-paper-dim rounded-full overflow-hidden">
              <div
                className={"h-full rounded-full " + (overallConfPct >= 80 ? "bg-stamp-green" : overallConfPct >= 60 ? "bg-stamp-amber" : "bg-stamp-red")}
                style={{ width: `${overallConfPct}%` }}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {invoice.fields?.map((f) => {
              const confPct = Math.round((f.confidence || 0) * 100);
              return (
                <div key={f.label} className="flex items-center justify-between border-b border-ink-600/10 pb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-600 font-mono">{f.label}</p>
                    <p className="font-mono text-sm font-medium">{f.value || <span className="text-ink-600 italic">null</span>}</p>
                  </div>
                  <span className={`text-xs font-mono ${confidenceColor(confPct)}`}>{confPct}%</span>
                </div>
              );
            })}
          </div>

          {invoice.flags?.length > 0 && (
            <div className="bg-stamp-red/10 border border-stamp-red/30 rounded-md p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider font-mono text-stamp-red font-bold">
                Flags raised ({mode === "msme" ? "MSME Plain Language" : "Auditor View"})
              </p>
              {invoice.flags.map((f, i) => {
                const title = mode === "msme" ? (EXCEPTION_TITLES[f.type] || f.type) : f.type;
                const narrative = mode === "msme" ? (f.msmeNarrative || f.detail) : f.detail;
                return (
                  <div key={i} className="text-sm border-b border-stamp-red/20 pb-2 last:border-0 last:pb-0">
                    <span className="font-mono font-semibold text-xs text-stamp-red block">{title}</span>
                    <p className="text-xs mt-1 text-ink leading-relaxed font-sans">{narrative}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showResolve && (
        <ResolutionForm ticketId={invoice.id} onClose={() => setShowResolve(false)} onResolved={() => setResolved(true)} />
      )}

      {showVendorCorrect && (
        <VendorCorrectionForm
          invoiceId={invoice.id}
          initialVendor={invoice.vendor}
          initialGstin={invoice.gstin}
          onClose={() => setShowVendorCorrect(false)}
          onSaved={({ vendor, gstin }) => setInvoice((prev) => ({ ...prev, vendor, gstin }))}
        />
      )}
    </div>
  );
}
