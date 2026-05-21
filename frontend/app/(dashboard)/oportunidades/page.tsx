"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  TrendingUp, AlertTriangle, Eye, Zap, X,
} from "lucide-react";
import { SubstanceBadge } from "@/app/(dashboard)/explorar/page";

// ── Tipos de oportunidad ──────────────────────────────────────────────────────
const OPP_TYPES = [
  {
    key: "libre_denunciabilidad",
    label: "Libre denunciabilidad",
    short: "Libre",
    description: "Área caducada disponible para nuevo petitorio",
    color: "border-red-200 bg-red-50 text-red-700",
    activeColor: "border-red-400 bg-red-100 text-red-800 ring-1 ring-red-300",
    dot: "bg-red-400",
  },
  {
    key: "adquisicion",
    label: "Adquisición",
    short: "Adquisición",
    description: "Titular con deuda o señales de interés en vender",
    color: "border-amber-200 bg-amber-50 text-amber-700",
    activeColor: "border-amber-400 bg-amber-100 text-amber-800 ring-1 ring-amber-300",
    dot: "bg-amber-400",
  },
  {
    key: "monitoreo",
    label: "Monitoreo",
    short: "Monitoreo",
    description: "Petitorio grande en zona de alto valor",
    color: "border-blue-200 bg-blue-50 text-blue-700",
    activeColor: "border-blue-400 bg-blue-100 text-blue-800 ring-1 ring-blue-300",
    dot: "bg-blue-500",
  },
] as const;

const PERU_REGIONS = [
  "Amazonas","Ancash","Apurimac","Arequipa","Ayacucho","Cajamarca",
  "Cusco","Huancavelica","Huanuco","Ica","Junin","La Libertad",
  "Lambayeque","Lima","Loreto","Madre De Dios","Moquegua","Pasco",
  "Piura","Puno","San Martin","Tacna","Tumbes","Ucayali",
];

const LIMIT = 50;

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-red-500" :
    score >= 60 ? "bg-amber-500" :
    score >= 40 ? "bg-yellow-400" :
                  "bg-emerald-400";
  const label =
    score >= 80 ? "Muy alta" :
    score >= 60 ? "Alta" :
    score >= 40 ? "Media" : "Baja";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <span className="text-sm font-bold text-slate-800 w-6 text-right">{score}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 w-12">{label}</span>
    </div>
  );
}

function OppTypeBadge({ type }: { type: string }) {
  const cfg = OPP_TYPES.find(t => t.key === type);
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.short}
    </span>
  );
}

