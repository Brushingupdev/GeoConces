import { Activity, Database, GitBranchPlus, RefreshCcw } from "lucide-react";
import type { IngestionResult } from "@/types/ingestion";

const items = [
  { key: "processed", label: "Procesados", icon: Activity },
  { key: "created", label: "Creados", icon: GitBranchPlus },
  { key: "updated", label: "Actualizados", icon: RefreshCcw },
  { key: "events_created", label: "Eventos", icon: Database },
] as const;

export default function ImportSummary({
  result,
}: {
  result: IngestionResult | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-2xl border border-slate-200/90 bg-white/85 px-4 py-4"
        >
          <div className="flex items-center gap-3 text-slate-500">
            <item.icon size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">
              {item.label}
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            {result ? result[item.key] : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
