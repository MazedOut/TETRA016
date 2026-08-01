import { useState } from "react";
import { submitVendorCorrection } from "../api/client.js";

/**
 * Manual vendor onboarding/correction form.
 */
export default function VendorCorrectionForm({ invoiceId, initialVendor = "", initialGstin = "", onClose, onSaved }) {
  const [vendor, setVendor] = useState(initialVendor);
  const [gstin, setGstin] = useState(initialGstin);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await submitVendorCorrection({ invoiceId, vendor, gstin });
    setSubmitting(false);
    onSaved?.({ vendor, gstin });
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="paper-surface rounded-lg p-6 w-full max-w-md text-ink space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold">Correct vendor details</h3>
          <p className="text-xs text-ink-600 mt-1">
            This becomes ground truth for {invoiceId} — it isn't inferred by the model again.
          </p>
        </div>

        <label className="block text-sm font-medium">
          Vendor name
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium">
          GSTIN
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            maxLength={15}
            className="mt-1 w-full bg-paper border border-ink-600/30 rounded-md px-3 py-2 text-sm font-mono tracking-wider"
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
            {submitting ? "Saving…" : "Save correction"}
          </button>
        </div>
      </form>
    </div>
  );
}
