import { useState } from "react";
import { Link } from "react-router-dom";
import { uploadInvoiceBatch } from "../api/client.js";
import { UploadCloud, CheckCircle2, ShieldAlert, Cpu, Database, Brain, ArrowRight } from "lucide-react";

/**
 * Batch upload interface.
 * Shows a large drop zone and clearly visualizes the processing pipeline.
 */
export default function UploadBatch() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleFileSelect(e) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResult(null);
      setError(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
      setResult(null);
      setError(null);
    }
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadInvoiceBatch(files);
      setResult(data);
      setFiles([]);
    } catch (err) {
      setError("Failed to upload batch. The API might be down.");
    } finally {
      setUploading(false);
    }
  }

  // Visual representation of the processing pipeline
  const PIPELINE_STEPS = [
    { icon: Cpu, label: "Deterministic Rules", sub: "Checksums & Math" },
    { icon: Database, label: "Cache Validation", sub: "Duplicates & History" },
    { icon: Brain, label: "AI Reasoning", sub: "Context & Explanations" },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="font-display text-3xl font-bold text-paper">Upload Invoices</h2>
        <p className="text-sm text-paper/60 max-w-lg mx-auto">
          Ingest invoices for automated risk screening. TETRA applies a three-stage
          pipeline to identify anomalies before they impact your ledger.
        </p>
      </div>

      {/* Pipeline visualization */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 my-8">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center text-center w-28 sm:w-36">
              <div className="w-12 h-12 rounded-full bg-ink-800 border border-ink-600/50 flex items-center justify-center mb-3">
                <step.icon size={20} className="text-ink-600" strokeWidth={1.5} />
              </div>
              <p className="text-xs font-semibold text-paper/80">{step.label}</p>
              <p className="text-[10px] font-mono text-paper/40 mt-1">{step.sub}</p>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <ArrowRight size={16} className="text-ink-600/50 shrink-0 -mt-8" />
            )}
          </div>
        ))}
      </div>

      {/* Upload area */}
      {!result ? (
        <div className="bg-ink-800 border border-ink-600/30 rounded-2xl p-8 shadow-elev-2 relative overflow-hidden">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
                        ${
                          files.length > 0
                            ? "border-stamp-amber/50 bg-stamp-amber/5"
                            : "border-ink-600/50 hover:border-ink-600 hover:bg-ink-700/30"
                        }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <UploadCloud
              size={48}
              className={`mx-auto mb-4 ${
                files.length > 0 ? "text-stamp-amber" : "text-ink-600"
              }`}
              strokeWidth={1.2}
            />
            {files.length > 0 ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-paper">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </p>
                <p className="text-sm font-mono text-paper/50">
                  Ready for risk screening
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-paper">
                  Drag and drop invoice PDFs here
                </p>
                <p className="text-sm font-mono text-paper/40">
                  or click below to browse your files
                </p>
              </div>
            )}
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="mt-6 inline-block bg-ink-700 border border-ink-600/60 text-paper/80
                         px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-ink-600 hover:text-paper
                         cursor-pointer transition-colors"
            >
              Browse Files
            </label>
          </div>

          {error && (
            <div className="mt-6 bg-stamp-red/10 border border-stamp-red/30 rounded-lg p-4
                            text-sm text-stamp-red flex items-start gap-3">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-stamp-red text-paper px-8 py-3 rounded-lg text-sm font-semibold
                           hover:bg-stamp-red/90 active:scale-[0.97] disabled:opacity-50
                           transition-all flex items-center gap-2 shadow-sm"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-paper/20 border-t-paper rounded-full animate-spin" />
                    Processing Pipeline…
                  </>
                ) : (
                  <>
                    Start Analysis
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-ink-800 border border-ink-600/30 rounded-2xl p-10 text-center space-y-6 animate-scaleIn">
          <div className="w-20 h-20 rounded-full bg-stamp-green/10 border border-stamp-green/20
                          flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-stamp-green" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-2xl font-bold text-paper">Batch Processed</h3>
            <p className="text-sm text-paper/60 font-sans max-w-sm mx-auto">
              Successfully ingested {result.processedCount} invoice{result.processedCount !== 1 ? "s" : ""}.
              The analysis pipeline generated {result.flagCount} exception flag{result.flagCount !== 1 ? "s" : ""}.
            </p>
          </div>

          <div className="bg-ink-700/30 border border-ink-600/20 rounded-xl p-6 max-w-sm mx-auto
                          grid grid-cols-2 gap-4 divide-x divide-ink-600/30">
            <div>
              <p className="text-3xl font-display font-bold text-paper">{result.processedCount}</p>
              <p className="text-[10px] font-mono text-paper/40 uppercase tracking-widest mt-1">
                Processed
              </p>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-stamp-red">{result.flagCount}</p>
              <p className="text-[10px] font-mono text-stamp-red/60 uppercase tracking-widest mt-1">
                Exceptions
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                setResult(null);
                setFiles([]);
              }}
              className="text-xs font-medium text-paper/50 hover:text-paper transition-colors"
            >
              Upload another batch
            </button>
            <Link
              to="/exceptions"
              className="bg-stamp-red text-paper px-6 py-2.5 rounded-lg text-sm font-semibold
                         hover:bg-stamp-red/90 transition-colors shadow-sm"
            >
              View Review Queue
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
