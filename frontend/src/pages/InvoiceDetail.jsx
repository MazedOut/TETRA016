import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Document, Page } from "react-pdf";
import { fetchInvoiceDetail } from "../api/client.js";
import ResolutionForm from "../components/ResolutionForm.jsx";
import VendorCorrectionForm from "../components/VendorCorrectionForm.jsx";

/**
 * Source document preview side-by-side with extracted fields and rule violations.
 */
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
  const [invoice, setInvoice] = useState(null);
  const [showResolve, setShowResolve] = useState(false);
  const [showVendorCorrect, setShowVendorCorrect] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    fetchInvoiceDetail(id).then(setInvoice);
  }, [id]);

  if (!invoice) return <p className="text-sm text-paper/60">Loading invoice…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <Link to="/exceptions" className="text-xs font-mono text-paper/50 hover:text-paper">
            &larr; back to queue
          </Link>
          <h2 className="font-display text-2xl font-semibold mt-1">{invoice.id}</h2>
          <p className="text-sm text-paper/60">{invoice.vendor}</p>
        </div>
        <div className="flex gap-2">
          <a href={buildDisputeMailto(invoice)} className="bg-ink-700 border border-ink-600 text-paper px-4 py-2 rounded-md text-sm font-medium hover:bg-ink-600">
            Draft dispute email
          </a>
          <button
            onClick={() => setShowResolve(true)}
            disabled={resolved}
            className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {resolved ? "Resolved" : "Resolve ticket"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="paper-surface rounded-lg p-4 text-ink min-h-[420px] flex items-center justify-center">
          {invoice.fileUrl ? (
            <Document file={invoice.fileUrl}>
              <Page pageNumber={1} width={380} />
            </Document>
          ) : (
            <div className="text-center text-ink-600 text-sm font-mono p-8">
              <p>Original PDF preview renders here once</p>
              <p>the backend serves invoice.fileUrl.</p>
            </div>
          )}
        </div>

        <div className="paper-surface rounded-lg p-6 text-ink space-y-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold">Extracted fields</h3>
            <button onClick={() => setShowVendorCorrect(true)} className="text-xs font-mono text-stamp-red hover:underline">
              correct vendor details
            </button>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[11px] uppercase tracking-wider text-ink-600 font-mono">Overall extraction confidence</span>
              <span className="text-xs font-mono text-ink-700">{Math.round(invoice.extractionConfidence * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-paper-dim rounded-full overflow-hidden">
              <div className="h-full bg-ink-700 rounded-full" style={{ width: `${invoice.extractionConfidence * 100}%` }} />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {invoice.fields.map((f) => (
              <div key={f.label} className="flex items-center justify-between border-b border-ink-600/10 pb-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-600 font-mono">{f.label}</p>
                  <p className="font-mono text-sm">{f.value}</p>
                </div>
                <span className="text-xs font-mono text-ink-600">{Math.round(f.confidence * 100)}%</span>
              </div>
            ))}
          </div>

          {invoice.flags?.length > 0 && (
            <div className="bg-stamp-red/10 border border-stamp-red/30 rounded-md p-4">
              <p className="text-xs uppercase tracking-wider font-mono text-stamp-red mb-2">Flags raised</p>
              {invoice.flags.map((f, i) => (
                <p key={i} className="text-sm">
                  <span className="font-medium">{f.type}:</span> {f.detail}
                </p>
              ))}
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
