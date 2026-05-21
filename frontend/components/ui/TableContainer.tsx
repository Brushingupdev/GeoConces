import type { ReactNode } from "react";

/** Consistent wrapper for all data tables across the app. */
export default function TableContainer({
  headers,
  children,
  isLoading,
  isEmpty,
  emptyMessage = "No hay datos para mostrar.",
  colSpan,
}: {
  headers: string[];
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  colSpan?: number;
}) {
  const span = colSpan ?? headers.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td className="px-6 py-8 text-slate-400" colSpan={span}>
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600" />
                  Cargando…
                </span>
              </td>
            </tr>
          ) : isEmpty ? (
            <tr>
              <td className="px-6 py-8 text-slate-500" colSpan={span}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
