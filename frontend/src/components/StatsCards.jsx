/**
 * Top-of-dashboard summary metrics: ITC-at-risk, processed count, MSME penalty exposure.
 */

function Card({ eyebrow, value, sub }) {
  return (
    <div className="paper-surface rounded-lg p-5 text-ink">
      <p className="text-[11px] uppercase tracking-wider text-ink-600 font-mono mb-2">{eyebrow}</p>
      <p className="font-display text-3xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-ink-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function StatsCards({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="paper-surface rounded-lg p-5 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        eyebrow="ITC at risk"
        value={`₹${Number(stats.itcAtRiskInr).toLocaleString("en-IN")}`}
        sub="input tax credit tied to flagged invoices"
      />
      <Card eyebrow="Processed" value={stats.invoicesProcessed} sub="invoices this session" />
      <Card eyebrow="Open tickets" value={stats.openTickets} sub="awaiting human review" />
      <Card
        eyebrow="MSME penalty exposure"
        value={`₹${Number(stats.msmePenaltyExposureInr).toLocaleString("en-IN")}`}
        sub="invoices approaching the 45-day limit"
      />
    </div>
  );
}
