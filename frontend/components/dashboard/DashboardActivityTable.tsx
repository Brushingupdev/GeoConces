import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, DatabaseZap } from "lucide-react";

export interface DashboardActivityRow {
  id: string | number;
  title: string;
  subtitle?: string;
  status: string;
  statusTone?: "default" | "success" | "warning" | "danger";
  source?: string;
  records?: string;
  date?: string;
  href?: string;
  icon?: LucideIcon;
}

const toneClasses = {
  default: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function DashboardActivityTable({
  title,
  description,
  rows,
  emptyState,
  footerHref,
  footerLabel = "Ver historial completo",
}: {
  title: string;
  description?: string;
  rows: DashboardActivityRow[];
  emptyState?: ReactNode;
  footerHref?: string;
  footerLabel?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#dce8e6] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 px-5 pb-3 pt-5 sm:px-6">
        <h3 className="text-[1.18rem] font-semibold tracking-tight text-slate-950">{title}</h3>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white text-xs text-slate-500">
            <tr>
              <th className="px-5 py-4 font-medium sm:px-6">Evento</th>
              <th className="px-5 py-4 font-medium">Fuente</th>
              <th className="px-5 py-4 font-medium">Registros</th>
              <th className="px-5 py-4 font-medium">Estado</th>
              <th className="px-5 py-4 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-8 sm:px-6" colSpan={5}>
                  {emptyState || (
                    <p className="text-sm text-slate-500">No hay actividad reciente para mostrar.</p>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const RowIcon = row.icon || DatabaseZap;
                return (
                  <tr key={row.id} className="border-t border-[#edf2f1] align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 sm:px-6">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#eef5f4_0%,#f8fbfb_100%)] text-primary-900">
                          <RowIcon size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-950">{row.title}</p>
                          {row.subtitle ? <p className="mt-1 text-slate-500">{row.subtitle}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{row.source || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{row.records || "-"}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                          toneClasses[row.statusTone || "default"]
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{row.date || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {footerHref ? (
        <a
          href={footerHref}
          className="inline-flex items-center gap-3 px-6 pb-6 pt-3 text-sm font-medium text-primary-800 transition hover:text-primary-950"
        >
          {footerLabel}
          <ArrowRight size={15} />
        </a>
      ) : null}
    </section>
  );
}
