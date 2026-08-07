import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchInvoiceDetail,
  patchInvoice,
  verifySeal,
  fetchForensics,
  fetchAuditTrail,
  fetchTickets,
} from "../api/client.js";
import ResolutionForm from "../components/ResolutionForm.jsx";
import EscalationForm from "../components/EscalationForm.jsx";
import VendorCorrectionForm from "../components/VendorCorrectionForm.jsx";
import FindingRow from "../components/FindingRow.jsx";
import { fmtCurrency } from "../utils/format.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  ArrowLeft,
  FileText,
  Download,
  Mail,
  ShieldCheck,
  ShieldX,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  GitCompare,
  Clock,
  Edit3,
  CheckCheck,
  ArrowUpRight,
  X,
  Cpu,
  Brain,
  Database,
} from "lucide-react";

// ─── Exception labels (user-facing) ─────────────────────────────────────────
const EXCEPTION_TITLES = {
  duplicate_invoice: "Duplicate Invoice Detected",
  invalid_gstin: "Invalid GSTIN Checksum",
  amount_mismatch: "Amount / Tax Mismatch",
  internal_math_error: "Subtotal Calculation Error",
  phantom_vendor: "Unregistered / Phantom Vendor",
  typo_squatting_vendor: "Vendor Name Typo-Squatting",
  pdf_metadata_tamper: "Document Metadata Anomaly",
  invisible_text_detected: "Hidden Text Detected",
  benford_deviation: "Benford Law Numeric Anomaly",
  vendor_activity_anomaly: "Vendor Activity Anomaly",
  needs_review: "Needs Human Review",
};

const MSME_EXCEPTION_TITLES = {
  duplicate_invoice: "Possible duplicate invoice",
  invalid_gstin: "GST number may be invalid",
  amount_mismatch: "Invoice amount doesn't match",
  internal_math_error: "Calculation looks incorrect",
  phantom_vendor: "Supplier may not be registered",
  typo_squatting_vendor: "Supplier name looks suspicious",
  pdf_metadata_tamper: "Document may have been modified",
  invisible_text_detected: "Document contains hidden content",
  benford_deviation: "Unusual number pattern",
  vendor_activity_anomaly: "Unusual billing pattern from this supplier",
  needs_review: "Needs review",
};

// ─── Risk level config ───────────────────────────────────────────────────────
function riskConfig(score) {
  if (score >= 75) return { label: "CRITICAL RISK", color: "text-stamp-red", bg: "bg-stamp-red", border: "border-stamp-red/30" };
  if (score >= 50) return { label: "HIGH RISK", color: "text-stamp-red", bg: "bg-stamp-red", border: "border-stamp-red/25" };
  if (score >= 25) return { label: "MEDIUM RISK", color: "text-stamp-amber", bg: "bg-stamp-amber", border: "border-stamp-amber/25" };
  return { label: "LOW RISK", color: "text-stamp-green", bg: "bg-stamp-green", border: "border-stamp-green/25" };
}

// ─── Confidence color ────────────────────────────────────────────────────────
function confColor(pct) {
  if (pct >= 80) return "text-stamp-green";
  if (pct >= 60) return "text-stamp-amber";
  return "text-stamp-red";
}

