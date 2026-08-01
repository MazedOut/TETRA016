import { useEffect, useState } from "react";
import { fetchTickets } from "../api/client.js";
import TicketCard from "../components/TicketCard.jsx";
import RiskConfidenceFilter from "../components/RiskConfidenceFilter.jsx";
import MergeConfirmModal from "../components/MergeConfirmModal.jsx";

/**
 * Ticket list with dual risk/confidence filter, search, and status filters.
 */
export default function ExceptionQueue() {
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);

  useEffect(() => {
    fetchTickets(filters).then(setTickets);
  }, [filters]);

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Exception queue</h2>
          <p className="text-sm text-paper/60 mt-1">
            Sorted by risk score. Confidence is a separate, independently filterable axis.
          </p>
        </div>
        {selected.length === 2 && (
          <button
            onClick={() => setMergeOpen(true)}
            className="bg-stamp-amber text-ink px-3 py-1.5 rounded-md text-sm font-medium"
          >
            Propose merge ({selected.length})
          </button>
        )}
      </div>

      <RiskConfidenceFilter onChange={setFilters} />

      <div className="space-y-3">
        {tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} selected={selected.includes(t.id)} onToggleSelect={toggleSelect} />
        ))}
        {tickets.length === 0 && (
          <p className="text-sm text-paper/50 font-mono py-8 text-center">No tickets match these filters.</p>
        )}
      </div>

      {mergeOpen && (
        <MergeConfirmModal
          ticketIds={selected}
          aiReason="Both tickets flag the same vendor and invoice pattern within a 40-minute window — likely one underlying event."
          onClose={() => setMergeOpen(false)}
          onDecided={() => setSelected([])}
        />
      )}
    </div>
  );
}
