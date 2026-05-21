"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, DatabaseZap, Loader2 } from "lucide-react";
import SectionHeader from "@/components/common/SectionHeader";
import ImportDropzone from "@/components/ingestion/ImportDropzone";
import ImportSummary from "@/components/ingestion/ImportSummary";
import ImportLogsTable from "@/components/ingestion/ImportLogsTable";
import { api } from "@/lib/api";
import type { ImportLog, IngestionResult } from "@/types/ingestion";

export default function ImportacionesPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("manual_file");
  const [importType, setImportType] = useState("manual_file");
  const [result, setResult] = useState<IngestionResult | null>(null);

  const { data: logs = [] } = useQuery<ImportLog[]>({
    queryKey: ["ingestion-logs"],
    queryFn: async () => (await api.get("/ingestion/logs")).data,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Selecciona un archivo antes de importar.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/ingestion/concessions/upload", formData, {
        params: {
          source,
          import_type: importType,
        },
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data as IngestionResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["ingestion-logs"] });
    },
  });

  const latestLog = useMemo(() => logs[0] || null, [logs]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Importaciones"
        description="Carga archivos operativos hacia la base normalizada y revisa la actividad reciente de ingestión."
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <section className="space-y-6">
          <ImportDropzone file={file} onFileChange={setFile} />

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Source
              </p>
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="mt-3 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                placeholder="manual_file"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Import type
              </p>
              <input
                value={importType}
                onChange={(event) => setImportType(event.target.value)}
                className="mt-3 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                placeholder="manual_file"
              />
            </label>

            <button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !file}
              className="inline-flex h-full min-h-[76px] items-center justify-center gap-2 rounded-2xl bg-primary-700 px-5 text-sm font-semibold text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importando
                </>
              ) : (
                <>
                  Ejecutar importación
                  <ArrowUpRight size={16} />
                </>
              )}
            </button>
          </div>

          {uploadMutation.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {uploadMutation.error instanceof Error
                ? uploadMutation.error.message
                : "No se pudo completar la importación."}
            </div>
          ) : null}

          <ImportSummary result={result} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Logs recientes
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Historial de cargas ejecutadas desde la app y scripts operativos.
                </p>
              </div>
            </div>
            <ImportLogsTable logs={logs} />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-[#123c3a] p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <DatabaseZap size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">
                  Pipeline activo
                </p>
                <h2 className="mt-1 text-xl font-semibold">Base propia primero</h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/72">
              Cada importación alimenta concesiones, geometrías y eventos para que luego puedas buscar, alertar, puntuar y reportar sin depender de consultas en vivo.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Última ejecución
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              {latestLog?.source || "Sin actividad reciente"}
            </p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-slate-500">Tipo</dt>
                <dd className="font-medium text-slate-900">{latestLog?.import_type || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-slate-500">Procesados</dt>
                <dd className="font-medium text-slate-900">
                  {latestLog?.records_processed ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Inicio</dt>
                <dd className="font-medium text-slate-900">
                  {latestLog?.started_at
                    ? new Date(latestLog.started_at).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
