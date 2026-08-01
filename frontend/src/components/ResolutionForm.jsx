import { useState } from "react";
import { submitResolution } from "../api/client.js";

/**
 * Ticket resolution form — mandatory reason, never a silent close.
 */
const REASONS = [
  "False positive — confirmed not an issue",
  "Vendor corrected, ledger updated",
  "Duplicate confirmed, invoice voided",
  "Escalated to finance lead",
  "Other (explain below)",
];

export default function ResolutionForm({ ticketId, onClose, onResolved }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await submitResolution(ticketId, { reason, note });
    setSubmitting(false);
    onResolved?.({ reason, note });
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="paper-surface rounded-lg p-6 w-full max-w-md text-ink space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold">Resolve {ticketId}</h3>
          <p className="text-xs text-ink-600 mt-1">A reason is required — nothing closes silently.</p>
        </div>

        <label className="block text-sm font-medium">
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            required
            placeholder="What did you check, and what did you find?"
            className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-ink-600/10">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-stamp-red text-paper px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Resolve ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
