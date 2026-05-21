"use client";

import { Search } from "lucide-react";

export default function MapFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-xl border border-[#dce8e6] bg-white/97 px-3 py-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.10)] backdrop-blur">
      {/* Search */}
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Código o nombre…"
          className="w-52 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-200" />

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-7 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      >
        <option value="all">Todos</option>
        <option value="active">Activas</option>
        <option value="pending">En trámite</option>
        <option value="expired">Vencidas</option>
        <option value="suspended">Suspendidas</option>
      </select>

      {/* Legend */}
      <div className="h-6 w-px bg-slate-200" />
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />Activa
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Trámite
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />Vencida
        </span>
      </div>
    </div>
  );
}
