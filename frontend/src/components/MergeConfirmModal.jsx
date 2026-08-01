import { useState } from "react";
import { submitMergeDecision } from "../api/client.js";

/**
 * AI-proposed ticket merge with editable reason; user accepts, edits, or rejects.
 */
export default function MergeConfirmModal({ ticketIds, aiReason, onClose, onDecided }) {
  const [reason, setReason] = useState(aiReason);
  const [submitting, setSubmitting] = useState(false);

  async function decide(action) {
    setSubmitting(true);
    await submitMergeDecision({ ticketIds, action, reason });
    setSubmitting(false);
    onDecided?.(action);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4">
      <div className="paper-surface rounded-lg p-6 w-full max-w-lg text-ink space-y-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-mono text-stamp-amber">AI-proposed merge</span>
          <h3 className="font-display text-lg font-semibold mt-1">Merge {ticketIds.join(" + ")}?</h3>
          <p className="text-xs text-ink-600 mt-1">
            Nothing merges automatically. Edit the reasoning below if it's wrong, then decide.
          </p>
        </div>

        <label className="block text-sm font-medium">
          Reason for merge (editable)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button disabled={submitting} onClick={() => decide("rejected")} className="px-4 py-2 text-sm rounded-md hover:bg-ink-600/10">
            Reject
          </button>
          <button disabled={submitting} onClick={() => decide("edited-and-merged")} className="bg-ink text-paper px-4 py-2 rounded-md text-sm font-medium">
            Save edit &amp; merge
          </button>
          <button disabled={submitting} onClick={() => decide("confirmed")} className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium">
            Confirm merge
          </button>
        </div>
      </div>
    </div>
  );
}
