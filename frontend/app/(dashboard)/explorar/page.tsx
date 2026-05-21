"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, X, Sparkles, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/StatusBadge";
import { useConcessionFilters } from "@/hooks/useConcessionFilters";

const PERU_REGIONS = [
  "Amazonas","Ancash","Apurimac","Arequipa","Ayacucho","Cajamarca","Callao",
  "Cusco","Huancavelica","Huanuco","Ica","Junin","La Libertad","Lambayeque",
  "Lima","Loreto","Madre De Dios","Moquegua","Pasco","Piura","Puno",
  "San Martin","Tacna","Tumbes","Ucayali",
];

const STATUSES = [
  { value: "active",    label: "Activa" },
  { value: "pending",   label: "En trámite" },
  { value: "expired",   label: "Vencida" },
  { value: "suspended", label: "Suspendida" },
];

// Categorías de sustancia de INGEMMET (valores reales en la DB)
const SUBSTANCE_TYPES = [
  { value: "Metálica",    label: "Metálica",    color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "No metálica", label: "No metálica", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "Energética",  label: "Energética",  color: "bg-orange-100 text-orange-800 border-orange-200" },
];

// Normaliza variantes del shapefile a la categoría canónica
function normalizeSubstance(type: string): string {
  const t = type.toLowerCase();
  // "no metálica" debe ir ANTES de "metálica" porque la contiene
  if (t.includes("no metálica") || t.includes("no metalífera") || t === "nm" || t === "n") return "No metálica";
  if (t.includes("metálica") || t.includes("metalífera") || t === "m") return "Metálica";
  if (t.includes("energética") || t === "e") return "Energética";
  return type;
}

