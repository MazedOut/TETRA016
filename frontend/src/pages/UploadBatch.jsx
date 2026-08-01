import { useCallback, useRef, useState } from "react";
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Batch upload</h2>
        <p className="text-sm text-paper/60 mt-1">
          Drop invoice PDFs or scans. Each file runs rules first — AI only touches what's genuinely ambiguous.
        </p>
      </div>

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
            className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {uploading ? "Uploading…" : `Upload ${queue.length} file(s)`}
          </button>
        </div>
      )}

      {results && (
        <div className="paper-surface rounded-lg p-5 text-ink">
          <p className="text-sm font-medium mb-4">Upload results</p>
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.filename} className="flex items-center justify-between border-b border-ink-600/10 pb-3">
                <div>
                  <p className="font-mono text-sm">{r.filename}</p>
                  <p className={"text-xs font-mono mt-0.5 " + (r.status === "accepted" ? "text-stamp-green" : "text-stamp-amber")}>
                    {r.status === "accepted" ? "accepted for processing" : "needs a decision — could not parse cleanly"}
                  </p>
                </div>
                {r.status === "needs-review" && !r.decision && (
                  <div className="flex gap-2">
                    {["Skip", "Retry", "Review"].map((action) => (
                      <button
                        key={action}
                        onClick={() => decide(r.filename, action)}
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-ink-700"
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
      )}
    </div>
  );
}
