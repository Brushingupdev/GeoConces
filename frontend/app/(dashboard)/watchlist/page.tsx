"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, ExternalLink, BookmarkCheck,
  ChevronDown, ChevronUp, X,
} from "lucide-react";
import SubstanceBadge from "@/components/ui/SubstanceBadge";

const STATUS_LABELS: Record<string, string> = {
  active: "Vigente", expired: "Caducada",
  pending: "En trámite", suspended: "Suspendida",
};
const STATUS_STYLES: Record<string, string> = {
  active:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  expired:   "border-red-200 bg-red-50 text-red-700",
  pending:   "border-amber-200 bg-amber-50 text-amber-700",
  suspended: "border-slate-200 bg-slate-100 text-slate-500",
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export default function WatchlistPage() {
  const qc = useQueryClient();
  const [newName,   setNewName]   = useState("");
  const [expanded,  setExpanded]  = useState<Record<number, boolean>>({});
  const [deleting,  setDeleting]  = useState<number | null>(null);

  const { data: watchlists, isLoading } = useQuery<any[]>({
    queryKey: ["watchlists"],
    queryFn: async () => (await api.get("/watchlists")).data,
  });

  const create = useMutation({
    mutationFn: async (name: string) => (await api.post("/watchlists", { name })).data,
    onSuccess: (wl) => {
      setNewName("");
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      setExpanded((prev) => ({ ...prev, [wl.id]: true }));
    },
  });

  const deleteItem = useMutation({
    mutationFn: async ({ wlId, itemId }: { wlId: number; itemId: number }) =>
      api.delete(`/watchlists/${wlId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });

  const deleteWatchlist = useMutation({
    mutationFn: async (wlId: number) => api.delete(`/watchlists/${wlId}`),
    onSuccess: () => {
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["watchlists"] });
    },
  });

  const toggle = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalItems = watchlists?.reduce((s, wl) => s + (wl.items?.length ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-4xl">

      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Watchlist</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {watchlists?.length
            ? `${watchlists.length} lista${watchlists.length > 1 ? "s" : ""} · ${totalItems} concesiones guardadas`
            : "Guarda concesiones de interés organizadas en listas."}
        </p>
      </div>

      {/* Nueva lista */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && create.mutate(newName.trim())}
            placeholder="Nombre de la nueva lista…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-4 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <button
          onClick={() => newName.trim() && create.mutate(newName.trim())}
          disabled={!newName.trim() || create.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition disabled:opacity-50"
        >
          <Plus size={15} />
          {create.isPending ? "Creando…" : "Crear lista"}
        </button>
      </div>

      {/* Listas */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : !watchlists?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <BookmarkCheck size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Sin listas aún</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Crea tu primera lista y guarda concesiones desde la página de explorar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {watchlists.map((wl: any) => {
            const isOpen = expanded[wl.id] !== false; // abierto por defecto
            const isConfirmingDelete = deleting === wl.id;

            return (
              <div key={wl.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header de la lista */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <button
                    onClick={() => toggle(wl.id)}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                  >
                    <BookmarkCheck size={16} className="text-primary-600 shrink-0" />
                    <span className="font-semibold text-slate-900 truncate">{wl.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {wl.items?.length ?? 0} concesión{(wl.items?.length ?? 0) !== 1 ? "es" : ""}
                    </span>
                    {isOpen
                      ? <ChevronUp size={14} className="text-slate-400 shrink-0" />
                      : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                  </button>

                  {/* Eliminar lista */}
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">¿Eliminar lista?</span>
                      <button
                        onClick={() => deleteWatchlist.mutate(wl.id)}
                        disabled={deleteWatchlist.isPending}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setDeleting(null)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleting(wl.id)}
                      className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Eliminar lista"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Items */}
                {isOpen && (
                  <div>
                    {!wl.items?.length ? (
                      <div className="px-5 py-6 text-center">
                        <p className="text-sm text-slate-400">Lista vacía.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Abre cualquier concesión y haz click en{" "}
                          <span className="font-medium text-slate-500">"Guardar"</span> para añadirla aquí.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {wl.items.map((item: any) => {
                          const c = item.concession;
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition group">
                              {/* Status dot */}
                              <div className="shrink-0">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[c.status] ?? STATUS_STYLES.suspended}`}>
                                  {STATUS_LABELS[c.status] ?? c.status}
                                </span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="font-mono text-[10px] text-slate-400">{c.code}</span>
                                  {c.holder_name && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{c.holder_name}</span>
                                  )}
                                  {c.region && (
                                    <span className="text-[10px] text-slate-400">{c.region}</span>
                                  )}
                                </div>
                              </div>

                              {/* Sustancia + área */}
                              <div className="hidden sm:flex items-center gap-2 shrink-0">
                                <SubstanceBadge type={c.concession_type} />
                                {c.area_hectares && (
                                  <span className="text-[10px] text-slate-400">
                                    {Number(c.area_hectares).toLocaleString("es-PE", { maximumFractionDigits: 0 })} ha
                                  </span>
                                )}
                              </div>

                              {/* Fecha añadida */}
                              <span className="hidden md:block text-[10px] text-slate-400 shrink-0">
                                {fmt(item.added_at)}
                              </span>

                              {/* Acciones */}
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                <Link
                                  href={`/explorar/${c.id}`}
                                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 transition"
                                  title="Ver concesión"
                                >
                                  <ExternalLink size={13} />
                                </Link>
                                <button
                                  onClick={() => deleteItem.mutate({ wlId: wl.id, itemId: item.id })}
                                  disabled={deleteItem.isPending}
                                  className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition"
                                  title="Quitar de la lista"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
