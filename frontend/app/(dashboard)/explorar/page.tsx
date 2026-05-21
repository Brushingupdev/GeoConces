"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search, ChevronLeft, ChevronRight, X, Sparkles, ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/StatusBadge";
import SubstanceBadgeComponent from "@/components/ui/SubstanceBadge";
import { useConcessionFilters } from "@/hooks/useConcessionFilters";

/* ── Constants ───────────────────────────────────────────────────────────── */

const PERU_REGIONS = [
  "Amazonas","Ancash","Apurimac","Arequipa","Ayacucho","Cajamarca","Callao",
  "Cusco","Huancavelica","Huanuco","Ica","Junin","La Libertad","Lambayeque",
  "Lima","Loreto","Madre De Dios","Moquegua","Pasco","Piura","Puno",
  "San Martin","Tacna","Tumbes","Ucayali",
];

const STATUSES = [
  { value: "",          label: "Todos"      },
  { value: "active",    label: "Vigente"    },
  { value: "pending",   label: "En trámite" },
  { value: "expired",   label: "Caducada"   },
  { value: "suspended", label: "Suspendida" },
];

const STATUS_DOT: Record<string, string> = {
  active:    "bg-emerald-500",
  pending:   "bg-amber-400",
  expired:   "bg-red-400",
  suspended: "bg-slate-400",
};

const SUBSTANCE_TYPES = [
  { value: "",            label: "Todas",       color: "" },
  { value: "Metálica",    label: "Metálica",    color: "bg-amber-50  text-amber-700  border-amber-200"  },
  { value: "No metálica", label: "No metálica", color: "bg-sky-50    text-sky-700    border-sky-200"    },
  { value: "Energética",  label: "Energética",  color: "bg-orange-50 text-orange-700 border-orange-200" },
];

const SORT_OPTIONS = [
  { value: "name",                   label: "Nombre A→Z"   },
  { value: "name-desc",              label: "Nombre Z→A"   },
  { value: "area_hectares-desc",     label: "Mayor área"   },
  { value: "area_hectares",          label: "Menor área"   },
  { value: "registration_date-desc", label: "Más reciente" },
  { value: "registration_date",      label: "Más antigua"  },
];

const LIMIT = 50;

/* ── Helpers ────────────────────────────────────────────────────────────── */

function normalizeSubstance(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("no metálica") || t.includes("no metalífera") || t === "nm" || t === "n") return "No metálica";
  if (t.includes("metálica") || t.includes("metalífera") || t === "m") return "Metálica";
  if (t.includes("energética") || t === "e") return "Energética";
  return type;
}


function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

