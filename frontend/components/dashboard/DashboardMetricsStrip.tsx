import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type MetricTrend = "up" | "down" | "neutral";

export interface DashboardMetricItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  context?: string;
  delta?: string;
  trend?: MetricTrend;
}

const trendStyles: Record<MetricTrend, string> = {
  up: "text-emerald-700",
  down: "text-rose-700",
  neutral: "text-slate-500",
};

const trendIcons: Record<MetricTrend, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
};

export default function DashboardMetricsStrip({
  metrics,
}: {
  metrics: DashboardMetricItem[];
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#dce8e6] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="grid gap-px bg-[#dce8e6] md:grid-cols-3">
        {metrics.map((metric) => {
          const TrendIcon = trendIcons[metric.trend || "neutral"];
          return (
            <article key={metric.label} className="min-w-0 bg-white px-7 py-8">
              <div className="flex items-start gap-5">
                <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#edf6f5_0%,#e7f1f0_100%)] text-primary-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <metric.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-slate-900">{metric.label}</p>
                  <p className="mt-2 text-[2rem] font-semibold leading-none tracking-tight text-slate-950">
                    {metric.value}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    {metric.delta ? (
                      <>
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap font-medium ${trendStyles[metric.trend || "neutral"]}`}
                        >
                          <TrendIcon size={14} />
                          {metric.delta}
                        </span>
                        {metric.context ? (
                          <span className="text-slate-500">{metric.context}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-500">
                        {metric.context ? `— ${metric.context}` : null}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
