import { useState, useEffect } from "react";
import { fetchGstinLogs } from "../api/client.js";
import { ShieldCheck, Search, AlertTriangle } from "lucide-react";

export default function GstinLookupsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGstinLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink flex items-center gap-2">
          <ShieldCheck className="text-stamp-green" />
          GSTIN Lookups & Registry Logs
        </h2>
        <p className="text-sm text-ink-600 mt-1 font-sans">
          Audit trail of all live government registry cross-checks.
        </p>
      </div>

      <div className="paper-surface rounded-xl border border-ink-600/30 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-600">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-ink-600 flex flex-col items-center gap-3">
            <Search className="text-ink-400" size={32} />
            <p>No GSTIN lookups have been performed yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap text-ink">
              <thead>
                <tr className="border-b border-ink-600/30 text-ink-600 font-medium">
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Legal Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source Provider</th>
                  <th className="px-4 py-3">Match Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/10">
                {logs.map((log, i) => (
                  <tr key={i} className="hover:bg-ink-600/5">
                    <td className="px-4 py-3 font-mono text-ink font-medium">{log.gstin}</td>
                    <td className="px-4 py-3 text-ink-800 truncate max-w-[250px]" title={log.legal_name}>
                      {log.legal_name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        log.registry_status === 'verified' 
                          ? 'bg-stamp-green/10 text-stamp-green border border-stamp-green/20'
                          : log.registry_status === 'unchecked'
                            ? 'bg-ink-600/10 text-ink-600 border border-ink-600/20'
                            : 'bg-stamp-red/10 text-stamp-red border border-stamp-red/20'
                      }`}>
                        {log.registry_status === 'verified' ? log.gst_status || 'Verified' : 
                         log.registry_status === 'unchecked' ? 'Skipped / Unchecked' : 
                         log.registry_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{log.source_provider}</td>
                    <td className="px-4 py-3">
                      {log.name_match_score !== undefined ? (
                        <span className={`font-mono font-medium ${log.name_match_score >= 70 ? 'text-stamp-green' : 'text-stamp-red'}`}>
                          {log.name_match_score}%
                        </span>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
