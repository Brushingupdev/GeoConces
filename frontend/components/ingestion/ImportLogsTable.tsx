import type { ImportLog } from "@/types/ingestion";

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function getStatus(log: ImportLog) {
  if (log.error_message) {
    return { label: "Error", className: "text-rose-700 bg-rose-50 border-rose-200" };
  }
  if (log.finished_at) {
    return { label: "Completo", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  }
  return { label: "En curso", className: "text-amber-700 bg-amber-50 border-amber-200" };
}

export default function ImportLogsTable({
  logs,
}: {
  logs: ImportLog[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="px-5 py-4 font-medium">Origen</th>
            <th className="px-5 py-4 font-medium">Tipo</th>
            <th className="px-5 py-4 font-medium">Procesados</th>
            <th className="px-5 py-4 font-medium">Creados</th>
            <th className="px-5 py-4 font-medium">Actualizados</th>
            <th className="px-5 py-4 font-medium">Estado</th>
            <th className="px-5 py-4 font-medium">Inicio</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td className="px-5 py-8 text-slate-500" colSpan={7}>
                Aún no hay importaciones registradas.
              </td>
            </tr>
          ) : (
            logs.map((log) => {
              const status = getStatus(log);
              return (
                <tr key={log.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-medium text-slate-900">{log.source || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{log.import_type || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{log.records_processed ?? "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{log.records_created ?? "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{log.records_updated ?? "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(log.started_at)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
