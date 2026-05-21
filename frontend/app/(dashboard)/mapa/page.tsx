"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const PeruMap = dynamic(() => import("@/components/maps/PeruMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-xl border border-[#dce8e6]">
      <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
      <p className="text-sm text-slate-500">Cargando mapa…</p>
    </div>
  ),
});

function MapaContent() {
  const params = useSearchParams();
  const initialCode = params.get("code") ?? undefined;
  const initialId   = params.get("id") ? Number(params.get("id")) : undefined;

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 16px)" }}>
      <div className="flex items-center justify-between pt-1 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Mapa de concesiones
          </h1>
          <p className="text-sm text-slate-500">
            {initialCode
              ? `Mostrando concesión ${initialCode}`
              : "Visualiza el catastro minero del Perú en tiempo real"}
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <PeruMap initialCode={initialCode} initialId={initialId} />
      </div>
    </div>
  );
}

export default function MapaPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
      </div>
    }>
      <MapaContent />
    </Suspense>
  );
}
