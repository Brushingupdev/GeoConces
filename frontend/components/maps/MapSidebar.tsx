"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  X,
  Search,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

// ── 25 regiones del Perú ─────────────────────────────────────────────────────
const PERU_REGIONS = [
  "Amazonas", "Ancash", "Apurimac", "Arequipa", "Ayacucho",
  "Cajamarca", "Callao", "Cusco", "Huancavelica", "Huanuco",
  "Ica", "Junin", "La Libertad", "Lambayeque", "Lima",
  "Loreto", "Madre De Dios", "Moquegua", "Pasco", "Piura",
  "Puno", "San Martin", "Tacna", "Tumbes", "Ucayali",
];

const STATUSES = [
  { value: "active",    label: "Activa",      color: "bg-green-500" },
  { value: "pending",   label: "En trámite",  color: "bg-amber-500" },
  { value: "expired",   label: "Vencida",     color: "bg-red-500" },
  { value: "suspended", label: "Suspendida",  color: "bg-slate-400" },
];

const TYPES = [
  { value: "Metálica",                label: "Metálica" },
  { value: "No metálica",             label: "No metálica" },
  { value: "Metálica y no metálica",  label: "Metálica y NM" },
  { value: "Energética",              label: "Energética" },
];

export interface MapFiltersState {
  q: string;
  statuses: string[];   // [] = todos
  region: string;       // "" = todos
  concessionType: string; // "" = todos
  areaMin: string;
  areaMax: string;
}

export const DEFAULT_FILTERS: MapFiltersState = {
  q: "",
  statuses: [],
  region: "",
  concessionType: "",
  areaMin: "",
  areaMax: "",
};

interface Props {
  filters: MapFiltersState;
  onChange: (f: MapFiltersState) => void;
  count: number;
  capped: boolean;
  loading: boolean;
}

export default function MapSidebar({ filters, onChange, count, capped, loading }: Props) {
  const [open, setOpen] = useState(true);

  const set = (patch: Partial<MapFiltersState>) =>
    onChange({ ...filters, ...patch });

  const toggleStatus = (val: string) => {
    const next = filters.statuses.includes(val)
      ? filters.statuses.filter((s) => s !== val)
      : [...filters.statuses, val];
    set({ statuses: next });
  };

  const isDirty =
    filters.q ||
    filters.statuses.length > 0 ||
    filters.region ||
    filters.concessionType ||
    filters.areaMin ||
    filters.areaMax;

  return (
    <>
      {/* ── Toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`absolute right-3 top-3 z-[600] flex h-9 w-9 items-center justify-center rounded-lg shadow-md transition-all ${
          open
            ? "bg-primary-700 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        } border border-[#dce8e6]`}
        title={open ? "Cerrar filtros" : "Abrir filtros"}
      >
        {open ? <X size={16} /> : <SlidersHorizontal size={16} />}
      </button>

      {/* ── Sidebar panel ── */}
      <div
        className={`absolute right-0 top-0 z-[500] h-full w-72 transform bg-white shadow-[-4px_0_24px_rgba(15,23,42,0.10)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dce8e6] px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-primary-600" />
            <span className="text-sm font-semibold text-slate-800">Filtros</span>
          </div>
          {isDirty && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <RotateCcw size={11} />
              Limpiar
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex h-[calc(100%-100px)] flex-col gap-5 overflow-y-auto px-4 py-4">

          {/* Search */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Buscar
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={filters.q}
                onChange={(e) => set({ q: e.target.value })}
                placeholder="Código, nombre o titular…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </section>

          {/* Estado */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Estado
            </label>
            <div className="space-y-2">
              {STATUSES.map((s) => {
                const checked = filters.statuses.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleStatus(s.value)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                      checked
                        ? "border-primary-300 bg-primary-50 text-primary-800"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${s.color}`} />
                    <span className="flex-1 text-left font-medium">{s.label}</span>
                    {checked && (
                      <span className="h-4 w-4 flex items-center justify-center rounded-full bg-primary-600 text-white">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Región */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Región
            </label>
            <div className="relative">
              <select
                value={filters.region}
                onChange={(e) => set({ region: e.target.value })}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">Todas las regiones</option>
                {PERU_REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </section>

          {/* Tipo de sustancia */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tipo de sustancia
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[{ value: "", label: "Todas" }, ...TYPES].map((t) => (
                <button
                  key={t.value}
                  onClick={() => set({ concessionType: t.value })}
                  className={`rounded-lg border py-2 text-xs font-medium transition ${
                    filters.concessionType === t.value
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* Área (ha) */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Área (hectáreas)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filters.areaMin}
                onChange={(e) => set({ areaMin: e.target.value })}
                placeholder="Mín"
                min={0}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <span className="text-xs text-slate-400">—</span>
              <input
                type="number"
                value={filters.areaMax}
                onChange={(e) => set({ areaMax: e.target.value })}
                placeholder="Máx"
                min={0}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </section>
        </div>

        {/* Footer — count */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#dce8e6] bg-white px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Buscando…
            </div>
          ) : (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {count.toLocaleString("es-PE")}
              </span>{" "}
              concesiones en vista
              {capped && (
                <span className="ml-1 text-amber-600 font-medium">· zoom para ver más</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
