"use client";

import { FileArchive, FileSpreadsheet, FileJson2, UploadCloud } from "lucide-react";

const acceptedFormats = [
  { label: "CSV", icon: FileSpreadsheet },
  { label: "XLSX", icon: FileSpreadsheet },
  { label: "GeoJSON", icon: FileJson2 },
  { label: "ZIP shapefile", icon: FileArchive },
];

export default function ImportDropzone({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <label className="group block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 transition hover:border-primary-500 hover:bg-white">
      <input
        type="file"
        accept=".csv,.xlsx,.geojson,.json,.zip"
        className="hidden"
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
      />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <UploadCloud size={22} />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Importar concesiones desde archivo
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Carga datos normalizados o crudos para llevarlos a la base propia de GeoConces y disparar eventos, historial y búsqueda.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {acceptedFormats.map((format) => (
              <div
                key={format.label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                <format.icon size={14} />
                {format.label}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-[240px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Archivo seleccionado
          </p>
          <p className="mt-3 font-medium text-slate-900">
            {file?.name || "Ninguno aún"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {file
              ? `${Math.round(file.size / 1024)} KB`
              : "Haz clic para elegir o reemplazar un archivo"}
          </p>
        </div>
      </div>
    </label>
  );
}
