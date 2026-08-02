import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchInvoiceDetail, patchInvoice, verifySeal, fetchForensics, fetchAuditTrail } from "../api/client.js";
import ResolutionForm from "../components/ResolutionForm.jsx";
import VendorCorrectionForm from "../components/VendorCorrectionForm.jsx";
import FindingRow from "../components/FindingRow.jsx";
import { fmtCurrency, fmtPct, sanitiseReason } from "../utils/format.js";
import { useAuth } from "../context/AuthContext.jsx";

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

const STATUS_STYLES = {
  open: "bg-stamp-red/15 text-stamp-red border-stamp-red/30",
  "in-review": "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30",
  resolved: "bg-stamp-green/15 text-stamp-green border-stamp-green/30",
  escalated: "bg-ink/10 text-paper/70 border-ink-600/30",
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

// ------- Edit Fields Panel -------
function EditFieldsPanel({ invoice, onSaved, onClose }) {
  const [edits, setEdits] = useState(() => {
    const init = {};
    (invoice.fields || []).forEach((f) => { init[f.key] = f.value ?? ""; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    // Compute only changed fields
    const changed = {};
    (invoice.fields || []).forEach((f) => {
      if (String(edits[f.key] ?? "") !== String(f.value ?? "")) {
        changed[f.key] = edits[f.key];
      }
    });
    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await patchInvoice(invoice.id, changed);
      setSaved(true);
      onSaved(result);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err?.response?.data?.detail || "Save failed — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="paper-surface rounded-xl p-6 text-ink space-y-4 border-2 border-stamp-amber/40">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Edit Extracted Fields</h3>
          <p className="text-xs font-mono text-ink-600 mt-0.5">
            Correcting a field does <strong>not</strong> auto-resolve related tickets.
            After saving, review and resolve any open flags manually.
          </p>
        </div>
        <button onClick={onClose} className="text-ink-600 hover:text-ink text-lg leading-none px-2">✕</button>
      </div>

      <div className="bg-stamp-amber/10 border border-stamp-amber/30 rounded-md px-4 py-2.5 text-xs font-mono text-ink flex items-start gap-2">
        <span className="text-stamp-amber shrink-0">⚠</span>
        <span>
          This creates an immutable audit log entry recording who changed what.
          Changes apply to the extracted data only — the original document is unchanged.
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {(invoice.fields || []).map((f) => (
          <div key={f.key} className="space-y-0.5">
            <label className="block text-xs font-mono text-ink-600 uppercase tracking-wider">
              {f.label}
              <span className={`ml-2 ${confidenceColor(Math.round((f.confidence || 0) * 100))}`}>
                {Math.round((f.confidence || 0) * 100)}% confidence
              </span>
            </label>
            <input
              type="text"
              value={edits[f.key] ?? ""}
              onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-stamp-amber/60 transition-colors"
            />
          </div>
        ))}

        {error && <p className="text-stamp-red text-xs font-mono">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || saved}
            className="bg-stamp-amber text-ink px-5 py-2 rounded-lg text-sm font-semibold
                       hover:bg-stamp-amber/90 active:scale-[0.97] disabled:opacity-50
                       transition-all duration-150"
          >
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save corrections"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-ink-600
                       hover:text-ink hover:bg-ink/5 active:scale-[0.97] transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ------- Edit History Log -------
function EditHistoryLog({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <div className="bg-ink-800 rounded-lg border border-ink-600/30 p-5 space-y-3">
      <h4 className="text-xs uppercase tracking-widest font-mono text-paper/50 font-bold flex items-center gap-2">
        <span>📋</span> Field Edit Audit Trail
      </h4>
      <div className="space-y-2">
        {[...history].reverse().map((entry, i) => (
          <div key={i} className="text-xs font-mono border-b border-ink-600/20 pb-2 last:border-0 last:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-paper/70">
                <span className="text-stamp-amber font-semibold">{entry.actor}</span>
                {" changed "}
                <span className="text-paper font-semibold">{entry.field?.replace(/_/g, " ")}</span>
              </span>
              <span className="text-paper/40">{entry.timestamp?.slice(0, 19).replace("T", " ")} UTC</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px]">
              <span className="text-stamp-red line-through opacity-60">{entry.old_value ?? "null"}</span>
              <span className="text-paper/40">→</span>
              <span className="text-stamp-green">{entry.new_value ?? "null"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------- Main Component -------
export default function InvoiceDetail() {
  const { id } = useParams();
  const { mode, canWrite } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [showResolve, setShowResolve] = useState(false);
  const [showVendorCorrect, setShowVendorCorrect] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [sealStatus, setSealStatus] = useState(null);
  const [sealData, setSealData] = useState(null);
  const [forensics, setForensics] = useState(null);
  const [auditTrail, setAuditTrail] = useState(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditFilter, setAuditFilter] = useState('all');

  useEffect(() => {
    fetchInvoiceDetail(id).then((inv) => {
      setInvoice(inv);
      fetchForensics(id).then(setForensics).catch(() => {});
    });
  }, [id]);

  async function handleVerifySeal() {
    setSealStatus('loading');
    try {
      const result = await verifySeal(invoice.id);
      setSealData(result);
      setSealStatus(result.valid ? 'valid' : 'invalid');
    } catch {
      setSealStatus('invalid');
    }
  }

  async function handleOpenAuditTrail() {
    setShowAuditPanel(true);
    if (!auditTrail) {
      try {
        const result = await fetchAuditTrail(invoice.id);
        setAuditTrail(result.events || []);
      } catch {
        setAuditTrail([]);
      }
    }
  }

  if (!invoice) return <p className="text-sm text-paper/60 p-6">Loading invoice…</p>;

  const overallConfPct = Math.round((invoice.extractionConfidence || 0) * 100);
  const openFlags = (invoice.flags || []).filter((f) => f.status === "open" || f.status === "in-review");

  function handleEditSaved(result) {
    // Refresh the invoice detail so new field values show immediately
    fetchInvoiceDetail(id).then(setInvoice);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link to="/exceptions" className="text-xs font-mono text-paper/50 hover:text-paper">
            &larr; back to queue
          </Link>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h2 className="font-display text-2xl font-semibold text-paper">{invoice.id}</h2>
            {invoice.folder && (
              <Link
                to={`/folders/${encodeURIComponent(invoice.folder)}`}
                className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-ink-700 text-paper border border-ink-600 hover:border-ink-600/80 transition-colors"
              >
                📁 {invoice.folder}
              </Link>
            )}
            {invoice.riskLevel && (
              <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                invoice.riskLevel === "high"
                  ? "bg-stamp-red/15 text-stamp-red border-stamp-red/30"
                  : invoice.riskLevel === "medium"
                  ? "bg-stamp-amber/15 text-stamp-amber border-stamp-amber/30"
                  : "bg-stamp-green/15 text-stamp-green border-stamp-green/30"
              }`}>
                Risk {invoice.riskScore} · {invoice.riskLevel?.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-sm text-paper/60 mt-0.5">
            {invoice.vendor} &bull; <span className="font-mono text-xs">{invoice.gstin}</span>
          </p>
          
          <div className="flex gap-4 mt-4 text-paper">
            <div className="bg-stamp-red/10 border border-stamp-red/20 rounded px-3 py-1.5 flex flex-col">
              <span className="text-[10px] text-stamp-red uppercase font-mono tracking-wide">ITC At Risk</span>
              <span className="font-display font-semibold text-lg text-stamp-red">₹{Number(invoice.financialExposure?.itcAtRisk || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="bg-stamp-amber/10 border border-stamp-amber/20 rounded px-3 py-1.5 flex flex-col">
              <span className="text-[10px] text-stamp-amber uppercase font-mono tracking-wide">MSME Exposure</span>
              <span className="font-display font-semibold text-lg text-stamp-amber">₹{Number(invoice.financialExposure?.msmePenalty || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {invoice.fileUrl && (
            <a
              href={invoice.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-paper text-ink border border-ink-600/30 px-4 py-2 rounded-md text-sm font-medium hover:bg-paper-dim transition-colors"
            >
              📄 View Document ↗
            </a>
          )}
          <a
            href={buildDisputeMailto(invoice)}
            className="bg-ink-700 border border-ink-600 text-paper px-4 py-2 rounded-lg text-sm font-medium
                       hover:bg-ink-600 active:scale-[0.97] transition-all duration-150"
          >
            Draft dispute email
          </a>
          <button
            onClick={handleOpenAuditTrail}
            className="bg-ink-700 border border-ink-600 text-paper px-4 py-2 rounded-md text-sm font-medium hover:bg-ink-600 transition-colors"
          >
            📜 Audit Trail
          </button>
          {canWrite && (
            <>
              <button
                onClick={() => setShowEdit(!showEdit)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                  showEdit
                    ? "bg-stamp-amber/20 text-stamp-amber border-stamp-amber/40"
                    : "bg-ink-700 border-ink-600 text-paper hover:bg-ink-600"
                }`}
              >
                {showEdit ? "✕ Cancel edit" : "✏ Edit fields"}
              </button>
              <button
                onClick={() => setShowResolve(true)}
                disabled={resolved}
                className="bg-stamp-red text-paper px-4 py-2 rounded-lg text-sm font-medium
                           disabled:opacity-50 hover:bg-stamp-red/90 active:scale-[0.97]
                           transition-all duration-150"
              >
                {resolved ? "Resolved ✓" : "Resolve ticket"}
              </button>
            </>
          )}
          {!canWrite && (
            <span className="text-xs font-mono px-3 py-2 rounded-md bg-ink-700 text-paper/50 border border-ink-600/30">
              MSME view — read only
            </span>
          )}
        </div>
      </div>

      {/* ═══ Cryptographic Seal Badge ═══ */}
      {invoice.seal && (
        <div className={`rounded-lg p-4 border-2 flex items-center justify-between flex-wrap gap-3 transition-all duration-500 ${
          sealStatus === 'valid' ? 'bg-stamp-green/10 border-stamp-green/40' :
          sealStatus === 'invalid' ? 'bg-stamp-red/10 border-stamp-red/40' :
          'bg-ink-700 border-ink-600/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
              sealStatus === 'valid' ? 'bg-stamp-green/20 text-stamp-green' :
              sealStatus === 'invalid' ? 'bg-stamp-red/20 text-stamp-red' :
              'bg-ink-600 text-paper/60'
            }`}>
              {sealStatus === 'valid' ? '🔒' : sealStatus === 'invalid' ? '🔓' : '🛡️'}
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-mono font-bold text-paper/60">
                Cryptographic Seal
                {sealStatus === 'valid' && <span className="ml-2 text-stamp-green">VERIFIED ✓</span>}
                {sealStatus === 'invalid' && <span className="ml-2 text-stamp-red">TAMPERED ✗</span>}
              </h4>
              <p className="text-xs font-mono text-paper/40 mt-0.5">
                {invoice.seal.algorithm} · Sealed {invoice.seal.sealed_at ? new Date(invoice.seal.sealed_at).toLocaleString() : 'N/A'}
              </p>
              <p className="text-[11px] font-mono text-paper/30 mt-0.5 break-all">
                {invoice.seal.hash}
              </p>
            </div>
          </div>
          <button
            onClick={handleVerifySeal}
            disabled={sealStatus === 'loading'}
            className={`px-4 py-2 rounded-md text-sm font-medium font-mono transition-all ${
              sealStatus === 'loading' ? 'bg-ink-600 text-paper/50 cursor-wait' :
              sealStatus === 'valid' ? 'bg-stamp-green/20 text-stamp-green border border-stamp-green/40 hover:bg-stamp-green/30' :
              sealStatus === 'invalid' ? 'bg-stamp-red/20 text-stamp-red border border-stamp-red/40 hover:bg-stamp-red/30' :
              'bg-paper text-ink hover:bg-paper-dim border border-ink-600/30'
            }`}
          >
            {sealStatus === 'loading' ? '⏳ Verifying…' :
             sealStatus === 'valid' ? '✅ Seal Intact' :
             sealStatus === 'invalid' ? '🔄 Re-verify' :
             '🔐 Verify Seal'}
          </button>
        </div>
      )}

      {/* ═══ Forensic Metadata Analysis ═══ */}
      {forensics && (forensics.producer || forensics.creator || forensics.software_flags?.length > 0 || forensics.date_anomalies?.length > 0) && (
        <div className="bg-ink-800 rounded-lg border border-ink-600/30 p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-mono text-paper/50 font-bold flex items-center gap-2">
            <span>🔬</span> Forensic Metadata Analysis
            {forensics.software_flags?.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-stamp-red/20 text-stamp-red border border-stamp-red/30 text-[10px]">
                {forensics.software_flags.length} alert{forensics.software_flags.length > 1 ? 's' : ''}
              </span>
            )}
          </h3>

          {/* Software warnings */}
          {forensics.software_flags?.map((flag, i) => (
            <div key={i} className="bg-stamp-red/10 border border-stamp-red/30 rounded-md px-4 py-3 flex items-start gap-3">
              <span className="text-stamp-red text-lg shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-stamp-red">{flag.message}</p>
                <p className="text-xs text-paper/50 font-mono mt-0.5">
                  Detected in: {flag.detected_in || 'metadata'} · Severity: {flag.severity?.toUpperCase()}
                </p>
              </div>
            </div>
          ))}

          {/* Date anomalies */}
          {forensics.date_anomalies?.map((anomaly, i) => (
            <div key={i} className="bg-stamp-amber/10 border border-stamp-amber/30 rounded-md px-4 py-3 flex items-start gap-3">
              <span className="text-stamp-amber text-lg shrink-0">📅</span>
              <div>
                <p className="text-sm font-semibold text-stamp-amber">{anomaly.message}</p>
                <p className="text-xs text-paper/50 font-mono mt-0.5">Severity: {anomaly.severity?.toUpperCase()}</p>
              </div>
            </div>
          ))}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Producer', forensics.producer],
              ['Creator', forensics.creator],
              ['OS / Platform', forensics.os_platform],
              ['Pages', forensics.page_count],
              ['Created', forensics.creation_date],
              ['Modified', forensics.modification_date],
              ['File Size', forensics.file_size_bytes ? `${(forensics.file_size_bytes / 1024).toFixed(1)} KB` : null],
              ['Risk Contribution', forensics.risk_score_contribution ? `+${forensics.risk_score_contribution} pts` : '0'],
            ].map(([label, value]) => (
              <div key={label} className="bg-ink-700/50 rounded-md px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-paper/40 font-mono">{label}</p>
                <p className="text-sm font-mono text-paper/80 mt-0.5 truncate" title={value || '—'}>
                  {value || <span className="text-paper/30 italic">N/A</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Clean indicator */}
          {forensics.software_flags?.length === 0 && forensics.date_anomalies?.length === 0 && (
            <div className="bg-stamp-green/10 border border-stamp-green/30 rounded-md px-4 py-2.5 flex items-center gap-2 text-sm">
              <span className="text-stamp-green">✅</span>
              <span className="text-stamp-green font-medium">No forensic anomalies detected — document metadata appears clean</span>
            </div>
          )}
        </div>
      )}

      {/* Edit form (Auditor only) */}
      {showEdit && canWrite && (
        <EditFieldsPanel
          invoice={invoice}
          onSaved={handleEditSaved}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Open flags notice */}
      {openFlags.length > 0 && showEdit && (
        <div className="bg-stamp-red/10 border border-stamp-red/30 rounded-lg px-4 py-3 text-xs font-mono text-stamp-red">
          ⚠ {openFlags.length} open flag{openFlags.length !== 1 ? "s" : ""} on this invoice.
          Editing extracted fields does <strong>not</strong> auto-resolve them.
          Please review and resolve each flag manually after saving your corrections.
        </div>
      )}

      {/* AI Risk Brief */}
      {invoice.flags?.length > 0 && (
        <div className="bg-ink-800 rounded-lg border-l-4 border-stamp-amber p-5 text-paper">
          <h3 className="text-xs uppercase tracking-widest font-mono text-stamp-amber font-bold mb-2 flex items-center gap-2">
            <span>🤖</span> AI Risk Brief
          </h3>
          <p className="text-sm font-sans leading-relaxed text-paper/90">
            {invoice.flags
              .map(f => (mode === "msme" ? f.msmeNarrative : f.detail))
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Viewer */}
        <div className="paper-surface rounded-xl p-4 text-ink min-h-[460px] flex flex-col items-center justify-center">
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
        <div className="paper-surface rounded-xl p-6 text-ink space-y-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold">Extracted fields</h3>
            {canWrite && (
              <button
                onClick={() => setShowVendorCorrect(true)}
                className="text-xs font-mono text-stamp-red hover:underline"
              >
                correct vendor details
              </button>
            )}
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[11px] uppercase tracking-wider text-ink-600 font-mono font-bold">
                Overall extraction confidence
              </span>
              <span className={`text-xs font-mono ${confidenceColor(overallConfPct)}`}>{overallConfPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-paper-dim rounded-full overflow-hidden">
              <div
                className={
                  "h-full rounded-full " +
                  (overallConfPct >= 80 ? "bg-stamp-green" : overallConfPct >= 60 ? "bg-stamp-amber" : "bg-stamp-red")
                }
                style={{ width: `${overallConfPct}%` }}
              />
            </div>
          </div>

          {/* Field rows */}
          <div className="space-y-3 pt-2">
            {invoice.fields?.map((f) => {
              const confPct = Math.round((f.confidence || 0) * 100);
              return (
                <div key={f.key || f.label} className="flex items-center justify-between border-b border-ink-600/10 pb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-600 font-mono">{f.label}</p>
                    <p className="font-mono text-sm font-medium">
                      {f.value || <span className="text-ink-600 italic">null</span>}
                    </p>
                  </div>
                  <span className={`text-xs font-mono ${confidenceColor(confPct)}`}>{confPct}%</span>
                </div>
              );
            })}
          </div>

          {/* Evidence Chain Visual */}
          {invoice.flags?.length > 0 && (
            <div className="bg-stamp-red/5 border border-stamp-red/20 rounded-md p-5 mt-6">
              <p className="text-xs uppercase tracking-wider font-mono text-stamp-red font-bold mb-4">
                Evidence Chain ({mode === "msme" ? "MSME Plain Language" : "Auditor View"})
              </p>
              <div className="relative border-l border-stamp-red/30 ml-2 space-y-6">
                {invoice.flags.map((f, i) => (
                  <FindingRow key={i} flag={f} mode={mode}>
                    {f.evidenceData?.duplicate_invoice_id && (
                      <Link
                        to={`/invoices/${invoice.id}/compare/${f.evidenceData.duplicate_invoice_id}`}
                        className="text-[10px] ml-2 font-mono px-2 py-0.5 rounded-full bg-stamp-amber text-ink font-bold hover:brightness-110"
                      >
                        COMPARE TARGET ↗
                      </Link>
                    )}
                  </FindingRow>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit history */}
      <EditHistoryLog history={invoice.editHistory} />

      {/* Modals */}
      {showResolve && (
        <ResolutionForm
          ticketId={invoice.id}
          onClose={() => setShowResolve(false)}
          onResolved={() => setResolved(true)}
        />
      )}

      {showVendorCorrect && (
        <VendorCorrectionForm
          invoiceId={invoice.id}
          initialVendor={invoice.vendor}
          initialGstin={invoice.gstin}
          onClose={() => setShowVendorCorrect(false)}
          onSaved={({ vendor, gstin }) =>
            setInvoice((prev) => ({ ...prev, vendor, gstin }))
          }
        />
      )}

      {/* ═══ Audit Trail Slide-out Panel ═══ */}
      {showAuditPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/60 z-40 transition-opacity"
            onClick={() => setShowAuditPanel(false)}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-ink-800 border-l border-ink-600 z-50 flex flex-col shadow-2xl animate-slideIn">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-600/40">
              <div>
                <h3 className="font-display text-lg font-semibold text-paper">Audit Trail</h3>
                <p className="text-xs font-mono text-paper/40 mt-0.5">
                  {invoice.id} · {auditTrail?.length || 0} events
                </p>
              </div>
              <button
                onClick={() => setShowAuditPanel(false)}
                className="text-paper/50 hover:text-paper text-xl leading-none px-2 py-1 rounded hover:bg-ink-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Filter bar */}
            <div className="px-5 py-3 border-b border-ink-600/20 flex gap-1.5 flex-wrap">
              {['all', 'pipeline', 'validation', 'forensics', 'scoring', 'ai', 'security', 'audit'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setAuditFilter(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    auditFilter === cat
                      ? 'bg-paper text-ink font-semibold'
                      : 'text-paper/50 hover:text-paper hover:bg-ink-700'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!auditTrail ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-ink-600/40" />

                  <div className="space-y-1">
                    {auditTrail
                      .filter(e => auditFilter === 'all' || e.category === auditFilter)
                      .map((event, i) => {
                        const time = event.timestamp
                          ? new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '';
                        const date = event.timestamp
                          ? new Date(event.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : '';

                        const categoryColor = {
                          pipeline: 'border-paper/30 text-paper/70',
                          validation: 'border-stamp-amber/50 text-stamp-amber',
                          forensics: 'border-stamp-red/50 text-stamp-red',
                          scoring: 'border-paper/30 text-paper/70',
                          ai: 'border-stamp-amber/50 text-stamp-amber',
                          security: 'border-stamp-green/50 text-stamp-green',
                          audit: 'border-paper/30 text-paper/70',
                        }[event.category] || 'border-paper/30 text-paper/70';

                        return (
                          <div key={i} className="relative pl-10 py-2.5 group">
                            {/* Timeline dot */}
                            <div className={`absolute left-2.5 top-3.5 w-3 h-3 rounded-full border-2 bg-ink-800 ${categoryColor} group-hover:scale-125 transition-transform`} />

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm">{event.icon}</span>
                                  <span className="text-sm font-semibold text-paper">{event.label}</span>
                                </div>
                                {event.detail && (
                                  <p className="text-xs text-paper/50 font-mono mt-0.5 break-words">{event.detail}</p>
                                )}
                                <p className="text-[10px] text-paper/30 font-mono mt-0.5">
                                  {event.actor !== 'system' && <span className="text-stamp-amber">{event.actor} · </span>}
                                  {date} {time}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {auditTrail.filter(e => auditFilter === 'all' || e.category === auditFilter).length === 0 && (
                      <p className="text-center text-paper/40 text-sm font-mono py-8">No events for this filter</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
