import { useState } from "react";
import { submitEscalation } from "../api/client.js";
import { AlertTriangle } from "lucide-react";

const ESCALATION_REASONS = [
  "Requires senior auditor review",
  "Suspected fraud — needs investigation",
  "Vendor dispute requires legal review",
  "Complex multi-invoice issue",
  "Other (explain below)",
];

export default function EscalationForm({ ticketId, onClose, onEscalated }) {
  const [reason, setReason] = useState(ESCALATION_REASONS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitEscalation(ticketId, { reason, note });
      onEscalated?.({ reason, note });
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to escalate ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="paper-surface rounded-lg p-6 w-full max-w-md text-ink space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stamp-amber/10 border border-stamp-amber/25 flex items-center justify-center">
            <AlertTriangle size={14} className="text-stamp-amber" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Escalate {ticketId}</h3>
            <p className="text-xs text-ink-600 mt-0.5">This will flag the ticket for senior review.</p>
          </div>
        </div>

        {error && (
          <div className="bg-stamp-red/10 border border-stamp-red/25 rounded-md px-3 py-2 text-sm text-stamp-red">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium">
          Escalation Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm"
          >
            {ESCALATION_REASONS.map((r) => (
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
            placeholder="Why does this need escalation? What should the reviewer focus on?"
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
            className="bg-stamp-amber text-ink px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Escalating…" : "Escalate ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
