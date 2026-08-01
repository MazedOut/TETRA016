import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { uploadInvoiceBatch } from "../api/client.js";

/**
 * Bulk upload + invalid-file decision form (skip / retry / review).
 */
export default function UploadBatch() {
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState([]);
  const [results, setResults] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter((f) =>
      ["application/pdf", "image/png", "image/jpeg"].includes(f.type)
    );
    setQueue((prev) => [...prev, ...files]);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    setUploading(true);
    const data = await uploadInvoiceBatch(queue);
    setResults(data);
    setUploading(false);
  }

  function decide(filename, action) {
    setResults((prev) => prev.map((r) => (r.filename === filename ? { ...r, decision: action } : r)));
  }

  function handleResetQueue() {
    setQueue([]);
    setResults(null);
  }

  const acceptedCount = results?.filter((r) => r.status === "accepted").length || 0;
  const flaggedCount = results?.filter((r) => r.status !== "accepted").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Batch upload</h2>
          <p className="text-sm text-paper/60 mt-1">
            Drop invoice PDFs or scans. Each file runs rules first — AI only touches what's genuinely ambiguous.
          </p>
        </div>
        {results && (
          <button
            onClick={handleResetQueue}
            className="text-xs font-mono px-3 py-1.5 rounded bg-ink-700 hover:bg-ink-600 text-paper border border-ink-600"
          >
            Upload another batch
          </button>
        )}
      </div>

      {!results && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={
            "paper-surface rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors text-ink " +
            (dragging ? "border-stamp-red" : "border-ink-600/30")
          }
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <p className="font-display text-lg font-medium">Drag invoices here, or click to browse</p>
          <p className="text-xs text-ink-600 mt-2 font-mono">PDF, PNG, JPEG — batched, not one at a time</p>
        </div>
      )}

      {queue.length > 0 && !results && (
        <div className="paper-surface rounded-lg p-5 text-ink">
          <p className="text-sm font-medium mb-3">{queue.length} file(s) queued</p>
          <ul className="space-y-1.5 mb-4 max-h-48 overflow-auto font-mono text-xs">
            {queue.map((f, i) => (
              <li key={i} className="flex justify-between">
                <span>{f.name}</span>
                <span className="text-ink-600">{(f.size / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-stamp-red/90"
          >
            {uploading ? "Running rules & AI extraction…" : `Upload ${queue.length} file(s)`}
          </button>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {/* Post-Upload Summary Banner */}
          <div className="bg-paper-surface rounded-lg p-6 border-2 border-stamp-red/40 text-ink shadow-md flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="stamp-badge px-2 py-0.5 text-[10px] font-mono text-stamp-green font-bold border border-stamp-green/40">
                  BATCH COMPLETE
                </span>
                <h3 className="font-display text-lg font-semibold">Processing Complete</h3>
              </div>
              <p className="text-sm font-sans text-ink-700">
                Processed <span className="font-bold font-mono">{results.length}</span> invoice(s):{" "}
                <span className="text-stamp-green font-semibold">{acceptedCount} accepted</span>,{" "}
                <span className="text-stamp-amber font-semibold">{flaggedCount} flagged for review</span>.
              </p>
            </div>

            <Link
              to="/exceptions"
              className="bg-stamp-red text-paper px-5 py-2.5 rounded-md text-sm font-medium hover:bg-stamp-red/90 transition-all flex items-center gap-2 shadow"
            >
              View in Exception Queue &rarr;
            </Link>
          </div>

          <div className="paper-surface rounded-lg p-5 text-ink">
            <p className="text-sm font-semibold mb-4">Detailed Batch Breakdown</p>
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.filename} className="flex items-center justify-between border-b border-ink-600/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium">{r.filename}</p>
                      {r.risk_level && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                          r.risk_level === 'high' ? 'bg-stamp-red/10 text-stamp-red' : 
                          r.risk_level === 'medium' ? 'bg-stamp-amber/10 text-stamp-amber' : 
                          'bg-stamp-green/10 text-stamp-green'
                        }`}>
                          {r.risk_level} RISK
                        </span>
                      )}
                    </div>
                    <p className={"text-xs font-mono mt-0.5 " + (r.status === "accepted" ? "text-stamp-green" : "text-stamp-amber")}>
                      {r.status === "accepted" ? "✓ Accepted & scored cleanly" : "⚠ Flagged for review"}
                    </p>
                    {r.invoice_id && (
                      <Link to={`/invoices/${r.invoice_id}`} className="text-[11px] font-mono text-ink-600 hover:text-ink underline mt-1 inline-block">
                        View in workspace &rarr;
                      </Link>
                    )}
                  </div>
                  {r.status === "needs-review" && !r.decision && (
                    <div className="flex gap-2">
                      {["Skip", "Retry", "Review"].map((action) => (
                        <button
                          key={action}
                          onClick={() => decide(r.filename, action)}
                          className="text-xs font-medium px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-ink-700 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                  {r.decision && <span className="text-xs font-mono text-ink-600 italic">marked: {r.decision}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
