"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/ui/StatusBadge";
import { Search, X, Building2, User, ChevronRight } from "lucide-react";

type TrackedRuc  = { id: number; ruc: string; label?: string | null; created_at: string };
type Concession  = { id: number; code: string; name: string; holder_name?: string | null; status: string; region?: string | null; area_hectares?: number | null };
type HolderHint  = { holder_name: string; holder_ruc: string | null; concession_count: number };

// ── Debounce hook ──────────────────────────────────────────────────────────────
function useDebounce(value: string, ms = 350) {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return d;
}

// ── Holder search autocomplete ─────────────────────────────────────────────────
function HolderSearch({ onAdd }: { onAdd: (ruc: string, name: string) => void }) {
  const [input, setInput]         = useState("");
  const [open, setOpen]           = useState(false);
  const [manualRuc, setManualRuc] = useState("");
  const [mode, setMode]           = useState<"search" | "ruc">("search");
  const ref = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(input, 350);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: hints } = useQuery<HolderHint[]>({
    queryKey: ["holders-search", debounced],
    queryFn: async () => (await api.get("/concessions/holders", { params: { q: debounced } })).data,
    enabled: debounced.length >= 2 && mode === "search",
  });

  const handleSelect = (h: HolderHint) => {
    onAdd(h.holder_ruc ?? "", h.holder_name);
    setInput(""); setOpen(false);
  };

  const handleManualAdd = () => {
    if (manualRuc.length === 11) { onAdd(manualRuc, ""); setManualRuc(""); setMode("search"); }
  };

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {/* Toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
        <button
          onClick={() => setMode("search")}
          className={`px-4 py-1.5 text-sm font-medium transition ${mode === "search" ? "bg-primary-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Por nombre
        </button>
        <button
          onClick={() => setMode("ruc")}
          className={`px-4 py-1.5 text-sm font-medium transition ${mode === "ruc" ? "bg-primary-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Por RUC
        </button>
      </div>

      {mode === "search" ? (
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Escribe el nombre del titular o empresa…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            {input && (
              <button onClick={() => { setInput(""); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {open && hints && hints.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              {hints.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(h)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                    {h.holder_name?.includes("S.A") || h.holder_name?.includes("S.R") || h.holder_name?.includes("CIA")
                      ? <Building2 size={14} className="text-primary-600" />
                      : <User size={14} className="text-primary-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{h.holder_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {h.holder_ruc
                        ? <>RUC <span className="font-mono">{h.holder_ruc}</span> · {h.concession_count} concesión{h.concession_count !== 1 ? "es" : ""}</>
                        : <span className="text-amber-500">Sin RUC registrado</span>
                      }
                    </p>
                  </div>
                  {h.holder_ruc && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                </button>
              ))}
            </div>
          )}

          {open && debounced.length >= 2 && hints?.length === 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm text-slate-500">
              Sin resultados para "<strong>{debounced}</strong>"
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={manualRuc}
            onChange={(e) => setManualRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
            placeholder="RUC (11 dígitos)"
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 px-4 text-sm font-mono text-slate-800 placeholder-slate-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          <button
            onClick={handleManualAdd}
            disabled={manualRuc.length !== 11}
            className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40 transition"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MisConcesionesPage() {
  const qc = useQueryClient();
  const [addError, setAddError] = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const debSearch = useDebounce(search);

  const { data: tracked } = useQuery<TrackedRuc[]>({
    queryKey: ["tracked-rucs"],
    queryFn: async () => (await api.get("/users/me/tracked-rucs")).data,
  });

  const { data: concessions, isLoading } = useQuery<Concession[]>({
    queryKey: ["my-concessions", debSearch],
    queryFn: async () => (await api.get("/concessions/mine", { params: { q: debSearch || undefined } })).data,
    enabled: (tracked?.length ?? 0) > 0,
  });

  const addRuc = useMutation({
    mutationFn: async ({ ruc, label }: { ruc: string; label: string }) => {
      setAddError(null);
      const body = ruc
        ? { ruc, label: label || null }
        : { holder_name: label, label };
      return (await api.post("/users/me/tracked-rucs", body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracked-rucs"] });
      qc.invalidateQueries({ queryKey: ["my-concessions"] });
    },
    onError: (err: any) => setAddError(err?.response?.data?.detail || "Error al agregar titular"),
  });

  const removeRuc = useMutation({
    mutationFn: (id: number) => api.delete(`/users/me/tracked-rucs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracked-rucs"] });
      qc.invalidateQueries({ queryKey: ["my-concessions"] });
    },
  });

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Mis Concesiones</h1>
        <p className="text-sm text-slate-500">
          Sigue concesiones de uno o más titulares. Se actualizan automáticamente.
        </p>
      </div>

      {/* Agregar titular */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Agregar titular</h2>
        <HolderSearch
          onAdd={(ruc, name) => addRuc.mutate({ ruc, label: name })}
        />
        {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}

        {/* Titulares seguidos */}
        {tracked && tracked.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tracked.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-700">{t.label || t.ruc}</span>
                {t.label && <span className="font-mono text-xs text-slate-400">{t.ruc}</span>}
                <button
                  onClick={() => removeRuc.mutate(t.id)}
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Lista de concesiones */}
      {(tracked?.length ?? 0) > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por código, nombre o titular…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* Table */}
          <div className="overflow-auto rounded-xl border border-[#dce8e6] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-[#dce8e6]">
                <tr>
                  {["Código","Nombre","Titular","Estado","Región","Área (ha)",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !concessions?.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      No se encontraron concesiones para los titulares seguidos.
                    </td>
                  </tr>
                ) : (
                  concessions.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{c.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[180px] truncate">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate">{c.holder_name || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{c.region || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">{c.area_hectares?.toFixed(0) || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/explorar/${c.id}`} className="rounded-md border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty state */}
      {!tracked?.length && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Building2 size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Sin titulares seguidos</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Busca un titular por nombre arriba para empezar a monitorear sus concesiones.
          </p>
        </div>
      )}
    </div>
  );
}
