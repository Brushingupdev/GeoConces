import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function DashboardRightRailSection({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-[#dce8e6] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-2 text-[1.08rem] font-semibold tracking-tight text-slate-950">{title}</h3>
          {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
        </div>

        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            {actionLabel}
            <ArrowUpRight size={14} />
          </Link>
        ) : null}
      </div>

      <div className="mt-5 border-t border-[#edf2f1] pt-5">{children}</div>
      {footer ? <div className="mt-5 border-t border-[#edf2f1] pt-4">{footer}</div> : null}
    </section>
  );
}
