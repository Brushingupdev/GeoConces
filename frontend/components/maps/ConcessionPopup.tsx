import Link from "next/link";
import type { ConcessionMapFeature } from "@/types/concessions";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Activa",      cls: "bg-green-100 text-green-700" },
  pending:   { label: "En trámite",  cls: "bg-amber-100 text-amber-700" },
  expired:   { label: "Vencida",     cls: "bg-red-100 text-red-700" },
  suspended: { label: "Suspendida",  cls: "bg-slate-100 text-slate-600" },
};

export default function ConcessionPopup({ feature }: { feature: ConcessionMapFeature }) {
  const badge = STATUS_BADGE[feature.status] ?? { label: feature.status, cls: "bg-slate-100 text-slate-600" };

  return (
    <div className="min-w-[200px] space-y-2 py-0.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-800 leading-tight text-sm">{feature.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <p className="font-mono text-xs text-slate-400">{feature.code}</p>

      <div className="space-y-1 text-xs text-slate-600">
        {feature.holder_name && (
          <div className="flex gap-1">
            <span className="text-slate-400 shrink-0">Titular</span>
            <span className="truncate font-medium">{feature.holder_name}</span>
          </div>
        )}
        {feature.region && (
          <div className="flex gap-1">
            <span className="text-slate-400 shrink-0">Región</span>
            <span className="truncate">{feature.region}</span>
          </div>
        )}
        {feature.area_hectares != null && (
          <div className="flex gap-1">
            <span className="text-slate-400 shrink-0">Área</span>
            <span>{feature.area_hectares.toLocaleString("es-PE")} ha</span>
          </div>
        )}
      </div>

      <Link
        href={`/explorar/${feature.id}`}
        className="mt-1 block w-full rounded-lg bg-primary-700 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-primary-800 transition"
      >
        Ver detalle →
      </Link>
    </div>
  );
}