// ─── Build mailto link ───────────────────────────────────────────────────────
function buildDisputeMailto(invoice) {
  const subject = encodeURIComponent(`Query regarding invoice ${invoice.id}`);
  const flagLines = (invoice.flags || []).map((f) => `- ${f.type}: ${f.detail}`).join("\n");
  const body = encodeURIComponent(
    `Hello,\n\nWhile reconciling invoice ${invoice.id}, our system flagged the following:\n\n${flagLines}\n\nCould you confirm or correct the details above at your earliest convenience?\n\nThanks,\n`
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

// ─── Edit Fields Panel ────────────────────────────────────────────────────────
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
    const changed = {};
    (invoice.fields || []).forEach((f) => {
      if (String(edits[f.key] ?? "") !== String(f.value ?? "")) {
        changed[f.key] = edits[f.key];
      }
    });
    if (Object.keys(changed).length === 0) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      const result = await patchInvoice(invoice.id, changed);
      setSaved(true);
      onSaved(result);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err?.response?.data?.detail || "Save failed — check connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-4">
      <div className="bg-ink-800 border border-ink-600/60 rounded-xl p-6 w-full max-w-lg
                      shadow-elev-3 space-y-4 animate-scaleIn">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-paper">Edit Extracted Fields</h3>
            <p className="text-xs font-mono text-paper/40 mt-0.5">
              Changes are logged immutably to the audit trail
            </p>
          </div>
          <button onClick={onClose} className="text-paper/40 hover:text-paper p-1 rounded">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="bg-stamp-amber/5 border border-stamp-amber/20 rounded-lg px-4 py-2.5
                        flex items-start gap-2 text-xs font-mono text-paper/60">
          <AlertTriangle size={12} className="text-stamp-amber shrink-0 mt-0.5" strokeWidth={2} />
          <span>Editing fields does not auto-resolve related tickets. Review flags manually after saving.</span>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          {(invoice.fields || []).map((f) => {
            const confPct = Math.round((f.confidence || 0) * 100);
            return (
              <div key={f.key} className="space-y-0.5">
                <label className="flex items-center justify-between text-xs font-mono text-paper/50 uppercase tracking-wider">
                  <span>{f.label}</span>
                  <span className={`${confColor(confPct)} font-semibold`}>{confPct}% confidence</span>
                </label>
                <input
                  type="text"
                  value={edits[f.key] ?? ""}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-ink-700 border border-ink-600/40 rounded-lg px-3 py-2
                             text-sm font-mono text-paper focus:outline-none focus:border-ink-600
                             transition-colors"
                />
              </div>
            );
          })}
          {error && <p className="text-stamp-red text-xs font-mono">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || saved}
              className="bg-stamp-amber text-ink px-5 py-2 rounded-lg text-sm font-semibold
                         hover:bg-stamp-amber/90 active:scale-[0.97] disabled:opacity-50 transition-all"
            >
              {saved ? "Saved" : saving ? "Saving…" : "Save Corrections"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-paper/50
                         hover:text-paper hover:bg-ink-700 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit History ────────────────────────────────────────────────────────────
function EditHistoryLog({ history }) {
  const [open, setOpen] = useState(false);
  if (!history || history.length === 0) return null;
  return (
    <div className="bg-ink-800 border border-ink-600/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3
                   hover:bg-ink-700/40 transition-colors"
      >
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
          Field Edit History ({history.length})
        </span>
        {open ? (
          <ChevronUp size={13} className="text-paper/30" strokeWidth={2} />
        ) : (
          <ChevronDown size={13} className="text-paper/30" strokeWidth={2} />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2">
          {[...history].reverse().map((entry, i) => (
            <div key={i} className="text-xs font-mono border-b border-ink-600/20 pb-2 last:border-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-paper/60">
                  <span className="text-stamp-amber font-semibold">{entry.actor}</span>
                  {" changed "}
                  <span className="text-paper font-semibold">{entry.field?.replace(/_/g, " ")}</span>
                </span>
                <span className="text-paper/30">{entry.timestamp?.slice(0, 19).replace("T", " ")} UTC</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px]">
                <span className="text-stamp-red line-through opacity-60">{entry.old_value ?? "null"}</span>
                <span className="text-paper/30">→</span>
                <span className="text-stamp-green">{entry.new_value ?? "null"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main InvoiceDetail ───────────────────────────────────────────────────────
export default function InvoiceDetail() {
  const { id } = useParams();
  const { mode, canWrite } = useAuth();
  const isMsme = mode === "msme";

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
  const [auditFilter, setAuditFilter] = useState("all");
  const [showForensicsDetail, setShowForensicsDetail] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (invoice?.id) {
      fetchTickets().then(allTickets => {
        const myTickets = allTickets.filter(t => t.invoiceId === invoice.id);
        setTickets(myTickets);
      });
    }
  }, [invoice?.id]);

  useEffect(() => {
    fetchInvoiceDetail(id).then((inv) => {
      setInvoice(inv);
      fetchForensics(id).then(setForensics).catch(() => {});
    });
  }, [id]);

  async function handleVerifySeal() {
    setSealStatus("loading");
    try {
      const result = await verifySeal(invoice.id);
      setSealData(result);
      setSealStatus(result.valid ? "valid" : "invalid");
    } catch {
      setSealStatus("invalid");
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

  function handleEditSaved() {
    fetchInvoiceDetail(id).then(setInvoice);
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-64 space-y-3">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-paper/20 border-t-paper/60 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-paper/40 font-mono">Loading invoice…</p>
        </div>
      </div>
    );
  }

  const overallConfPct = Math.round((invoice.extractionConfidence || 0) * 100);
  const risk = riskConfig(invoice.riskScore || 0);
  const openFlags = (invoice.flags || []).filter(
    (f) => f.status === "open" || f.status === "in-review"
  );

  // Risk score progress: distribute evenly across flags for display
  const totalWeight = (invoice.flags || []).reduce(
    (s, f) => s + (f.riskContribution || 10), 0
  );

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link
            to="/exceptions"
            className="flex items-center gap-1.5 text-xs font-mono text-paper/40
                       hover:text-paper/70 transition-colors mb-2"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Back to Review Queue
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-xl font-bold text-paper">{invoice.id}</h2>
            {invoice.folder && (
              <Link
                to={`/folders/${encodeURIComponent(invoice.folder)}`}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink-700 text-paper/50
                           border border-ink-600/30 hover:border-ink-600/60 transition-colors"
              >
                {invoice.folder}
              </Link>
            )}
            {invoice.riskScore !== undefined && (
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border
                            ${risk.color} bg-opacity-10`}
                style={{ background: `rgba(178,58,46,0.08)` }}
              >
                {risk.label} · {invoice.riskScore}
              </span>
            )}
          </div>
          <div className="text-sm text-paper/50 mt-0.5 font-sans flex items-center gap-2 flex-wrap">
            <span>{invoice.vendor}</span>
            {invoice.gstin && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-paper/30">{invoice.gstin}</span>
                {invoice.registryStatus && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    invoice.registryStatus.registry_status === 'verified' 
                      ? 'bg-stamp-green/10 text-stamp-green border-stamp-green/20'
                      : invoice.registryStatus.registry_status === 'unchecked'
                        ? 'bg-ink-600/20 text-paper/50 border-ink-600/30'
                        : 'bg-stamp-red/10 text-stamp-red border-stamp-red/20'
                  }`}>
                    {invoice.registryStatus.registry_status === 'verified' ? 'Verified (Live)' : 
                     invoice.registryStatus.registry_status === 'unchecked' ? 'Skipped / Cached' : 
                     'Warning: ' + invoice.registryStatus.registry_status.toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Header action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.fileUrl && (
            <>
              <a
                href={invoice.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                           bg-ink-700 border border-ink-600/40 text-paper/70 hover:text-paper
                           hover:border-ink-600 transition-all duration-150"
              >
                <ArrowUpRight size={12} strokeWidth={2} />
                View Document
              </a>
              <a
                href={invoice.fileUrl}
                download
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                           bg-ink-700 border border-ink-600/40 text-paper/70 hover:text-paper
                           hover:border-ink-600 transition-all duration-150"
              >
                <Download size={12} strokeWidth={2} />
                Download
              </a>
            </>
          )}
          <a
            href={buildDisputeMailto(invoice)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                       bg-ink-700 border border-ink-600/40 text-paper/70 hover:text-paper
                       hover:border-ink-600 transition-all duration-150"
          >
            <Mail size={12} strokeWidth={2} />
            Draft Email
          </a>
          <button
            onClick={handleOpenAuditTrail}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                       bg-ink-700 border border-ink-600/40 text-paper/70 hover:text-paper
                       hover:border-ink-600 transition-all duration-150"
          >
            <Clock size={12} strokeWidth={2} />
            Audit Trail
          </button>
          {canWrite && (
            <>
              <button
                onClick={() => setShowEdit(!showEdit)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                             border transition-all duration-150 ${
                               showEdit
                                 ? "bg-stamp-amber/10 text-stamp-amber border-stamp-amber/40"
                                 : "bg-ink-700 border-ink-600/40 text-paper/70 hover:text-paper hover:border-ink-600"
                             }`}
              >
                <Edit3 size={12} strokeWidth={2} />
                {showEdit ? "Cancel Edit" : "Edit Fields"}
              </button>
              <button
                onClick={() => setShowResolve(true)}
                disabled={resolved}
                className="flex items-center gap-1.5 bg-stamp-red text-paper px-4 py-2 rounded-lg
                           text-xs font-semibold hover:bg-stamp-red/90 active:scale-[0.97]
                           disabled:opacity-50 transition-all duration-150"
              >
                <CheckCheck size={12} strokeWidth={2} />
                {resolved ? "Resolved" : "Resolve Ticket"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Financial exposure strip ── */}
      {(invoice.financialExposure?.itcAtRisk > 0 || invoice.financialExposure?.msmePenalty > 0) && (
        <div className="flex gap-3 flex-wrap">
          {invoice.financialExposure?.itcAtRisk > 0 && (
            <div className="bg-stamp-red/8 border border-stamp-red/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
              <div>
                <p className="text-[10px] font-mono text-stamp-red/70 uppercase tracking-wider">
                  {isMsme ? "Tax Credit at Risk" : "ITC at Risk"}
                </p>
                <p className="font-display text-lg font-bold text-stamp-red leading-none mt-0.5">
                  {fmtCurrency(invoice.financialExposure.itcAtRisk)}
                </p>
              </div>
            </div>
          )}
          {invoice.financialExposure?.msmePenalty > 0 && (
            <div className="bg-stamp-amber/8 border border-stamp-amber/20 rounded-lg px-4 py-2.5">
              <p className="text-[10px] font-mono text-stamp-amber/70 uppercase tracking-wider">
                {isMsme ? "Late Payment Risk" : "MSME Exposure"}
              </p>
              <p className="font-display text-lg font-bold text-stamp-amber leading-none mt-0.5">
                {fmtCurrency(invoice.financialExposure.msmePenalty)}
              </p>
            </div>
          )}
          {isMsme && invoice.financialExposure?.itcAtRisk > 0 && (
            <div className="flex-1 bg-ink-800 border border-ink-600/20 rounded-lg px-4 py-2.5">
              <p className="text-xs text-paper/60 font-sans leading-relaxed">
                You may not be able to claim{" "}
                <span className="font-semibold text-stamp-red">
                  {fmtCurrency(invoice.financialExposure.itcAtRisk)}
                </span>{" "}
                of tax credit until the flagged issues are resolved.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Cryptographic seal ── */}
      {invoice.seal && (
        <div
          className={`rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap
                       transition-all duration-500 ${
                         sealStatus === "valid"
                           ? "bg-stamp-green/5 border-stamp-green/25"
                           : sealStatus === "invalid"
                           ? "bg-stamp-red/5 border-stamp-red/25"
                           : "bg-ink-800 border-ink-600/25"
                       }`}
        >
          <div className="flex items-center gap-3">
            {sealStatus === "valid" ? (
              <ShieldCheck size={20} className="text-stamp-green" strokeWidth={1.8} />
            ) : sealStatus === "invalid" ? (
              <ShieldX size={20} className="text-stamp-red" strokeWidth={1.8} />
            ) : (
              <Shield size={20} className="text-paper/30" strokeWidth={1.8} />
            )}
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-paper/50">
                Cryptographic Seal
                {sealStatus === "valid" && (
                  <span className="ml-2 text-stamp-green">VERIFIED</span>
                )}
                {sealStatus === "invalid" && (
                  <span className="ml-2 text-stamp-red">TAMPERED</span>
                )}
              </p>
              <p className="text-[11px] font-mono text-paper/30 mt-0.5">
                {invoice.seal.algorithm} · Sealed{" "}
                {invoice.seal.sealed_at
                  ? new Date(invoice.seal.sealed_at).toLocaleString()
                  : "N/A"}
              </p>
              <p className="text-[10px] font-mono text-paper/20 mt-0.5 break-all max-w-sm">
                {invoice.seal.hash}
              </p>
            </div>
          </div>
          <button
            onClick={handleVerifySeal}
            disabled={sealStatus === "loading"}
            className={`text-xs font-mono px-4 py-2 rounded-lg border transition-all ${
              sealStatus === "loading"
                ? "bg-ink-700 text-paper/40 border-ink-600/30 cursor-wait"
                : sealStatus === "valid"
                ? "bg-stamp-green/10 text-stamp-green border-stamp-green/30 hover:bg-stamp-green/15"
                : sealStatus === "invalid"
                ? "bg-stamp-red/10 text-stamp-red border-stamp-red/30 hover:bg-stamp-red/15"
                : "bg-ink-700 text-paper/60 border-ink-600/40 hover:text-paper hover:border-ink-600"
            }`}
          >
            {sealStatus === "loading"
              ? "Verifying…"
              : sealStatus === "valid"
              ? "Seal Intact"
              : sealStatus === "invalid"
              ? "Re-verify"
              : "Verify Seal"}
          </button>
        </div>
      )}

      {/* ── 3-Column investigation layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.1fr] gap-5">

        {/* ═══ LEFT: Document viewer ═══ */}
        <div className="bg-ink-800 border border-ink-600/30 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-ink-600/20 flex items-center gap-2">
            <FileText size={13} className="text-paper/40" strokeWidth={1.8} />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
              Document
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            {invoice.fileUrl ? (
              <iframe
                src={invoice.fileUrl}
                title={`Invoice ${invoice.id}`}
                className="w-full h-[480px]"
              />
            ) : (
              <div className="text-center p-8 space-y-3">
                <FileText size={40} className="mx-auto text-ink-600" strokeWidth={1.2} />
                <p className="text-sm font-medium text-paper/50">Original Document</p>
                <p className="text-xs text-paper/30 font-mono">
                  No file bytes stored for this record
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CENTER: Extracted information ═══ */}
        <div className="bg-ink-800 border border-ink-600/30 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-ink-600/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={13} className="text-paper/40" strokeWidth={1.8} />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
                Extracted Information
              </span>
            </div>
            {canWrite && (
              <button
                onClick={() => setShowVendorCorrect(true)}
                className="text-[10px] font-mono text-paper/30 hover:text-paper/60 transition-colors"
              >
                Correct vendor
              </button>
            )}
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Extraction confidence — CLEARLY separate from risk */}
            <div className="bg-ink-700/40 rounded-lg p-3 border border-ink-600/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-paper/40 font-bold">
                  Extraction Confidence
                </span>
                <span className={`text-sm font-bold font-mono ${confColor(overallConfPct)}`}>
                  {overallConfPct}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-ink-600/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overallConfPct >= 80
                      ? "bg-stamp-green"
                      : overallConfPct >= 60
                      ? "bg-stamp-amber"
                      : "bg-stamp-red"
                  }`}
                  style={{ width: `${overallConfPct}%` }}
                />
              </div>
              <p className="text-[10px] text-paper/30 font-mono mt-1">
                How certain the system is about these extracted values
              </p>
            </div>

            {/* Invoice fields */}
            <div className="space-y-0">
              {invoice.fields?.map((f) => {
                const confPct = Math.round((f.confidence || 0) * 100);
                return (
                  <div
                    key={f.key || f.label}
                    className="flex items-center justify-between py-2.5 border-b border-ink-600/15
                               last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-paper/30 font-mono">
                        {f.label}
                      </p>
                      <p className="font-mono text-sm font-medium text-paper mt-0.5">
                        {f.value || (
                          <span className="text-paper/30 italic text-xs">null</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ml-3 ${confColor(confPct)}`}>
                      {confPct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Analysis pipeline (rule → cache → AI) */}
            <div className="mt-auto pt-3 border-t border-ink-600/20">
              <p className="text-[10px] font-mono uppercase tracking-widest text-paper/30 mb-2 font-bold">
                Analysis Pipeline
              </p>
              <div className="space-y-1.5">
                {[
                  { icon: Cpu, label: "Rule Engine", sub: "Deterministic checks completed" },
                  { icon: Database, label: "Vendor / Historical Data", sub: "Existing records compared" },
                  { icon: Brain, label: "AI Analysis", sub: "Used for explanations and ambiguous findings" },
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="flex items-start gap-2">
                    <CheckCircle2
                      size={12}
                      className="text-stamp-green mt-0.5 shrink-0"
                      strokeWidth={2}
                    />
                    <div>
                      <p className="text-xs font-medium text-paper/60">{label}</p>
                      <p className="text-[10px] font-mono text-paper/30">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Risk investigation ═══ */}
        <div className="bg-ink-800 border border-ink-600/30 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-ink-600/20 flex items-center gap-2">
            <Shield size={13} className="text-paper/40" strokeWidth={1.8} />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
              Risk Investigation
            </span>
          </div>

          <div className="flex-1 p-4 space-y-5 overflow-y-auto">
            {/* Risk score */}
            <div className="text-center py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-paper/30 mb-2">
                Risk Score
              </p>
              <div className="relative inline-block">
                <div
                  className={`text-5xl font-display font-bold leading-none ${risk.color}`}
                >
                  {invoice.riskScore ?? "—"}
                </div>
                <div className="text-[10px] font-mono text-paper/30 mt-1">/ 100</div>
              </div>
              <div
                className={`inline-block mt-2 px-3 py-1 rounded-full border text-xs font-mono
                             font-bold ${risk.color}`}
                style={{ borderColor: "currentColor", opacity: 0.6 }}
              >
                {risk.label}
              </div>
              {/* Risk bar */}
              <div className="mt-3 h-1.5 w-full bg-ink-600/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${risk.bg}`}
                  style={{ width: `${invoice.riskScore || 0}%` }}
                />
              </div>
            </div>

            {/* Why was it flagged? / Evidence */}
            {invoice.flags?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-paper/30 font-bold">
                  {isMsme ? "What's the issue?" : "Why was this flagged?"}
                </p>

                <div className="relative border-l-2 border-ink-600/30 ml-2 space-y-4 pl-4">
                  {invoice.flags.map((f, i) => {
                    const title = isMsme
                      ? (MSME_EXCEPTION_TITLES[f.type] || EXCEPTION_TITLES[f.type] || f.type)
                      : (EXCEPTION_TITLES[f.type] || f.type);
                    const contrib = f.riskContribution;
                    const dupeId = f.evidenceData?.duplicate_invoice_id;

                    return (
                      <div key={i} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full
                                         bg-stamp-red border-2 border-ink-800" />
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-paper">{title}</p>
                            {contrib && (
                              <span className="text-[10px] font-mono text-stamp-red/60 shrink-0 mt-0.5">
                                +{contrib} pts
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-paper/50 font-sans mt-1 leading-relaxed">
                            {isMsme
                              ? (f.msmeNarrative || f.detail || "")
                              : (f.detail || "")}
                          </p>

                          {/* Compare duplicate button */}
                          {dupeId && (
                            <Link
                              to={`/invoices/${invoice.id}/compare/${dupeId}`}
                              className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-mono
                                          text-stamp-amber hover:text-stamp-amber/80
                                          border border-stamp-amber/30 hover:border-stamp-amber/50
                                          px-2.5 py-1 rounded-md bg-stamp-amber/5
                                          transition-all duration-150"
                            >
                              <GitCompare size={11} strokeWidth={2} />
                              Compare invoices
                            </Link>
                          )}

                          {/* Technical details toggle (FindingRow) */}
                          {f.rawReason && f.rawReason !== f.detail && (
                            <FindingRow
                              flag={{ ...f, detail: "", msmeNarrative: "" }}
                              mode={mode}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Analysis — clearly separate */}
            {invoice.flags?.some((f) => f.detail || f.msmeNarrative) && (
              <div className="bg-ink-700/40 border border-ink-600/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Brain size={13} className="text-stamp-amber/60" strokeWidth={1.8} />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-stamp-amber/60 font-bold">
                    AI Analysis
                  </p>
                </div>
                <p className="text-xs text-paper/60 font-sans leading-relaxed">
                  {invoice.flags
                    .map((f) => (isMsme ? f.msmeNarrative : f.detail))
                    .filter(Boolean)
                    .join(" ")}
                </p>
                <p className="text-[10px] font-mono text-paper/25 border-t border-ink-600/20 pt-2 mt-2">
                  AI analysis complements deterministic rule checks — it does not replace them.
                </p>
              </div>
            )}

            {/* Government GSTIN Check */}
            {invoice.registryStatus && (
              <div className="border-t border-ink-600/20 pt-4 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-paper/30 font-bold">
                  Government GSTIN Check
                </p>
                <div className="bg-ink-800 rounded-lg p-3 text-xs space-y-2 font-mono">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-paper/40">Legal Name:</span>
                    <span className="col-span-2 text-paper truncate">{invoice.registryStatus.legal_name || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-paper/40">Trade Name:</span>
                    <span className="col-span-2 text-paper truncate">{invoice.registryStatus.trade_name || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-paper/40">GST Status:</span>
                    <span className={`col-span-2 font-bold ${
                      invoice.registryStatus.registry_status === 'verified' ? 'text-stamp-green' : 'text-stamp-red'
                    }`}>
                      {invoice.registryStatus.gst_status || '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-paper/40">Address:</span>
                    <span className="col-span-2 text-paper truncate" title={invoice.registryStatus.address}>
                      {invoice.registryStatus.address || '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-ink-600/20 pt-2 mt-2">
                    <span className="text-paper/40">Provider:</span>
                    <span className="col-span-2 text-paper/70">{invoice.registryStatus.source_provider}</span>
                  </div>
                  {invoice.registryStatus.name_match_score !== undefined && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-paper/40">Name Match:</span>
                      <span className={`col-span-2 font-bold ${
                        invoice.registryStatus.name_match_score >= 70 ? 'text-stamp-green' : 'text-stamp-red'
                      }`}>
                        {invoice.registryStatus.name_match_score}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recommended Action */}
            {canWrite && (
              <div className="border-t border-ink-600/20 pt-4 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-paper/30 font-bold">
                  Recommended Action
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowResolve(true)}
                    disabled={resolved}
                    className="flex items-center justify-center gap-1.5 bg-stamp-green/10
                                border border-stamp-green/25 text-stamp-green text-xs font-medium
                                py-2 px-3 rounded-lg hover:bg-stamp-green/15 disabled:opacity-40
                                transition-all duration-150"
                  >
                    <CheckCircle2 size={11} strokeWidth={2} />
                    {resolved ? "Resolved" : "Resolve"}
                  </button>
                  <button
                    onClick={() => setShowEscalate(true)}
                    className="flex items-center justify-center gap-1.5 bg-stamp-amber/10
                                border border-stamp-amber/25 text-stamp-amber text-xs font-medium
                                py-2 px-3 rounded-lg hover:bg-stamp-amber/15 transition-all duration-150"
                  >
                    <AlertTriangle size={11} strokeWidth={2} />
                    Escalate
                  </button>
                  {invoice.flags?.some((f) => f.evidenceData?.duplicate_invoice_id) && (
                    <Link
                      to={`/invoices/${invoice.id}/compare/${
                        invoice.flags.find((f) => f.evidenceData?.duplicate_invoice_id)
                          ?.evidenceData.duplicate_invoice_id
                      }`}
                      className="flex items-center justify-center gap-1.5 bg-ink-700/60
                                  border border-ink-600/30 text-paper/60 text-xs font-medium
                                  py-2 px-3 rounded-lg hover:text-paper hover:border-ink-600
                                  transition-all duration-150 col-span-2"
                    >
                      <GitCompare size={11} strokeWidth={2} />
                      Compare Duplicate Invoices
                    </Link>
                  )}
                  <a
                    href={buildDisputeMailto(invoice)}
                    className="flex items-center justify-center gap-1.5 bg-ink-700/60
                                border border-ink-600/30 text-paper/60 text-xs font-medium
                                py-2 px-3 rounded-lg hover:text-paper hover:border-ink-600
                                transition-all duration-150 col-span-2"
                  >
                    <Mail size={11} strokeWidth={2} />
                    Contact Vendor
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Forensic Metadata (below 3-col grid) ── */}
      {forensics &&
        (forensics.producer ||
          forensics.creator ||
          forensics.software_flags?.length > 0 ||
          forensics.date_anomalies?.length > 0) && (
          <div className="bg-ink-800 border border-ink-600/30 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowForensicsDetail((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5
                         hover:bg-ink-700/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Shield size={13} className="text-paper/40" strokeWidth={1.8} />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-paper/40">
                  Document Metadata Analysis
                </span>
                {forensics.software_flags?.length > 0 && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full
                                   bg-stamp-red/20 text-stamp-red border border-stamp-red/30">
                    {forensics.software_flags.length} alert{forensics.software_flags.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {showForensicsDetail ? (
                <ChevronUp size={13} className="text-paper/30" strokeWidth={2} />
              ) : (
                <ChevronDown size={13} className="text-paper/30" strokeWidth={2} />
              )}
            </button>

            {showForensicsDetail && (
              <div className="px-5 pb-5 space-y-4 border-t border-ink-600/20">
                {forensics.software_flags?.map((flag, i) => (
                  <div
                    key={i}
                    className="bg-stamp-red/8 border border-stamp-red/20 rounded-lg px-4 py-3
                                flex items-start gap-3"
                  >
                    <AlertTriangle
                      size={14}
                      className="text-stamp-red shrink-0 mt-0.5"
                      strokeWidth={1.8}
                    />
                    <div>
                      <p className="text-sm font-semibold text-stamp-red">{flag.message}</p>
                      <p className="text-xs text-paper/40 font-mono mt-0.5">
                        Detected in: {flag.detected_in || "metadata"} · Severity:{" "}
                        {flag.severity?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                ))}
                {forensics.date_anomalies?.map((anomaly, i) => (
                  <div
                    key={i}
                    className="bg-stamp-amber/8 border border-stamp-amber/20 rounded-lg px-4 py-3
                                flex items-start gap-3"
                  >
                    <AlertTriangle
                      size={14}
                      className="text-stamp-amber shrink-0 mt-0.5"
                      strokeWidth={1.8}
                    />
                    <div>
                      <p className="text-sm font-semibold text-stamp-amber">{anomaly.message}</p>
                      <p className="text-xs text-paper/40 font-mono mt-0.5">
                        Severity: {anomaly.severity?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ["Producer", forensics.producer],
                    ["Creator", forensics.creator],
                    ["OS / Platform", forensics.os_platform],
                    ["Pages", forensics.page_count],
                    ["Created", forensics.creation_date],
                    ["Modified", forensics.modification_date],
                    [
                      "File Size",
                      forensics.file_size_bytes
                        ? `${(forensics.file_size_bytes / 1024).toFixed(1)} KB`
                        : null,
                    ],
                    [
                      "Risk Contribution",
                      forensics.risk_score_contribution
                        ? `+${forensics.risk_score_contribution} pts`
                        : "0",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-ink-700/40 rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-paper/30 font-mono">
                        {label}
                      </p>
                      <p
                        className="text-sm font-mono text-paper/60 mt-0.5 truncate"
                        title={value || "—"}
                      >
                        {value || <span className="text-paper/20 italic">N/A</span>}
                      </p>
                    </div>
                  ))}
                </div>
                {forensics.software_flags?.length === 0 &&
                  forensics.date_anomalies?.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-stamp-green">
                      <CheckCircle2 size={14} strokeWidth={2} />
                      No forensic anomalies detected — document metadata appears clean
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

      {/* ── Edit history ── */}
      <EditHistoryLog history={invoice.editHistory} />

      {/* ── Modals ── */}
      {showEdit && canWrite && (
        <EditFieldsPanel
          invoice={invoice}
          onSaved={handleEditSaved}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showResolve && (
        <ResolutionForm
          ticketId={tickets[0]?.id || invoice.id}
          onClose={() => setShowResolve(false)}
          onResolved={() => setResolved(true)}
        />
      )}
      {showEscalate && (
        <EscalationForm
          ticketId={tickets[0]?.id || invoice.id}
          onClose={() => setShowEscalate(false)}
          onEscalated={() => setResolved(true)}
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

      {/* ── Audit Trail slide-out ── */}
      {showAuditPanel && (
        <>
          <div
            className="fixed inset-0 bg-ink/60 z-40 transition-opacity"
            onClick={() => setShowAuditPanel(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-ink-800
                          border-l border-ink-600/50 z-50 flex flex-col shadow-elev-3
                          animate-slideIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-600/30">
              <div>
                <h3 className="font-display text-base font-semibold text-paper">Audit Trail</h3>
                <p className="text-xs font-mono text-paper/30 mt-0.5">
                  {invoice.id} · {auditTrail?.length || 0} events
                </p>
              </div>
              <button
                onClick={() => setShowAuditPanel(false)}
                className="text-paper/40 hover:text-paper p-1.5 rounded-lg
                           hover:bg-ink-700/60 transition-colors"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            {/* Category filters */}
            <div className="px-5 py-3 border-b border-ink-600/20 flex gap-1.5 flex-wrap">
              {["all", "pipeline", "validation", "forensics", "scoring", "ai", "security", "audit"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setAuditFilter(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                      auditFilter === cat
                        ? "bg-paper/10 text-paper font-semibold"
                        : "text-paper/40 hover:text-paper/70 hover:bg-ink-700/50"
                    }`}
                  >
                    {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                )
              )}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!auditTrail ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border-2 border-paper/20 border-t-paper/60 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-ink-600/30" />
                  <div className="space-y-1">
                    {auditTrail
                      .filter((e) => auditFilter === "all" || e.category === auditFilter)
                      .map((event, i) => {
                        const time = event.timestamp
                          ? new Date(event.timestamp).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })
                          : "";
                        const date = event.timestamp
                          ? new Date(event.timestamp).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "";
                        const dotColor = {
                          pipeline: "border-paper/30",
                          validation: "border-stamp-amber",
                          forensics: "border-stamp-red",
                          scoring: "border-paper/30",
                          ai: "border-stamp-amber",
                          security: "border-stamp-green",
                          audit: "border-paper/30",
                        }[event.category] || "border-paper/30";

                        return (
                          <div key={i} className="relative pl-10 py-2.5 group">
                            <div
                              className={`absolute left-2.5 top-3.5 w-3 h-3 rounded-full border-2
                                           bg-ink-800 ${dotColor}
                                           group-hover:scale-125 transition-transform`}
                            />
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {event.icon && (
                                    <span className="text-sm">{event.icon}</span>
                                  )}
                                  <span className="text-sm font-semibold text-paper">
                                    {event.label}
                                  </span>
                                </div>
                                {event.detail && (
                                  <p className="text-xs text-paper/40 font-mono mt-0.5 break-words">
                                    {event.detail}
                                  </p>
                                )}
                                <p className="text-[10px] text-paper/25 font-mono mt-0.5">
                                  {event.actor !== "system" && (
                                    <span className="text-stamp-amber">{event.actor} · </span>
                                  )}
                                  {date} {time}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {auditTrail.filter(
                      (e) => auditFilter === "all" || e.category === auditFilter
                    ).length === 0 && (
                      <p className="text-center text-paper/30 text-sm font-mono py-8">
                        No events for this filter
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SHA seal footer */}
            <div className="border-t border-ink-600/20 px-5 py-3 flex items-center gap-2">
              <Shield size={12} className="text-stamp-green/60" strokeWidth={2} />
              <span className="text-[10px] font-mono text-stamp-green/60">
                SHA-256 integrity sealing active
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
