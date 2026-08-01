import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchFolders, createFolder } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Auto-sorted invoice folders by vendor/category, with manual folder creation and reassignment.
 */
export default function FolderView({ onSelectFolder, selectedFolder }) {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [folders, setFolders] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCat, setNewFolderCat] = useState("General");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  async function loadFolders() {
    const data = await fetchFolders();
    setFolders(data || []);
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setLoading(true);
    await createFolder({ name: newFolderName.trim(), category: newFolderCat });
    setNewFolderName("");
    setShowCreate(false);
    await loadFolders();
    setLoading(false);
  }

  const categories = [
    "General", "Raw Materials", "Electronics", "Logistics",
    "Office Supplies", "Textiles", "Packaging", "Chemicals",
    "Hardware", "Services", "Fabrication", "Furniture", "Printing", "Consulting"
  ];

  return (
    <div className="paper-surface rounded-lg p-6 text-ink space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Vendor & Category Folders</h3>
          <p className="text-xs text-ink-600 font-mono mt-0.5">
            Auto-classified on ingestion. Click a folder to filter tickets.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-xs font-mono px-3 py-1.5 rounded-md bg-stamp-red text-paper hover:bg-stamp-red/90 font-medium transition-colors"
          >
            {showCreate ? "Cancel" : "+ Create Folder"}
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreateFolder} className="bg-paper p-4 rounded-md border border-ink-600/20 space-y-3">
          <p className="text-xs font-mono font-semibold uppercase text-ink-700">Create New Custom Folder</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col text-xs font-mono flex-1 min-w-[200px]">
              Folder Name
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Q3 Audits / Project Alpha"
                className="mt-1 bg-paper-surface border border-ink-600/30 rounded-md px-2.5 py-1.5 text-sm font-body text-ink"
                required
              />
            </label>
            <label className="flex flex-col text-xs font-mono min-w-[160px]">
              Category
              <select
                value={newFolderCat}
                onChange={(e) => setNewFolderCat(e.target.value)}
                className="mt-1 bg-paper-surface border border-ink-600/30 rounded-md px-2.5 py-1.5 text-sm font-body text-ink"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="bg-ink text-paper px-4 py-2 rounded-md text-xs font-mono font-medium hover:bg-ink-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Save Folder"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {selectedFolder && (
          <div
            onClick={() => onSelectFolder?.(null)}
            className="border-2 border-dashed border-stamp-red/50 bg-stamp-red/5 rounded-md p-4 cursor-pointer hover:bg-stamp-red/10 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-mono font-bold text-stamp-red">FILTER ACTIVE</p>
              <p className="font-semibold text-sm">{selectedFolder}</p>
            </div>
            <span className="text-xs font-mono text-stamp-red underline">Clear filter &times;</span>
          </div>
        )}

        {folders.map((f) => {
          const isSelected = selectedFolder === f.folder;
          return (
          <div
              key={f.folder}
              className={
                "border rounded-md p-4 transition-all hover:border-stamp-red/40 " +
                (isSelected ? "border-stamp-red bg-stamp-red/10 shadow-sm" : "border-ink-600/15 bg-paper")
              }
            >
              <div
                className="cursor-pointer"
                onClick={() => onSelectFolder?.(isSelected ? null : f.folder)}
              >
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm text-ink">{f.folder}</p>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-ink/10 text-ink-700">
                    {f.category}
                  </span>
                </div>
                <p className="text-xs text-ink-600 font-mono mt-2">
                  <span className="font-bold text-ink-800">{f.count}</span> invoice(s)
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-ink-600/15 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (onSelectFolder) {
                      onSelectFolder(isSelected ? null : f.folder);
                    } else {
                      navigate(`/folders/${encodeURIComponent(f.folder)}`);
                    }
                  }}
                  className="text-[10px] font-mono text-stamp-red hover:underline"
                >
                  {isSelected ? "✓ Filtering" : "Filter tickets"}
                </button>
                <Link
                  to={`/folders/${encodeURIComponent(f.folder)}`}
                  className="text-[10px] font-mono text-paper/60 hover:text-paper transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View invoices →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