export function SubstanceBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-slate-300 text-xs">—</span>;
  const canonical = normalizeSubstance(type);
  const found = SUBSTANCE_TYPES.find(
    (s) => s.value.toLowerCase() === canonical.toLowerCase()
  );
  const color = found?.color ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${color}`}>
      {canonical}
    </span>
  );
}

const SORT_OPTIONS = [
  { value: "name",                    label: "Nombre A-Z" },
  { value: "name-desc",               label: "Nombre Z-A" },
  { value: "area_hectares-desc",      label: "Mayor área" },
  { value: "area_hectares",           label: "Menor área" },
  { value: "registration_date-desc",  label: "Más reciente" },
  { value: "registration_date",       label: "Más antigua" },
];

const LIMIT = 50;

// ── Componente de búsqueda por lenguaje natural + semántica ──────────────────
type SearchMode = "nlp" | "semantic";

function NaturalSearchBar({ onApply, onSemantic }: {
  onApply:    (filters: Record<string, any>, interpreted: string[]) => void;
  onSemantic: (items: any[]) => void;
}) {
  const [nlq,        setNlq]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [mode,       setMode]       = useState<SearchMode>("nlp");
  const [lastInterp, setLastInterp] = useState<string[]>([]);

  const NLP_EXAMPLES = [
    "metálicas en Cajamarca mayores a 500 ha",
    "caducadas con deuda en Arequipa",
    "petitorios grandes en Puno",
    "vigentes de HOCHSCHILD",
  ];

  const SEM_EXAMPLES = [
    "empresa minera de oro grande",
    "concesiones de cobre con deuda en sierra sur",
    "HOCHSCHILD MINING tituladas",
    "concesiones vencidas de plata",
  ];

  const run = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      if (mode === "nlp") {
        const res = await api.get("/search/natural", { params: { q, limit: 200 } });
        setLastInterp(res.data.interpreted ?? []);
        onApply(res.data.filters ?? {}, res.data.interpreted ?? []);
      } else {
        const res = await api.get("/search/semantic", { params: { q, limit: 100, threshold: 0.3 } });
        setLastInterp([`${res.data.total} resultados semánticos`]);
        onSemantic(res.data.items ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const examples = mode === "nlp" ? NLP_EXAMPLES : SEM_EXAMPLES;

  return (
    <div className={`rounded-xl border p-4 ${mode === "semantic" ? "border-indigo-200 bg-indigo-50/40" : "border-violet-200 bg-violet-50/40"}`}>
      {/* Mode tabs */}
      <div className="flex items-center gap-3 mb-3">
        <Sparkles size={13} className={mode === "semantic" ? "text-indigo-500" : "text-violet-500"} />
        <div className="flex rounded-lg border border-white/80 bg-white/70 p-0.5 gap-0.5">
          {(["nlp", "semantic"] as SearchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setLastInterp([]); }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                mode === m
                  ? m === "semantic"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "nlp" ? "📝 NLP (filtros)" : "🧠 Semántica (IA)"}
            </button>
          ))}
        </div>
        {mode === "semantic" && (
          <span className="text-[10px] text-indigo-500 font-medium">
            Encuentra por significado, no solo por palabras exactas
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={nlq}
          onChange={(e) => setNlq(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(nlq)}
          placeholder={
            mode === "nlp"
              ? 'Ej: "metálicas en Cajamarca mayores a 500 ha con deuda"'
              : 'Ej: "empresa minera de cobre grande en el sur"'
          }
          className={`flex-1 rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 transition ${
            mode === "semantic"
              ? "border-indigo-200 focus:border-indigo-400 focus:ring-indigo-100"
              : "border-violet-200 focus:border-violet-400 focus:ring-violet-100"
          }`}
        />
        <button
          onClick={() => run(nlq)}
          disabled={loading || !nlq.trim()}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
            mode === "semantic" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-violet-600 hover:bg-violet-700"
          }`}
        >
          {loading ? "Buscando…" : <><Sparkles size={13} /> Buscar</>}
        </button>
      </div>

      {lastInterp.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          <span className={`text-[10px] font-semibold ${mode === "semantic" ? "text-indigo-500" : "text-violet-500"}`}>
            {mode === "nlp" ? "Interpretado:" : "Resultado:"}
          </span>
          {lastInterp.map((i) => (
            <span key={i} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              mode === "semantic"
                ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                : "bg-violet-100 border-violet-200 text-violet-700"
            }`}>
              {i}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => { setNlq(ex); run(ex); }}
            className={`rounded-full bg-white border px-2 py-0.5 text-[10px] transition ${
              mode === "semantic"
                ? "border-indigo-200 text-indigo-600 hover:bg-indigo-100"
                : "border-violet-200 text-violet-600 hover:bg-violet-100"
            }`}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export default function ExplorarPage() {
  const { search, setSearch, debouncedSearch } = useConcessionFilters();
  const [status,       setStatus]       = useState("");
  const [region,       setRegion]       = useState("");
  const [ctype,        setCtype]        = useState("");
  const [sort,         setSort]         = useState("name");
  const [page,         setPage]         = useState(1);
  const [showFilters,      setShowFilters]      = useState(false);
  const [showNLP,          setShowNLP]          = useState(false);
  const [nlpInterp,        setNlpInterp]        = useState<string[]>([]);
  const [nlpActive,        setNlpActive]        = useState(false);
  const [semanticResults,  setSemanticResults]  = useState<any[] | null>(null);

  const [sortBy, sortDir] = sort.includes("-desc")
    ? [sort.replace("-desc", ""), "desc"]
    : [sort, "asc"];

  const resetPage = () => setPage(1);

  const { data, isLoading } = useQuery({
    queryKey: ["concessions", debouncedSearch, status, region, ctype, sortBy, sortDir, page],
    queryFn: async () => (await api.get("/concessions", {
      params: {
        q:               debouncedSearch || undefined,
        status:          status          || undefined,
        region:          region          || undefined,
        concession_type: ctype           || undefined,
        sort_by:         sortBy,
        sort_dir:        sortDir,
        page,
        limit:           LIMIT,
      },
    })).data,
    placeholderData: (prev) => prev,
  });

  // Fetch substance type counts (once, static data)
  const { data: typeStats } = useQuery({
    queryKey: ["substance-types"],
    queryFn: async () => (await api.get("/concessions/substance-types")).data,
    staleTime: 1000 * 60 * 30,
  });

  const isSemantic = semanticResults !== null;
  const items  = isSemantic ? semanticResults : (data?.items ?? []);
  const total  = isSemantic ? semanticResults.length : (data?.total ?? 0);
  const pages  = isSemantic ? 1 : (data?.pages ?? 1);

  const hasFilters = !!(status || region || ctype || debouncedSearch || nlpActive || isSemantic);

  const clearFilters = () => {
    setSearch(""); setStatus(""); setRegion(""); setCtype("");
    setNlpActive(false); setNlpInterp([]);
    setSemanticResults(null);
    resetPage();
  };

  const handleNLPApply = (filters: Record<string, any>, interpreted: string[]) => {
    setSemanticResults(null);  // reset semantic mode
    if (filters.status)           setStatus(filters.status);
    if (filters.region)           setRegion(filters.region);
    if (filters.concession_type)  setCtype(filters.concession_type);
    if (filters.q)                setSearch(filters.q);
    setNlpInterp(interpreted);
    setNlpActive(true);
    resetPage();
  };

  const handleSemanticResults = (items: any[]) => {
    setSemanticResults(items);
    setNlpActive(false);  // clear NLP mode chips
    setNlpInterp([]);
  };

  return (
    <div className="flex flex-col gap-4 pb-6" style={{ height: "calc(100vh - 16px)" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Explorar concesiones</h1>
          <p className="text-sm text-slate-500">
            {isLoading ? "Buscando…" : isSemantic
              ? `🧠 ${total} resultados semánticos`
              : `${total.toLocaleString("es-PE")} concesiones encontradas`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNLP((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showNLP || nlpActive
                ? "border-violet-400 bg-violet-50 text-violet-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Sparkles size={15} />
            IA
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
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
                {[status, region, ctype, debouncedSearch].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── NLP / Semantic search ── */}
      {showNLP && (
        <NaturalSearchBar onApply={handleNLPApply} onSemantic={handleSemanticResults} />
      )}

      {/* ── Semantic active banner ── */}
      {isSemantic && !showNLP && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm">🧠</span>
          <span className="text-xs font-semibold text-indigo-700">Búsqueda semántica activa</span>
          <span className="text-xs text-indigo-500">— {total} resultados por similitud vectorial</span>
          <button
            onClick={() => setSemanticResults(null)}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            <X size={12} /> Limpiar
          </button>
        </div>
      )}

      {/* ── NLP active chips ── */}
      {nlpActive && nlpInterp.length > 0 && !showNLP && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Sparkles size={12} className="text-violet-500" />
          {nlpInterp.map((i) => (
            <span key={i} className="rounded-full bg-violet-100 border border-violet-200 px-2 py-0.5 text-[10px] text-violet-700 font-medium">
              {i}
            </span>
          ))}
        </div>
      )}

      {/* ── Search + sort (oculto en modo semántico) ── */}
      {!isSemantic && (
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
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); resetPage(); }}
            className="rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 outline-none transition focus:border-primary-400"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Estado */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Estado</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); resetPage(); }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-6 text-sm text-slate-700 outline-none focus:border-primary-400"
              >
                <option value="">Todos</option>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Región */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Región</label>
              <select
                value={region}
                onChange={(e) => { setRegion(e.target.value); resetPage(); }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-6 text-sm text-slate-700 outline-none focus:border-primary-400"
              >
                <option value="">Todas</option>
                {PERU_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Limpiar */}
            <div className="flex items-end">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 transition"
                >
                  <X size={13} /> Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Sustancia pills */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tipo de sustancia
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCtype(""); resetPage(); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  !ctype
                    ? "border-primary-400 bg-primary-50 text-primary-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                Todas
                {typeStats && (
                  <span className="ml-1.5 text-slate-400">
                    {typeStats.reduce((s: number, t: any) => s + t.count, 0).toLocaleString("es-PE")}
                  </span>
                )}
              </button>
              {SUBSTANCE_TYPES.map((t) => {
                const stat = typeStats?.find((s: any) =>
                  s.type?.toLowerCase() === t.value.toLowerCase()
                );
                return (
                  <button
                    key={t.value}
                    onClick={() => { setCtype(t.value); resetPage(); }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      ctype === t.value
                        ? `${t.color} ring-1 ring-offset-1`
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t.label}
                    {stat && (
                      <span className="ml-1.5 text-slate-400">
                        {stat.count.toLocaleString("es-PE")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-[#dce8e6] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#dce8e6]">
            <tr>
              {[
                "Código","Nombre","Titular","Estado","Sustancia","Región","Área (ha)",
                ...(isSemantic ? ["Similitud"] : []),
                "",
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${60 + (j * 7) % 35}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isSemantic ? 9 : 8} className="px-4 py-16 text-center text-slate-400 text-sm">
                  {isSemantic
                    ? "No se encontraron concesiones similares. Prueba con otro texto o baja el umbral."
                    : "No se encontraron concesiones con los filtros aplicados."}
                </td>
              </tr>
            ) : (
              items.map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">{c.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{c.holder_name || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3"><SubstanceBadge type={c.concession_type} /></td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{c.region || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                    {c.area_hectares != null ? Number(c.area_hectares).toLocaleString("es-PE", { maximumFractionDigits: 0 }) : "—"}
                  </td>
                  {isSemantic && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${Math.round((c.score ?? 0) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-indigo-600 font-semibold tabular-nums">
                          {Math.round((c.score ?? 0) * 100)}%
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      href={`/explorar/${c.id}`}
                      className="rounded-md border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination (oculta en modo semántico) ── */}
      {isSemantic ? (
        <div className="shrink-0 text-center text-xs text-slate-400">
          Resultados ordenados por similitud semántica · <button onClick={() => setSemanticResults(null)} className="text-indigo-500 hover:underline">Volver a búsqueda normal</button>
        </div>
      ) : (
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, pages - 4));
            const p = start + i;
            return p <= pages ? (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                  p === page
                    ? "bg-primary-700 text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ) : null;
          })}

          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