export default function OportunidadesPage() {
  const [search,    setSearch]    = useState("");
  const [oppType,   setOppType]   = useState("");
  const [region,    setRegion]    = useState("");
  const [sustancia, setSustancia] = useState("");
  const [areaMin,   setAreaMin]   = useState("");
  const [minScore,  setMinScore]  = useState(30);
  const [page,      setPage]      = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const resetPage = () => setPage(1);
  const hasFilters = !!(search || oppType || region || sustancia || areaMin || minScore !== 30);

  const { data: stats } = useQuery({
    queryKey: ["opp-stats"],
    queryFn: async () => (await api.get("/opportunities/stats")).data,
    staleTime: 1000 * 60 * 5,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["opportunities", search, oppType, region, sustancia, areaMin, minScore, page],
    queryFn: async () => (await api.get("/opportunities", {
      params: {
        q:         search    || undefined,
        opp_type:  oppType   || undefined,
        region:    region    || undefined,
        sustancia: sustancia || undefined,
        area_min:  areaMin   ? Number(areaMin) : undefined,
        min_score: minScore,
        limit:     LIMIT,
        page,
      },
    })).data,
    placeholderData: (prev) => prev,
  });

  const items  = data?.items  ?? [];
  const total  = data?.total  ?? 0;
  const pages  = data?.pages  ?? 1;

  return (
    <div className="flex flex-col gap-4 pb-6" style={{ height: "calc(100vh - 16px)" }}>

      {/* Header */}
      <div className="flex items-start justify-between pt-1 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Oportunidades</h1>
          <p className="text-sm text-slate-500">
            {isLoading ? "Calculando…" : `${total.toLocaleString("es-PE")} oportunidades detectadas`}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            showFilters || hasFilters
              ? "border-primary-400 bg-primary-50 text-primary-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {hasFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
              {[search, oppType, region, sustancia, areaMin, minScore !== 30 ? "1" : ""].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {OPP_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => { setOppType(oppType === t.key ? "" : t.key); resetPage(); }}
            className={`rounded-xl border p-3 text-left transition ${
              oppType === t.key ? t.activeColor : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`h-2 w-2 rounded-full ${t.dot}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.short}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {stats ? (stats[t.key] ?? 0).toLocaleString("es-PE") : "—"}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Código, nombre o titular…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
          <Zap size={13} className="text-amber-400 shrink-0" />
          <span className="text-xs text-slate-400 shrink-0">Score mín.</span>
          <input
            type="number" min={0} max={100} value={minScore}
            onChange={(e) => { setMinScore(Number(e.target.value) || 0); resetPage(); }}
            className="w-12 text-sm font-semibold text-slate-800 outline-none text-center"
          />
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Región</label>
              <select
                value={region}
                onChange={(e) => { setRegion(e.target.value); resetPage(); }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-6 text-sm text-slate-700 outline-none focus:border-primary-400"
              >
                <option value="">Todas</option>
                {PERU_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Sustancia</label>
              <select
                value={sustancia}
                onChange={(e) => { setSustancia(e.target.value); resetPage(); }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-6 text-sm text-slate-700 outline-none focus:border-primary-400"
              >
                <option value="">Todas</option>
                <option value="Metálica">Metálica</option>
                <option value="No metálica">No metálica</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Área mínima (ha)</label>
              <input
                type="number" min={0} value={areaMin}
                onChange={(e) => { setAreaMin(e.target.value); resetPage(); }}
                placeholder="ej. 500"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-700 outline-none focus:border-primary-400"
              />
            </div>
            <div className="flex items-end">
              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setOppType(""); setRegion(""); setSustancia(""); setAreaMin(""); setMinScore(30); resetPage(); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 transition"
                >
                  <X size={13} /> Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-[#dce8e6] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#dce8e6]">
            <tr>
              {["Score","Tipo","Código","Nombre","Titular","Sustancia","Región","Área (ha)","Factores",""].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${50 + (j * 9) % 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <TrendingUp size={28} className="opacity-30" />
                    <p className="text-sm">No hay oportunidades con los filtros actuales.</p>
                    <p className="text-xs">Reduce el score mínimo o cambia los filtros.</p>
                  </div>
                </td>
              </tr>
            ) : items.map((o: any) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-3 min-w-[120px]">
                  <ScoreBar score={o.score} />
                </td>
                <td className="px-3 py-3">
                  <OppTypeBadge type={o.opp_type} />
                </td>
                <td className="px-3 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                  {o.code}
                </td>
                <td className="px-3 py-3 font-medium text-slate-900 max-w-[160px] truncate">
                  {o.name}
                </td>
                <td className="px-3 py-3 text-slate-500 max-w-[140px] truncate text-xs">
                  {o.holder_name || "—"}
                </td>
                <td className="px-3 py-3">
                  <SubstanceBadge type={o.concession_type} />
                </td>
                <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {o.region || "—"}
                </td>
                <td className="px-3 py-3 text-slate-600 tabular-nums text-xs whitespace-nowrap">
                  {o.area_hectares != null
                    ? Number(o.area_hectares).toLocaleString("es-PE", { maximumFractionDigits: 0 })
                    : "—"}
                </td>
                <td className="px-3 py-3 max-w-[220px]">
                  <div className="flex flex-wrap gap-1">
                    {(o.factors as string[]).map((f, i) => (
                      <span key={i} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 whitespace-nowrap">
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/explorar/${o.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition whitespace-nowrap"
                  >
                    <Eye size={11} /> Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-500">
          Mostrando{" "}
          <span className="font-medium text-slate-700">
            {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)}
          </span>{" "}
          de <span className="font-medium text-slate-700">{total.toLocaleString("es-PE")}</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
          >
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, pages - 4));
            const p = start + i;
            return p <= pages ? (
              <button key={p} onClick={() => setPage(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                  p === page ? "bg-primary-700 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >{p}</button>
            ) : null;
          })}
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
