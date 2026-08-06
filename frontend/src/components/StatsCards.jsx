import { fmtCurrency } from "../utils/format.js";
import { AlertTriangle, FileSearch, ShieldAlert, DollarSign, Clock } from "lucide-react";

/**
 * KPI strip — 5 key metrics presented as clean stat tiles.
 * Strong number typography, minimal decoration.
 * Risk-colored only where semantically meaningful.
 */

function KPICard({ icon: Icon, eyebrow, value, sub, variant = "default" }) {
  const variantStyles = {
    default: {
      wrapper: "bg-ink-800 border border-ink-600/30",
      eyebrow: "text-paper/50",
      value: "text-paper",
      sub: "text-paper/40",
      icon: "text-ink-600",
    },
    danger: {
      wrapper: "bg-ink-800 border border-stamp-red/25",
      eyebrow: "text-stamp-red/70",
      value: "text-stamp-red",
      sub: "text-paper/40",
      icon: "text-stamp-red/60",
    },
    warning: {
      wrapper: "bg-ink-800 border border-stamp-amber/25",
      eyebrow: "text-stamp-amber/70",
      value: "text-stamp-amber",
      sub: "text-paper/40",
      icon: "text-stamp-amber/60",
    },
  };

  const s = variantStyles[variant] ?? variantStyles.default;

  return (
    <div
      className={`${s.wrapper} rounded-xl p-5 flex flex-col gap-3
                  transition-all duration-150 hover:border-ink-600/60`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${s.eyebrow}`}>
          {eyebrow}
        </p>
        {Icon && <Icon size={15} className={s.icon} strokeWidth={1.8} />}
      </div>
      <div>
        <p className={`font-display text-2xl sm:text-3xl font-bold leading-none ${s.value}`}>
          {value ?? <span className="opacity-30">—</span>}
        </p>
        {sub && (
          <p className={`text-xs font-sans mt-1.5 leading-snug ${s.sub}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}

function KPICardSkeleton() {
  return <div className="bg-ink-800 border border-ink-600/20 rounded-xl p-5 h-28 animate-pulse" />;
}

export default function StatsCards({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const aiAvoided = stats.aiCallsAvoided ?? 0;
  const needReview = stats.needsReviewCount ?? stats.openTickets ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <KPICard
        icon={FileSearch}
        eyebrow="Invoices Screened"
        value={stats.invoicesProcessed?.toLocaleString("en-IN") ?? "—"}
        sub="total in database"
        variant="default"
      />
      <KPICard
        icon={AlertTriangle}
        eyebrow="Need Review"
        value={needReview}
        sub="awaiting decision"
        variant={needReview > 0 ? "warning" : "default"}
      />
      <KPICard
        icon={ShieldAlert}
        eyebrow="High Risk"
        value={stats.highRiskCount ?? stats.openTickets ?? "—"}
        sub="risk score ≥ 60"
        variant={stats.highRiskCount > 0 ? "danger" : "default"}
      />
      <KPICard
        icon={DollarSign}
        eyebrow="ITC at Risk"
        value={fmtCurrency(stats.itcAtRiskInr)}
        sub="tax credit exposure"
        variant={stats.itcAtRiskInr > 0 ? "danger" : "default"}
      />
      <KPICard
        icon={Clock}
        eyebrow="MSME Exposure"
        value={fmtCurrency(stats.msmePenaltyExposureInr)}
        sub="45-day deadline risk"
        variant={stats.msmePenaltyExposureInr > 0 ? "warning" : "default"}
      />
    </div>
  );
}
