import { useEffect, useState } from "react";
import { fetchFolders } from "../api/client.js";

/**
 * Auto-sorted invoice folders by vendor/category, with manual reassignment.
 */
export default function FolderView() {
  const [folders, setFolders] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    fetchFolders().then(setFolders);
  }, []);

  function reassign(vendor, category) {
    setFolders((prev) => prev.map((f) => (f.vendor === vendor ? { ...f, category } : f)));
    setEditing(null);
  }

  const categories = ["Raw Materials", "Packaging", "Consumables", "Services"];

  return (
    <div className="paper-surface rounded-lg p-6 text-ink">
      <h3 className="font-display text-lg font-semibold mb-4">Auto-sorted folders</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {folders.map((f) => (
          <div key={f.vendor} className="border border-ink-600/15 rounded-md p-4">
            <p className="font-medium text-sm">{f.vendor}</p>
            <p className="text-xs text-ink-600 font-mono mt-0.5">{f.count} invoices</p>
            {editing === f.vendor ? (
              <select
                autoFocus
                value={f.category}
                onChange={(e) => reassign(f.vendor, e.target.value)}
                onBlur={() => setEditing(null)}
                className="mt-2 w-full text-xs bg-paper-dim border border-ink-600/30 rounded-md px-2 py-1"
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditing(f.vendor)}
                className="mt-2 text-xs font-mono px-2 py-1 rounded-full bg-stamp-amber/15 text-stamp-amber hover:bg-stamp-amber/25"
              >
                {f.category} — reassign
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
