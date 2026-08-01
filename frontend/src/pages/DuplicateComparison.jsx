import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchInvoiceDetail } from "../api/client.js";

export default function DuplicateComparison() {
  const { id, targetId } = useParams();
  const [invA, setInvA] = useState(null);
  const [invB, setInvB] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchInvoice(id),
      fetchInvoice(targetId)
    ]).then(([a, b]) => {
      setInvA(a);
      setInvB(b);
      setLoading(false);
    });
  }, [id, targetId]);

  if (loading) return <div className="p-8 text-ink-600 font-mono animate-pulse">Loading comparison...</div>;
  if (!invA || !invB) return <div className="p-8 text-stamp-red">Error loading invoices.</div>;

  const fields = [
    { label: "Invoice Number", key: "invoice_number" },
    { label: "Vendor", key: "vendor_name" },
    { label: "GSTIN", key: "vendor_gstin" },
    { label: "Date", key: "invoice_date" },
    { label: "Taxable Value", key: "taxable_value" },
    { label: "Total Amount", key: "total_amount" }
  ];

  function renderValue(val) {
    if (val === null || val === undefined) return <span className="text-ink-600 italic">None</span>;
    return String(val);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="text-xs font-mono px-3 py-1.5 bg-ink-700 text-paper rounded hover:bg-ink transition">&larr; Back</button>
        <h2 className="font-display text-2xl font-semibold">Duplicate Comparison</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Invoice */}
        <div className="paper-surface rounded-lg p-6 border-2 border-stamp-red/30 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Flagged Invoice (ID: {invA.id})</h3>
            <Link to={`/invoices/${invA.id}`} className="text-xs font-mono text-stamp-red underline">View Workspace</Link>
          </div>
          
          <table className="w-full text-sm font-mono text-left">
            <tbody>
              {fields.map(f => {
                const match = invA[f.key] === invB[f.key];
                return (
                  <tr key={f.key} className="border-b border-ink-600/20">
                    <th className="py-2 text-ink-700 w-1/3">{f.label}</th>
                    <td className={`py-2 ${!match ? 'bg-stamp-amber/20 font-bold' : ''}`}>
                      {renderValue(invA[f.key])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div className="mt-4 pt-4 border-t border-ink-600/20">
            {invA.source_file_path ? (
              <iframe 
                src={`http://localhost:8000/api/invoices/${invA.id}/file`} 
                className="w-full h-96 border border-ink-600/20 rounded" 
                title="Invoice A"
              />
            ) : (
              <div className="h-96 flex flex-col items-center justify-center border border-dashed border-ink-600/30 rounded text-ink-600 bg-ink-600/5">
                <span className="text-3xl mb-2">📄</span>
                <span className="text-sm font-mono">No document scan available</span>
              </div>
            )}
          </div>
        </div>

        {/* Target Invoice */}
        <div className="paper-surface rounded-lg p-6 border-2 border-ink-600/20 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Existing Invoice (ID: {invB.id})</h3>
            <Link to={`/invoices/${invB.id}`} className="text-xs font-mono text-ink-600 underline hover:text-ink">View Workspace</Link>
          </div>
          
          <table className="w-full text-sm font-mono text-left">
            <tbody>
              {fields.map(f => {
                const match = invA[f.key] === invB[f.key];
                return (
                  <tr key={f.key} className="border-b border-ink-600/20">
                    <th className="py-2 text-ink-700 w-1/3">{f.label}</th>
                    <td className={`py-2 ${!match ? 'bg-stamp-amber/20 font-bold' : ''}`}>
                      {renderValue(invB[f.key])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div className="mt-4 pt-4 border-t border-ink-600/20">
            {invB.source_file_path ? (
              <iframe 
                src={`http://localhost:8000/api/invoices/${invB.id}/file`} 
                className="w-full h-96 border border-ink-600/20 rounded" 
                title="Invoice B"
              />
            ) : (
              <div className="h-96 flex flex-col items-center justify-center border border-dashed border-ink-600/30 rounded text-ink-600 bg-ink-600/5">
                <span className="text-3xl mb-2">📄</span>
                <span className="text-sm font-mono">No document scan available</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
