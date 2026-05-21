"use client";

import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ExternalLink, AlertTriangle, TrendingDown, RefreshCw, PlusCircle } from "lucide-react";
import Link from "next/link";

const TYPE_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  expiration:    { label: "Vencimiento",      color: "bg-red-100 text-red-700 border-red-200",     Icon: AlertTriangle },
  status_change: { label: "Cambio de estado", color: "bg-amber-100 text-amber-700 border-amber-200", Icon: RefreshCw },
  debt:          { label: "Deuda vigencia",   color: "bg-orange-100 text-orange-700 border-orange-200", Icon: TrendingDown },
  new_concession:{ label: "Nueva concesión",  color: "bg-green-100 text-green-700 border-green-200",  Icon: PlusCircle },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export default function AlertasPage() {
  const qc = useQueryClient();

  const { data: alerts, isLoading } = useQuery<any[]>({
    queryKey: ["alerts"],
    queryFn: async () => (await api.get("/alerts")).data,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/alerts/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts", "unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = alerts?.filter((a) => !a.is_read) ?? [];
      await Promise.all(unread.map((a) => api.post(`/alerts/${a.id}/read`)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts", "unread-count"] });
    },
  });

  const unreadCount = alerts?.filter((a) => !a.is_read).length ?? 0;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Alertas</h1>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <CheckCheck size={15} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))
        ) : !alerts?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Bell size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">Sin alertas</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Agrega RUCs en <Link href="/mis-concesiones" className="text-primary-600 hover:underline">Mis Concesiones</Link> para empezar a monitorear.
            </p>
          </div>
        ) : (
          alerts.map((a: any) => {
            const cfg = TYPE_CONFIG[a.alert_type] ?? { label: a.alert_type, color: "bg-slate-100 text-slate-600 border-slate-200", Icon: Bell };
            return (
              <div
                key={a.id}
                className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                  a.is_read
                    ? "border-slate-200 bg-white"
                    : "border-primary-200 bg-primary-50/40"
                }`}
              >
                {/* Unread dot */}
                <div className="mt-1 shrink-0">
                  {a.is_read
                    ? <div className="h-2 w-2 rounded-full bg-slate-200" />
                    : <div className="h-2 w-2 rounded-full bg-primary-500" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-400">{fmt(a.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.message}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {a.related_concession_id && (
                    <Link
                      href={`/explorar/${a.related_concession_id}`}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      <ExternalLink size={11} /> Ver
                    </Link>
                  )}
                  {!a.is_read && (
                    <button
                      onClick={() => markRead.mutate(a.id)}
                      disabled={markRead.isPending}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
                    >
                      Leída
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
