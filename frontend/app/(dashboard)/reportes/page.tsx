"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, FileSpreadsheet, FileText,
  Trash2, RefreshCw, Plus, Filter,
} from "lucide-react";

const PERU_REGIONS = [
  "Amazonas","Ancash","Apurimac","Arequipa","Ayacucho","Cajamarca",
  "Cusco","Huancavelica","Huanuco","Ica","Junin","La Libertad",
  "Lambayeque","Lima","Loreto","Madre De Dios","Moquegua","Pasco",
  "Piura","Puno","San Martin","Tacna","Tumbes","Ucayali",
];

const SCOPES = [
  { value: "all",           label: "Todas las concesiones",     desc: "Hasta 5,000 registros del catastro completo" },
  { value: "mine",          label: "Mis concesiones",           desc: "Solo los titulares que monitoreas" },
  { value: "opportunities", label: "Oportunidades",             desc: "Ordenadas por score de oportunidad" },
];

const FORMATS = [
  { value: "xlsx", label: "Excel (.xlsx)", Icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "pdf",  label: "PDF",           Icon: FileText,        color: "text-red-600 bg-red-50 border-red-200" },
];

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ReportesPage() {
  const qc = useQueryClient();
  const [scope,  setScope]  = useState("all");
  const [format, setFormat] = useState("xlsx");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  const { data: reports, isLoading } = useQuery<any[]>({
    queryKey: ["reports"],
    queryFn: async () => (await api.get("/reports")).data,
  });

  const generate = useMutation({
    mutationFn: async () => (await api.post("/reports", {
      report_type: "concessions",
      format,
      scope,
      region:  region  || undefined,
      status:  status  || undefined,
    })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: number) => api.delete(`/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });

  const handleDownload = async (report: any) => {
    setDownloading(report.id);
    try {
      const res = await api.get(`/reports/${report.id}/download`, { responseType: "blob" });
      const ext  = report.report_type.endsWith("xlsx") ? "xlsx" : "pdf";
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `geoconces_reporte_${report.id}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const selectedScope  = SCOPES.find((s) => s.value === scope);
  const selectedFormat = FORMATS.find((f) => f.value === format);

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-4xl">

      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Reportes y exportaciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Exporta concesiones a Excel o PDF con los filtros que necesites.
        </p>
      </div>

      {/* Generador */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo reporte</h2>

        {/* Alcance */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Alcance</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={`rounded-lg border p-3 text-left transition ${
                  scope === s.value
                    ? "border-primary-400 bg-primary-50 ring-1 ring-primary-300"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Formato */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Formato</label>
          <div className="flex gap-3">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                  format === f.value ? f.color + " ring-1" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <f.Icon size={15} /> {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros opcionales */}
        <div className="mb-5">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
          >
            <Filter size={12} />
            Filtros opcionales
            {showFilters ? " ▲" : " ▼"}
          </button>
          {showFilters && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Región</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-6 text-sm text-slate-700 outline-none focus:border-primary-400"
                >
                  <option value="">Todas las regiones</option>
                  {PERU_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estado</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-6 text-sm text-slate-700 outline-none focus:border-primary-400"
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Vigente</option>
                  <option value="expired">Caducada</option>
                  <option value="pending">En trámite</option>
                  <option value="suspended">Suspendida</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Botón generar */}
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition disabled:opacity-60"
        >
          {generate.isPending ? (
            <><RefreshCw size={15} className="animate-spin" /> Generando…</>
          ) : (
            <><Plus size={15} /> Generar {selectedFormat?.label} · {selectedScope?.label}</>
          )}
        </button>
      </div>

      {/* Historial */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Reportes generados</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando…</div>
        ) : !reports?.length ? (
          <div className="p-10 text-center">
            <FileSpreadsheet size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Sin reportes aún. Genera el primero arriba.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Tipo", "Filtros", "Generado", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r: any) => {
                const isXlsx = r.report_type?.includes("xlsx");
                const Icon = isXlsx ? FileSpreadsheet : FileText;
                const color = isXlsx ? "text-emerald-600" : "text-red-500";
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={color} />
                        <span className="font-medium text-slate-800 capitalize">
                          {r.report_type?.replace("_", " ") ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {r.filters?.scope && <span className="mr-2 capitalize">{r.filters.scope}</span>}
                      {r.filters?.region && <span className="mr-2">{r.filters.region}</span>}
                      {r.filters?.status && <span>{r.filters.status}</span>}
                      {!r.filters?.scope && "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {fmt(r.generated_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleDownload(r)}
                          disabled={downloading === r.id}
                          className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition disabled:opacity-50"
                        >
                          {downloading === r.id
                            ? <><RefreshCw size={12} className="animate-spin" /> Descargando…</>
                            : <><Download size={12} /> Descargar</>}
                        </button>
                        <button
                          onClick={() => deleteReport.mutate(r.id)}
                          disabled={deleteReport.isPending}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition"
                          title="Eliminar reporte"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