/* ── NLP search bar ─────────────────────────────────────────────────────── */
function NaturalSearchBar({ onApply, onSemantic }: {
  onApply:    (filters: Record<string, any>, interpreted: string[]) => void;
  onSemantic: (items: any[]) => void;
}) {
  const [nlq,     setNlq]     = useState("");
  const [loading, setLoading] = useState(false);
  const [interp,  setInterp]  = useState<string[]>([]);
  const [mode,    setMode]    = useState<"nlp" | "semantic">("nlp");

  const examples = mode === "nlp"
    ? ["metálicas en Cajamarca > 500 ha", "caducadas con deuda en Arequipa", "petitorios grandes en Puno"]
    : ["empresa minera de oro grande", "concesiones de cobre en sierra sur", "HOCHSCHILD tituladas"];

  const run = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      if (mode === "nlp") {
        const res = await api.get("/search/natural", { params: { q, limit: 200 } });
        setInterp(res.data.interpreted ?? []);
        onApply(res.data.filters ?? {}, res.data.interpreted ?? []);
      } else {
        const res = await api.get("/search/semantic", { params: { q, limit: 100, threshold: 0.3 } });
        setInterp([`${res.data.total} resultados`]);
        onSemantic(res.data.items ?? []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div className={`rounded-xl border p-4 ${mode === "semantic" ? "border-indigo-200 bg-indigo-50/40" : "border-violet-200 bg-violet-50/40"}`}>
      <div className="flex items-center gap-3 mb-3">
        <Sparkles size={13} className={mode === "semantic" ? "text-indigo-500" : "text-violet-500"} />
        <div className="flex rounded-lg border border-white/80 bg-white/70 p-0.5 gap-0.5">
          {(["nlp", "semantic"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setInterp([]); }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${mode === m
                ? m === "semantic" ? "bg-indigo-600 text-white shadow-sm" : "bg-violet-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"}`}>
              {m === "nlp" ? "📝 NLP" : "🧠 Semántica"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input value={nlq} onChange={(e) => setNlq(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(nlq)}
          placeholder={mode === "nlp" ? 'Ej: "metálicas en Cajamarca mayores a 500 ha"' : 'Ej: "empresa minera de oro grande"'}
          className={`flex-1 rounded-lg border bg-white px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 transition ${
            mode === "semantic" ? "border-indigo-200 focus:border-indigo-400 focus:ring-indigo-100" : "border-violet-200 focus:border-violet-400 focus:ring-violet-100"}`} />
        <button onClick={() => run(nlq)} disabled={loading || !nlq.trim()}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${mode === "semantic" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-violet-600 hover:bg-violet-700"}`}>
          {loading ? "…" : <><Sparkles size={13} /> Buscar</>}
        </button>
      </div>
      {interp.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          {interp.map((i) => (
            <span key={i} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${mode === "semantic" ? "bg-indigo-100 border-indigo-200 text-indigo-700" : "bg-violet-100 border-violet-200 text-violet-700"}`}>{i}</span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button key={ex} onClick={() => { setNlq(ex); run(ex); }}
            className={`rounded-full bg-white border px-2 py-0.5 text-[10px] transition ${mode === "semantic" ? "border-indigo-200 text-indigo-600 hover:bg-indigo-100" : "border-violet-200 text-violet-600 hover:bg-violet-100"}`}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function ExplorarPage() {
  const router = useRouter();
  const { search, setSearch, debouncedSearch } = useConcessionFilters();
  const [status,          setStatus]          = useState("");
  const [region,          setRegion]          = useState("");
  const [ctype,           setCtype]           = useState("");
  const [sort,            setSort]            = useState("name");
  const [page,            setPage]            = useState(1);
  const [showNLP,         setShowNLP]         = useState(false);
  const [nlpActive,       setNlpActive]       = useState(false);
  const [semanticResults, setSemanticResults] = useState<any[] | null>(null);

  const [sortBy, sortDir] = sort.includes("-desc") ? [sort.replace("-desc", ""), "desc"] : [sort, "asc"];
  const resetPage = () => setPage(1);

  const { data, isLoading } = useQuery({
    queryKey: ["concessions", debouncedSearch, status, region, ctype, sortBy, sortDir, page],
    queryFn: async () => (await api.get("/concessions", {
      params: { q: debouncedSearch || undefined, status: status || undefined, region: region || undefined, concession_type: ctype || undefined, sort_by: sortBy, sort_dir: sortDir, page, limit: LIMIT },
    })).data,
    placeholderData: (prev) => prev,
  });

  const { data: typeStats } = useQuery({
    queryKey: ["substance-types"],
    queryFn: async () => (await api.get("/concessions/substance-types")).data,
    staleTime: 1000 * 60 * 30,
  });

  const isSemantic = semanticResults !== null;
  const items  = isSemantic ? semanticResults : (data?.items ?? []);
  const total  = isSemantic ? semanticResults!.length : (data?.total ?? 0);
  const pages  = isSemantic ? 1 : (data?.pages ?? 1);
  const hasFilters = !!(status || region || ctype || debouncedSearch || nlpActive || isSemantic);

  const clearFilters = () => {
    setSearch(""); setStatus(""); setRegion(""); setCtype("");
    setNlpActive(false); setSemanticResults(null); resetPage();
  };

  const handleNLPApply = (filters: Record<string, any>, interpreted: string[]) => {
    setSemanticResults(null);
    if (filters.status)          setStatus(filters.status);
    if (filters.region)          setRegion(filters.region);
    if (filters.concession_type) setCtype(filters.concession_type);
    if (filters.q)               setSearch(filters.q);
    setNlpActive(true); resetPage();
  };

  return (
    <div className="flex flex-col gap-3 pb-6" style={{ height: "calc(100vh - 16px)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Explorar concesiones</h1>
          <p className="text-sm text-slate-500">
            {isLoading ? "Buscando…" : isSemantic
              ? `🧠 ${total} resultados semánticos`
              : `${total.toLocaleString("es-PE")} concesiones`}
          </p>
        </div>
        <button
          onClick={() => setShowNLP((v) => !v)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            showNLP || nlpActive ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <Sparkles size={15} /> Buscar con IA
        </button>
      </div>

      {/* ── IA search ──────────────────────────────────────────────────── */}
      {showNLP && (
        <NaturalSearchBar
          onApply={handleNLPApply}
          onSemantic={(r) => { setSemanticResults(r); setNlpActive(false); }}
        />
      )}

      {/* ── Search + sort + region ─────────────────────────────────────── */}
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

        <div className="relative">
          <select value={region} onChange={(e) => { setRegion(e.target.value); resetPage(); }}
            className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-primary-400">
            <option value="">Todas las regiones</option>
            {PERU_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative">
          <select value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }}
            className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-primary-400">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ArrowUpDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* ── Filter pills ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Status pills */}
        <div className="flex items-center gap-1">
          {STATUSES.map((s) => (
            <button key={s.value}
              onClick={() => { setStatus(s.value); resetPage(); }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                status === s.value
                  ? "border-primary-400 bg-primary-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
              {s.value && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s.value] ?? "bg-slate-400"}`} />}
              {s.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Substance pills */}
        <div className="flex items-center gap-1">
          {SUBSTANCE_TYPES.map((t) => {
            const stat = typeStats?.find((s: any) => s.type?.toLowerCase() === t.value.toLowerCase());
            const isActive = ctype === t.value;
            return (
              <button key={t.value || "all"}
                onClick={() => { setCtype(t.value); resetPage(); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? t.value ? `${t.color} ring-1 ring-offset-1 ring-current shadow-sm` : "border-primary-400 bg-primary-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                {t.label}
                {stat && <span className="ml-1 opacity-60">{stat.count.toLocaleString("es-PE")}</span>}
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <>
            <div className="h-4 w-px bg-slate-200" />
            <button onClick={clearFilters}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition">
              <X size={11} /> Limpiar
            </button>
          </>
        )}
      </div>

      {/* ── Semantic banner ────────────────────────────────────────────── */}
      {isSemantic && (
        <div className="shrink-0 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs">
          <span>🧠</span>
          <span className="font-semibold text-indigo-700">{total} resultados por similitud semántica</span>
          <button onClick={() => setSemanticResults(null)}
            className="ml-auto flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition">
            <X size={11} /> Volver
          </button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-[#dce8e6] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Titular</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Sustancia</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Región</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Área (ha)</th>
              {isSemantic && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Similitud</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: `${55 + (j * 11) % 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isSemantic ? 8 : 7} className="px-4 py-20 text-center">
                  <p className="text-slate-400 text-sm">Sin resultados</p>
                  {hasFilters && (
                    <button onClick={clearFilters} className="mt-2 text-xs text-primary-600 hover:underline">Limpiar filtros</button>
                  )}
                </td>
              </tr>
            ) : (
              items.map((c: any) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/explorar/${c.id}`)}
                  className="group cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  {/* Status stripe */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? "bg-slate-300"}`} />
                      <span className="font-mono text-xs font-semibold text-slate-600">{c.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-900 max-w-[200px] truncate">
                    <span className="group-hover:text-primary-700 transition-colors">{c.name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate text-xs">{c.holder_name || "—"}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3.5"><SubstanceBadgeComponent type={c.concession_type} /></td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[120px] truncate">{c.region || "—"}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-sm text-slate-700 font-medium">
                    {c.area_hectares != null ? Number(c.area_hectares).toLocaleString("es-PE", { maximumFractionDigits: 0 }) : "—"}
                  </td>
                  {isSemantic && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round((c.score ?? 0) * 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-indigo-600 font-semibold tabular-nums">{Math.round((c.score ?? 0) * 100)}%</span>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {isSemantic ? (
        <p className="shrink-0 text-center text-xs text-slate-400">
          Ordenado por similitud semántica ·{" "}
          <button onClick={() => setSemanticResults(null)} className="text-indigo-500 hover:underline">Volver a búsqueda normal</button>
        </p>
      ) : (
        <div className="flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)}</span>
            {" "}de{" "}
            <span className="font-medium text-slate-700">{total.toLocaleString("es-PE")}</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition">
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pages - 4));
              const p = start + i;
              return p <= pages ? (
                <button key={p} onClick={() => setPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                    p === page ? "bg-primary-700 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {p}
                </button>
              ) : null;
            })}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
