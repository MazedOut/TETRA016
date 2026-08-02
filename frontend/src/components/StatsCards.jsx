/**
 * Top-of-dashboard summary metrics: ITC-at-risk, processed count, MSME penalty exposure, AI cost-savings.
 * Material elevation: elev-1 resting, elev-2 on hover (via .paper-surface CSS).
 */

function Card({ eyebrow, value, sub, highlight }) {
  return (
    <div
      className={
        "paper-surface rounded-xl p-5 text-ink flex flex-col justify-between gap-2 " +
        "transition-all duration-150 hover:-translate-y-0.5 " +
        (highlight ? "border border-stamp-green/40 bg-stamp-green/5" : "")
      }
    >
      <div>
        {/* Caption scale: text-[11px] uppercase mono */}
        <p className="text-[11px] uppercase tracking-wider text-ink-600 font-mono mb-2">{eyebrow}</p>
        {/* Display scale: text-2xl/3xl display semibold */}
        <p className="font-display text-2xl sm:text-3xl font-semibold leading-none">{value}</p>
      </div>
      {sub && <p className="text-xs text-ink-600 font-sans leading-snug">{sub}</p>}
    </div>
  );
}

export default function StatsCards({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="paper-surface rounded-xl p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const aiAvoided = stats.aiCallsAvoided ?? 0;
  const aiFallbacks = stats.aiFallbackCount ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card
        eyebrow="ITC at risk"
        value={`₹${Number(stats.itcAtRiskInr || 0).toLocaleString("en-IN")}`}
        sub="tax credit tied to high-risk invoices"
      />
      <Card eyebrow="Processed" value={stats.invoicesProcessed} sub="invoices total in database" />
      <Card eyebrow="Open tickets" value={stats.openTickets} sub="awaiting auditor review" />
      <Card
        eyebrow="MSME penalty exposure"
        value={`₹${Number(stats.msmePenaltyExposureInr || 0).toLocaleString("en-IN")}`}
        sub="45-day MSME deadline risk"
      />
      <Card
        eyebrow="AI Cost Savings"
        value={`${aiAvoided} / ${stats.invoicesProcessed}`}
        sub={`${aiFallbacks} AI vision fallbacks, ${aiAvoided} rule-only (100% saved)`}
        highlight={true}
      />
    </div>
  );
}
