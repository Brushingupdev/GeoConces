"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Calendar, Hash, Layers, MapPin, User,
  AlertTriangle, Map, Bookmark, BookmarkCheck, ChevronRight,
  DollarSign, RefreshCw, ShieldCheck, ShieldAlert, FileText,
  AlertCircle, Mail, Fingerprint, Link2, Clock, Zap,
  CheckCircle2, XCircle, TrendingDown, ScanLine,
  ExternalLink, Eye, EyeOff, Download,
} from "lucide-react";
import SubstanceBadge from "@/components/ui/SubstanceBadge";
import { useState, useEffect, useRef } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "Vigente", expired: "Caducada", pending: "En trámite", suspended: "Suspendida",
};
const STATUS_STYLES: Record<string, string> = {
  active:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  expired:   "border-red-200 bg-red-50 text-red-700",
  pending:   "border-amber-200 bg-amber-50 text-amber-700",
  suspended: "border-slate-200 bg-slate-100 text-slate-600",
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-800 text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

// Versión inline (una línea) para el metrics strip del hero
function TitleDateInline({ titleDate, concessionId }: { titleDate?: string | null; concessionId: number }) {
  const { data: sidemcat } = useQuery({
    queryKey: ["sidemcat", concessionId],
    enabled: !titleDate,
    queryFn: async () => (await api.get(`/concessions/${concessionId}/sidemcat`)).data,
    staleTime: 1000 * 60 * 60 * 6,
  });
  if (titleDate) return <>{fmt(titleDate)}</>;
  if (sidemcat?.is_titled) return <span className="text-slate-500">Confirmada</span>;
  return <span className="text-slate-400">—</span>;
}

function TitleDateRow({ titleDate, concessionId }: { titleDate?: string | null; concessionId: number }) {
  const { data: sidemcat } = useQuery({
    queryKey: ["sidemcat", concessionId],
    enabled: !titleDate, // solo consultar si aún no tenemos la fecha
    queryFn: async () => (await api.get(`/concessions/${concessionId}/sidemcat`)).data,
    staleTime: 1000 * 60 * 60 * 6,
  });

  if (titleDate) {
    return <DetailRow label="Titulación" value={fmt(titleDate)} />;
  }
  if (sidemcat?.is_titled) {
    return (
      <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100">
        <span className="text-xs text-slate-500 shrink-0">Titulación</span>
        <span className="text-xs font-medium text-slate-500 text-right">
          Confirmada · fecha no en sistema
        </span>
      </div>
    );
  }
  return <DetailRow label="Titulación" value={null} />;
}

function SkeletonRow() {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
      <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
    </div>
  );
}

function AddToWatchlistButton({ concessionId }: { concessionId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: watchlists } = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => (await api.get("/watchlists")).data,
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async (wlId: number) =>
      api.post(`/watchlists/${wlId}/items`, { concession_id: concessionId }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["watchlists"] }); },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition"
      >
        <Bookmark size={14} /> Guardar
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          {!watchlists?.length ? (
            <div className="px-4 py-3 text-xs text-slate-500">
              No tienes listas aún.{" "}
              <Link href="/watchlist" className="text-primary-600 hover:underline">Crear lista →</Link>
            </div>
          ) : (
            watchlists.map((wl: any) => (
              <button
                key={wl.id}
                onClick={() => add.mutate(wl.id)}
                disabled={add.isPending}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                <BookmarkCheck size={14} className="text-primary-500 shrink-0" />
                {wl.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Expediente PDF Viewer ─────────────────────────────────────────────────────
type PdfState = "checking" | "idle" | "building" | "ready" | "error";

function ExpedientePdfSection({ concessionId, numPages }: {
  concessionId: number;
  numPages?: number | null;
}) {
  const [state,      setState]      = useState<PdfState>("checking");
  const [blobUrl,    setBlobUrl]    = useState<string | null>(null);
  const [showInline, setShowInline] = useState(false);
  const [pollCount,  setPollCount]  = useState(0);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get(`/concessions/${concessionId}/expediente/pdf?status=true`)
      .then((res) => setState(res.data?.ready ? "ready" : "idle"))
      .catch(() => setState("idle"));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [concessionId]);

  // Revocar blob URL al desmontar para no acumular memoria
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  const startPolling = () => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      setPollCount(attempts);
      try {
        const res = await api.get(`/concessions/${concessionId}/expediente/pdf?status=true`);
        if (res.data?.ready) {
          clearInterval(pollRef.current!);
          setState("ready");
        }
      } catch {}
      if (attempts >= 150) {
        clearInterval(pollRef.current!);
        setErrorMsg("Tiempo de espera agotado. Intenta de nuevo.");
        setState("error");
      }
    }, 2000);
  };

  const handleBuild = async () => {
    setState("building");
    setPollCount(0);
    try {
      const res = await api.post(`/concessions/${concessionId}/expediente/pdf`);
      if (res.data?.ready) {
        setState("ready");
      } else if (res.data?.queued) {
        startPolling();
      } else {
        setErrorMsg(res.data?.detail ?? "No se pudo iniciar la generación.");
        setState("error");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail ?? "Error al generar el PDF.");
      setState("error");
    }
  };

  const fetchBlob = async (): Promise<string | null> => {
    try {
      const res = await api.get(`/concessions/${concessionId}/expediente/pdf`, {
        responseType: "blob",
      });
      return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    } catch {
      setErrorMsg("Error al obtener el PDF.");
      return null;
    }
  };

  const handleOpenTab = async () => {
    const url = await fetchBlob();
    if (url) window.open(url, "_blank");
  };

  const handleToggleInline = async () => {
    if (showInline) { setShowInline(false); return; }
    const url = blobUrl ?? await fetchBlob();
    if (url) { setBlobUrl(url); setShowInline(true); }
  };

  const estSecs = numPages ? Math.ceil(numPages * 0.15) : null;

  if (state === "checking") return null;

  if (state === "idle") return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={handleBuild}
        className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 transition"
      >
        <Download size={12} />
        Generar PDF completo{numPages ? ` · ${numPages} págs` : ""}
      </button>
      {estSecs && (
        <p className="mt-0.5 text-[10px] text-slate-400">
          Primera vez ~{estSecs < 60 ? `${estSecs}s` : `${Math.ceil(estSecs / 60)}min`} · Luego instantáneo
        </p>
      )}
    </div>
  );

  if (state === "building") {
    const elapsed = pollCount * 2;
    const remaining = estSecs ? Math.max(0, estSecs - elapsed) : null;
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-primary-600">
        <div className="h-3 w-3 shrink-0 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
        <span>
          Generando PDF…
          {remaining != null && (
            <span className="ml-1 text-slate-400">
              ~{remaining < 60 ? `${remaining}s` : `${Math.ceil(remaining / 60)}min`} restantes
            </span>
          )}
        </span>
      </div>
    );
  }

  if (state === "error") return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-xs text-red-500">{errorMsg}</p>
      <button
        onClick={() => { setErrorMsg(null); setState("idle"); }}
        className="mt-1 text-[10px] text-slate-400 hover:text-slate-600 transition"
      >
        Reintentar
      </button>
    </div>
  );

  // ready
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-4">
        <button
          onClick={handleOpenTab}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900 transition"
        >
          <ExternalLink size={12} /> Abrir PDF
        </button>
        <button
          onClick={handleToggleInline}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
        >
          {showInline ? <EyeOff size={12} /> : <Eye size={12} />}
          {showInline ? "Ocultar" : "Ver aquí"}
        </button>
      </div>
      {showInline && blobUrl && (
        <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden" style={{ height: 640 }}>
          <iframe src={blobUrl} className="w-full h-full" title="Expediente PDF" />
        </div>
      )}
    </div>
  );
}

// ── SIDEMCAT auto-fetch section ───────────────────────────────────────────────
function SidemcatSection({
  concessionId,
  code,
  concessionQueryKey,
}: {
  concessionId: number;
  code: string;
  concessionQueryKey: string; // id string from useParams, to invalidate parent query
}) {
  const qc = useQueryClient();

  // Se activa automáticamente al montar el componente
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sidemcat", concessionId],
    queryFn: async () => (await api.get(`/concessions/${concessionId}/sidemcat`)).data,
    staleTime: 1000 * 60 * 60 * 6, // 6h — no refetch si ya está en caché de React Query
    retry: 1,
  });

  // Cuando SIDEMCAT tiene title_date (sea caché o fresco), invalidar la concesión
  // para que el card de Fechas se actualice con el valor guardado en DB.
  useEffect(() => {
    if (data?.title_date) {
      qc.invalidateQueries({ queryKey: ["concession", concessionQueryKey] });
    }
  }, [data?.title_date, concessionQueryKey, qc]);

  const refresh = async () => {
    await api.get(`/concessions/${concessionId}/sidemcat?refresh=true`);
    qc.invalidateQueries({ queryKey: ["sidemcat", concessionId] });
    qc.invalidateQueries({ queryKey: ["concession", concessionQueryKey] });
  };

  // ── Skeleton de carga ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-slate-400">
          <RefreshCw size={14} className="animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wide">Consultando SIDEMCAT…</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-2.5 w-16 rounded bg-slate-100 animate-pulse mb-1.5" />
              <div className="h-3.5 w-24 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-100 p-3 space-y-2">
          {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error / no encontrado ──────────────────────────────────────────────────
  if (isError || !data?.found) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          <AlertCircle size={14} />
          <h2 className="text-xs font-semibold uppercase tracking-wide">SIDEMCAT</h2>
        </div>
        <p className="text-xs text-slate-400">No se encontró información en SIDEMCAT para <span className="font-mono">{code}</span>.</p>
      </div>
    );
  }

  const vigencias: any[]   = data.vigencias   ?? [];
  const penalidades: any[] = data.penalidades  ?? [];
  const resoluciones: any[] = data.resoluciones ?? [];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-slate-500">
        <DollarSign size={14} />
        <h2 className="text-xs font-semibold uppercase tracking-wide">SIDEMCAT</h2>
        {data.cached && (
          <span className="text-[10px] text-slate-400">
            · guardado {new Date(data.fetched_at).toLocaleDateString("es-PE")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {data.has_debt && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              <ShieldAlert size={9} /> Deuda vigencia
            </span>
          )}
          {!data.has_debt && vigencias.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              <ShieldCheck size={9} /> Al día
            </span>
          )}
          <button
            onClick={refresh}
            className="text-slate-400 hover:text-slate-600 transition p-0.5 rounded"
            title="Actualizar desde SIDEMCAT"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Estado grid */}
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
        <div>
          <span className="text-slate-400 block">Estado SIDEMCAT</span>
          <p className="font-semibold text-slate-800 mt-0.5">{data.sidemcat_status ?? "—"}</p>
        </div>
        <div>
          <span className="text-slate-400 block">Estado detallado</span>
          <p className="font-semibold text-slate-800 mt-0.5">{data.estado_detail ?? "—"}</p>
        </div>
        <div>
          <span className="text-slate-400 block">Tipo expediente</span>
          <p className="font-medium text-slate-700 mt-0.5">{data.tipo ?? "—"}</p>
        </div>
        <div>
          <span className="text-slate-400 block">Medida cautelar</span>
          <p className={`font-medium mt-0.5 ${data.medida_cautelar ? "text-amber-700" : "text-slate-500"}`}>
            {data.medida_cautelar || "No"}
          </p>
        </div>
        {data.nro_titulares != null && (
          <div>
            <span className="text-slate-400 block">N° de titulares</span>
            <p className="font-medium text-slate-700 mt-0.5">{data.nro_titulares}</p>
          </div>
        )}
        {data.porcentaje != null && (
          <div>
            <span className="text-slate-400 block">Participación</span>
            <p className="font-medium text-slate-700 mt-0.5">{data.porcentaje}%</p>
          </div>
        )}
        {data.title_date ? (
          <div className="col-span-2">
            <span className="text-slate-400 block">Fecha de titulación</span>
            <p className="font-semibold text-emerald-700 mt-0.5">{fmt(data.title_date)}</p>
          </div>
        ) : data.is_titled ? (
          <div className="col-span-2">
            <span className="text-slate-400 block">Titulación</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirmada — fecha exacta no disponible en SIDEMCAT
            </p>
          </div>
        ) : null}
        {data.has_pdf && (
          <div className="col-span-2">
            <div className="flex items-center gap-1.5 text-primary-600">
              <FileText size={12} />
              <span className="text-xs font-medium">
                Expediente digitalizado · {data.pdf_num_paginas} páginas
              </span>
            </div>
            <ExpedientePdfSection
              concessionId={concessionId}
              numPages={data.pdf_num_paginas}
            />
          </div>
        )}
      </div>

      {/* Vigencia table */}
      {vigencias.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Derechos de vigencia</p>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {["Año", "Área (ha)", "Deuda", "Pagado", "Saldo"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vigencias.map((v: any) => (
                  <tr key={v.year} className="border-t border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-3 py-2 font-medium text-slate-800">{v.year}</td>
                    <td className="px-3 py-2 text-slate-600">{v.ha}</td>
                    <td className="px-3 py-2 text-slate-600">{v.owed || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{v.paid || "—"}</td>
                    <td className={`px-3 py-2 font-semibold ${
                      v.balance?.includes("-") ? "text-red-600" : "text-emerald-600"
                    }`}>
                      {v.balance || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Penalidades */}
      {penalidades.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Penalidades</p>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {["Año", "Deuda", "Pagado", "Saldo"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {penalidades.map((p: any) => (
                  <tr key={p.year} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{p.year}</td>
                    <td className="px-3 py-2 text-slate-600">{p.owed ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{p.paid ?? "—"}</td>
                    <td className={`px-3 py-2 font-semibold ${
                      p.balance && String(p.balance).includes("-") ? "text-red-600" : "text-emerald-600"
                    }`}>
                      {p.balance ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resoluciones */}
      {resoluciones.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Resoluciones ({resoluciones.length})</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {resoluciones.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-700">{r.descripcion ?? "—"}</p>
                  <p className="text-slate-400 mt-0.5">
                    {r.numero && <span className="font-mono">{r.numero} · </span>}
                    {r.fecha ?? "sin fecha"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SERFOR */}
      {data.serfor && Object.keys(data.serfor).length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-700 mb-1">Opinión SERFOR</p>
          <p className="text-xs text-amber-800">
            {data.serfor.opinion ?? data.serfor.desSer ?? JSON.stringify(data.serfor)}
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Fuente: SIDEMCAT — INGEMMET · {data.cached ? "Datos en caché" : "Datos en tiempo real"}
      </p>
    </div>
  );
}

// ── Risk score visual ─────────────────────────────────────────────────────────
function RiskGauge({ score, level }: { score: number; level: string }) {
  const color =
    score >= 50 ? "text-red-600 bg-red-50 border-red-200" :
    score >= 20 ? "text-amber-600 bg-amber-50 border-amber-200" :
                  "text-emerald-600 bg-emerald-50 border-emerald-200";
  const bar =
    score >= 50 ? "bg-red-400" :
    score >= 20 ? "bg-amber-400" :
                  "bg-emerald-400";
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-xs font-bold ${color}`}>
        <span className="text-lg leading-none">{score}</span>
        <span className="text-[9px] opacity-70">/ 100</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">Riesgo {level}</p>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
          <div className={`h-1.5 rounded-full transition-all ${bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Expediente Pro section ────────────────────────────────────────────────────
type ExpedienteState = "checking" | "idle" | "loading" | "done" | "unavailable";

function ExpedienteSection({ concessionId, hasPdf }: {
  concessionId: number;
  hasPdf: boolean;
}) {
  const [state,    setState]    = useState<ExpedienteState>("checking");
  const [data,     setData]     = useState<any>(null);
  const [fullScan, setFullScan] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    stage: string; message: string; page: number; total: number;
  } | null>(null);

  // Al montar: verificar caché en <100ms sin correr OCR
  useEffect(() => {
    if (!hasPdf) { setState("unavailable"); return; }
    api.get(`/concessions/${concessionId}/expediente?check_only=true`)
      .then((res) => {
        if (res.data?.found) {
          setData(res.data);
          setState("done");
        } else {
          setState("idle"); // sin caché → mostrar botón
        }
      })
      .catch(() => setState("idle"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concessionId]);

  const pollForResult = (taskId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 120 × 1.5s = 3 minutos máx
    setProgress({ stage: "queued", message: "Iniciando análisis…", page: 0, total: 0 });

    const interval = setInterval(async () => {
      attempts++;
      try {
        // Polling de progreso en tiempo real (Redis)
        const progRes = await api.get(`/concessions/${concessionId}/expediente/progress`);
        if (progRes.data?.stage) {
          setProgress(progRes.data);
        }

        // Verificar si ya terminó (guardado en DB)
        if (progRes.data?.stage === "done" || progRes.data?.stage === "error") {
          const res = await api.get(`/concessions/${concessionId}/expediente?check_only=true`);
          if (res.data?.found) {
            clearInterval(interval);
            setProgress(null);
            setData(res.data);
            setState("done");
            return;
          }
          if (progRes.data?.stage === "error") {
            clearInterval(interval);
            setErrorMsg(progRes.data.message || "Error en la extracción.");
            setState("idle");
            return;
          }
        }

        // Verificar el estado del task Celery
        const taskRes = await api.get(`/jobs/tasks/${taskId}`);
        if (taskRes.data?.status === "FAILURE") {
          clearInterval(interval);
          setProgress(null);
          setErrorMsg("Error en la extracción. Intenta nuevamente.");
          setState("idle");
          return;
        }
      } catch { /* ignorar errores de red en el polling */ }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setProgress(null);
        setErrorMsg("Tiempo de espera agotado. Intenta nuevamente.");
        setState("idle");
      }
    }, 1500);
  };

  const handleAnalyze = async (full = false) => {
    setState("loading");
    setFullScan(full);
    try {
      const url = full
        ? `/concessions/${concessionId}/expediente?full_scan=true`
        : `/concessions/${concessionId}/expediente`;
      const res = await api.get(url);

      if (res.data?.found) {
        // Datos en caché — mostrar directo
        setData(res.data);
        setState("done");
      } else if (res.data?.queued && res.data?.task_id) {
        // Encolado en Celery — hacer polling cada 3s
        pollForResult(res.data.task_id);
      } else {
        setErrorMsg(res.data?.reason ?? "Sin expediente digitalizado.");
        setState("unavailable");
      }
    } catch {
      setErrorMsg("Error de conexión. Intenta nuevamente.");
      setState("idle");
    }
  };

  const handleRefreshFull = async () => {
    setState("loading");
    setFullScan(true);
    try {
      const res = await api.get(
        `/concessions/${concessionId}/expediente?refresh=true&full_scan=true`
      );
      if (res.data?.queued && res.data?.task_id) {
        pollForResult(res.data.task_id);
      } else if (res.data?.found) {
        setData(res.data);
        setState("done");
      }
    } catch {
      setState("done"); // volver al estado anterior si falla
    }
  };

  // ── Sin PDF / no disponible ────────────────────────────────────────────────
  if (!hasPdf || state === "unavailable") return errorMsg ? (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <FileText size={13} className="text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Análisis de Expediente</span>
        <span className="rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 text-[10px] font-bold">PRO</span>
      </div>
      <p className="text-xs text-slate-400">{errorMsg}</p>
    </div>
  ) : null;

  // ── Verificando caché (muy breve) ─────────────────────────────────────────
  if (state === "checking") return null;

  // ── Sin caché → botón de análisis ─────────────────────────────────────────
  if (state === "idle") return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-violet-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Análisis de Expediente</h2>
          <span className="rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 text-[10px] font-bold">PRO</span>
        </div>
        <button
          onClick={() => handleAnalyze(false)}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
        >
          <ScanLine size={12} /> Analizar expediente
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Extrae email, DNI, fechas, colindantes y score de riesgo del expediente digitalizado de INGEMMET (~25s).{" "}
        <span className="text-violet-500 font-medium">Se guarda permanentemente.</span>
      </p>
    </div>
  );

  // ── OCR en curso ──────────────────────────────────────────────────────────
  if (state === "loading") {
    const pct = progress?.total
      ? Math.round((progress.page / progress.total) * 100)
      : 0;
    const stage = progress?.stage ?? "queued";
    const steps = [
      { key: "queued",      label: "Iniciando análisis…" },
      { key: "detecting",   label: "Detectando páginas del expediente" },
      { key: "downloading", label: "Descargando páginas de INGEMMET" },
      { key: "analyzing",   label: "Analizando con Gemini 2.0 Flash" },
      { key: "saving",      label: "Guardando resultados en base de datos" },
      { key: "done",        label: "Análisis completado" },
    ];
    const stageOrder = ["queued","detecting","downloading","analyzing","saving","done"];
    const currentIdx = stageOrder.indexOf(stage) === -1 ? 0 : stageOrder.indexOf(stage);

    return (
      <div className="mt-4 rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ScanLine size={14} className="animate-pulse text-violet-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            Analizando expediente completo…
          </span>
          <span className="ml-auto text-[10px] rounded-full bg-violet-100 text-violet-600 border border-violet-200 px-2 py-0.5 font-semibold">PRO</span>
        </div>

        {/* Mensaje de progreso */}
        {progress?.message && (
          <p className="mb-3 text-xs text-violet-700 font-medium">{progress.message}</p>
        )}

        {/* Barra de progreso real */}
        <div className="mb-4">
          {(progress?.total ?? 0) > 0 ? (
            <>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Página {progress?.page} de {progress?.total}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-violet-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="h-2 w-full rounded-full bg-violet-100 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-violet-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* Steps con estado real */}
        <div className="space-y-2">
          {steps.map((step, i) => {
            const stepIdx = stageOrder.indexOf(step.key);
            const isDone    = stepIdx < currentIdx;
            const isActive  = stepIdx === currentIdx;
            return (
              <div key={step.key} className="flex items-center gap-2 text-xs">
                {isDone ? (
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                ) : isActive ? (
                  <div className="h-3 w-3 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin shrink-0" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-slate-200 shrink-0" />
                )}
                <span className={
                  isDone   ? "text-slate-300 line-through" :
                  isActive ? "text-violet-700 font-semibold" :
                             "text-slate-400"
                }>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[10px] text-slate-400">
          Se guarda automáticamente · No cierres esta página
        </p>
      </div>
    );
  }

  const warnings: string[] = data.risk_warnings ?? [];
  const factors:  string[] = data.risk_factors  ?? [];
  const superpuestos: string[] = data.overlapping?.superpuestos ?? [];
  const colindantes:  string[] = data.overlapping?.colindantes  ?? [];
  const serfor = data.serfor ?? {};

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <FileText size={14} className="text-violet-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Análisis de Expediente
        </h2>
        {data.cached && (
          <span className="text-[10px] text-slate-400">
            · {new Date(data.fetched_at).toLocaleDateString("es-PE")}
          </span>
        )}
        <span className="ml-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 text-[10px] font-bold">
          PRO
        </span>
        <div className="ml-auto flex items-center gap-2">
          {data.pages_scanned < 50 && (
            <button
              onClick={handleRefreshFull}
              title="Escanear todas las páginas del expediente"
              className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-100 transition"
            >
              <Zap size={10} /> Análisis completo
            </button>
          )}
          <button
            onClick={() => handleAnalyze(false)}
            className="text-slate-400 hover:text-slate-600 transition p-0.5 rounded"
            title="Volver a analizar"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Risk score */}
      <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <RiskGauge score={data.risk_score ?? 0} level={data.risk_level ?? "—"} />
        {(warnings.length > 0 || factors.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {warnings.map((w: string) => (
              <span key={w} className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
                <XCircle size={9} /> {w}
              </span>
            ))}
            {factors.map((f: string) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                <CheckCircle2 size={9} /> {f}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Contacto */}
        <div className="rounded-lg border border-slate-100 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Mail size={11} /> Contacto del titular
          </p>
          <div className="space-y-2">
            {data.titular_email ? (
              <div>
                <p className="text-[10px] text-slate-400">Email</p>
                <a href={`mailto:${data.titular_email}`}
                   className="text-xs font-semibold text-primary-700 hover:underline break-all">
                  {data.titular_email}
                </a>
                {data.titular_email_alt && (
                  <a href={`mailto:${data.titular_email_alt}`}
                     className="mt-0.5 block text-xs text-slate-500 hover:underline break-all">
                    {data.titular_email_alt}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Email no detectado en expediente
                {data.pages_scanned < 50 && " · usa análisis completo"}
              </p>
            )}
            <div className="flex gap-4">
              {data.titular_dni && (
                <div>
                  <p className="text-[10px] text-slate-400">DNI</p>
                  <p className="text-xs font-semibold text-slate-800 font-mono">{data.titular_dni}</p>
                </div>
              )}
              {data.titular_ruc && (
                <div>
                  <p className="text-[10px] text-slate-400">RUC</p>
                  <p className="text-xs font-semibold text-slate-800 font-mono">{data.titular_ruc}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border border-slate-100 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Clock size={11} /> Proceso de titulación
          </p>
          <ol className="relative border-l border-slate-200 ml-2 space-y-3">
            {[
              { label: "Petitorio formulado", date: data.fecha_petitorio, color: "bg-slate-400" },
              { label: "Título otorgado",     date: data.fecha_titulo,    color: "bg-emerald-500" },
              { label: "Pub. El Peruano",     date: data.fecha_publicacion_peruano, color: "bg-blue-400" },
              { label: "Límite impugnación",  date: data.fecha_limite_impugnacion,  color: "bg-amber-400" },
            ].filter(e => e.date).map((e) => (
              <li key={e.label} className="ml-3 flex items-start gap-2">
                <span className={`absolute -left-1 mt-1 h-2 w-2 rounded-full ${e.color}`} />
                <div>
                  <p className="text-[10px] text-slate-400">{e.label}</p>
                  <p className="text-xs font-semibold text-slate-700">{fmt(e.date)}</p>
                </div>
              </li>
            ))}
          </ol>
          {data.duracion_proceso_dias && (
            <p className="mt-3 text-[10px] text-slate-400">
              Duración total:{" "}
              <span className="font-semibold text-slate-600">
                {data.duracion_proceso_dias} días ({Math.round(data.duracion_proceso_dias / 30)} meses)
              </span>
            </p>
          )}
        </div>

        {/* SERFOR */}
        {(serfor.serfor_resumen || data.pages_scanned >= 50) && (
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck size={11} /> Restricciones ambientales
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {serfor.tiene_concesion_forestal === false
                  ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  : serfor.tiene_concesion_forestal === true
                  ? <XCircle size={13} className="text-red-500 shrink-0" />
                  : <AlertCircle size={13} className="text-slate-300 shrink-0" />}
                <span className="text-xs text-slate-700">
                  {serfor.tiene_concesion_forestal === false ? "Sin concesiones forestales" :
                   serfor.tiene_concesion_forestal === true  ? "Superpone concesión forestal" :
                   "Sin datos de concesiones forestales"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {serfor.en_area_protegida === false
                  ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  : serfor.en_area_protegida === true
                  ? <XCircle size={13} className="text-red-500 shrink-0" />
                  : <AlertCircle size={13} className="text-slate-300 shrink-0" />}
                <span className="text-xs text-slate-700">
                  {serfor.en_area_protegida === false ? "Fuera de áreas protegidas" :
                   serfor.en_area_protegida === true  ? "Dentro de área protegida" :
                   "Sin datos de áreas protegidas"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Colindantes / superpuestos */}
        {(superpuestos.length > 0 || colindantes.length > 0) && (
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Link2 size={11} /> Concesiones relacionadas
            </p>
            {superpuestos.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] text-red-500 font-semibold mb-1">Superpuestas (conflicto potencial)</p>
                <div className="flex flex-wrap gap-1">
                  {superpuestos.map((code: string) => (
                    <Link key={code} href={`/explorar?q=${code}`}
                      className="font-mono text-[10px] rounded bg-red-50 border border-red-100 px-1.5 py-0.5 text-red-700 hover:bg-red-100 transition">
                      {code}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {colindantes.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-1">Colindantes / prioritarios</p>
                <div className="flex flex-wrap gap-1">
                  {colindantes.map((code: string) => (
                    <Link key={code} href={`/explorar?q=${code}`}
                      className="font-mono text-[10px] rounded bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 transition">
                      {code}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resolución oficial */}
        {data.nro_resolucion_titulo && (
          <div className="rounded-lg border border-slate-100 p-4 sm:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Hash size={11} /> Resolución de título
            </p>
            <p className="text-xs font-mono font-semibold text-slate-700">
              N° {data.nro_resolucion_titulo}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Páginas escaneadas: {data.pages_scanned} ·{" "}
              {data.full_scan ? "Análisis completo" : "Análisis rápido"}
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-[10px] text-slate-400">
        Fuente: Expediente digitalizado INGEMMET ·{" "}
        {data.ocr_engine?.startsWith("gemini")
          ? `Gemini ${data.ocr_engine.replace("gemini-", "").replace(/-/g, " ")} (IA)`
          : "OCR local (Tesseract)"}{" "}
        · Sin costo por consulta
      </p>
    </div>
  );
}

// ── Superposiciones geográficas ────────────────────────────────────────────────
function OverlapSection({ concessionId, code }: { concessionId: number; code: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["overlapping", concessionId],
    queryFn: async () =>
      (await api.get(`/concessions/${concessionId}/overlapping`)).data,
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });

  if (isLoading) return null;
  if (!data?.has_overlaps) return null;

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={14} className="text-red-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Superposiciones detectadas
        </h2>
        <span className="ml-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
          {data.count} concesión{data.count !== 1 ? "es" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {data.overlapping.map((o: any) => (
          <div key={o.id} className="flex items-center gap-3 rounded-lg bg-red-50/50 border border-red-100 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/explorar/${o.id}`}
                  className="text-sm font-semibold text-slate-800 hover:text-primary-700 hover:underline truncate">
                  {o.name}
                </Link>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">{o.code}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {o.holder_name || "—"} · {o.status}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-red-600">{o.area_overlap_ha} ha</p>
              <p className="text-[10px] text-slate-400">superpuestas</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        Calculado con PostGIS ST_Intersection · Área mínima: 100 m²
      </p>
    </div>
  );
}

// Wrapper que espera a que SIDEMCAT cargue para saber si hay PDF
function ExpedienteSectionWrapper({ concessionId }: { concessionId: number }) {
  const { data: sidemcat } = useQuery({
    queryKey: ["sidemcat", concessionId],
    queryFn: async () => (await api.get(`/concessions/${concessionId}/sidemcat`)).data,
    staleTime: 1000 * 60 * 60 * 6,
  });
  if (!sidemcat?.has_pdf) return null;
  return <ExpedienteSection concessionId={concessionId} hasPdf={true} />;
}

export default function ConcessionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: c, isLoading, isError } = useQuery({
    queryKey: ["concession", id],
    queryFn: async () => (await api.get(`/concessions/${id}`)).data,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
    </div>
  );

  if (isError || !c) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle size={24} />
      </div>
      <p className="font-semibold text-slate-800">Concesión no encontrada</p>
      <button onClick={() => router.back()} className="mt-2 flex items-center gap-2 text-sm text-primary-600">
        <ArrowLeft size={15} /> Volver
      </button>
    </div>
  );

  const statusStyle = STATUS_STYLES[c.status] ?? STATUS_STYLES.suspended;
  const statusLabel = STATUS_LABELS[c.status] ?? c.status;

  let daysToExpiry: number | null = null;
  if (c.expiration_date) {
    daysToExpiry = Math.ceil((new Date(c.expiration_date).getTime() - Date.now()) / 86_400_000);
  }

  const STRIPE: Record<string, string> = {
    active:    "bg-emerald-600",
    expired:   "bg-red-500",
    pending:   "bg-amber-500",
    suspended: "bg-slate-400",
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">

      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <Link href="/explorar" className="hover:text-slate-700 transition flex items-center gap-1">
          <ChevronRight size={12} className="rotate-180" /> Explorar
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-600">{c.code}</span>
      </nav>

      {/* ── Hero card ─────────────────────────────────────────────────── */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Status stripe */}
        <div className={`h-1.5 w-full ${STRIPE[c.status] ?? "bg-slate-300"}`} />

        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Left: name + holder */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-slate-400">{c.code}</span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                  {statusLabel}
                </span>
                {c.concession_type && <SubstanceBadge type={c.concession_type} />}
              </div>
              <h1 className="text-xl font-bold text-slate-900 leading-snug">{c.name}</h1>
              {c.holder_name && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <User size={13} className="shrink-0" />
                  {c.holder_name}
                  {c.holder_ruc && (
                    <span className="font-mono text-xs text-slate-400">· {c.holder_ruc}</span>
                  )}
                </p>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <AddToWatchlistButton concessionId={c.id} />
              <Link href={`/mapa?code=${c.code}&id=${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                <Map size={14} /> Ver en mapa
              </Link>
            </div>
          </div>

          {/* Key metrics strip */}
          <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Área</p>
              <p className="font-bold text-slate-800">
                {c.area_hectares != null ? `${Number(c.area_hectares).toLocaleString("es-PE", { maximumFractionDigits: 0 })} ha` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Región</p>
              <p className="font-semibold text-slate-800">{c.region || "—"}</p>
            </div>
            {c.province && (
              <div>
                <p className="text-xs text-slate-400">Provincia</p>
                <p className="font-semibold text-slate-800">{c.province}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400">Registro</p>
              <p className="font-semibold text-slate-800">{fmt(c.registration_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Titulación</p>
              <p className="font-semibold text-slate-800"><TitleDateInline titleDate={c.title_date} concessionId={c.id} /></p>
            </div>
            {c.expiration_date && (
              <div>
                <p className="text-xs text-slate-400">Vencimiento</p>
                <p className={`font-semibold ${daysToExpiry !== null && daysToExpiry < 60 ? "text-red-600" : "text-slate-800"}`}>
                  {fmt(c.expiration_date)}
                </p>
              </div>
            )}
            <div className="ml-auto">
              <Link href={`/mis-concesiones?ruc=${c.holder_ruc ?? ""}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 transition">
                <User size={12} /> Seguir titular
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Expiry alerts ──────────────────────────────────────────────── */}
      {daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">Vence en <strong>{daysToExpiry} día{daysToExpiry !== 1 ? "s" : ""}</strong>.</p>
        </div>
      )}
      {daysToExpiry !== null && daysToExpiry < 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm font-medium text-red-800">Venció hace <strong>{Math.abs(daysToExpiry)} días</strong>.</p>
        </div>
      )}

      {/* ── Superposiciones ────────────────────────────────────────────── */}
      <OverlapSection concessionId={c.id} code={c.code} />

      {/* ── SIDEMCAT ───────────────────────────────────────────────────── */}
      <SidemcatSection concessionId={c.id} code={c.code} concessionQueryKey={id} />

      {/* ── Expediente OCR (PRO) ────────────────────────────────────────── */}
      <ExpedienteSectionWrapper concessionId={c.id} />

      {/* ── Datos técnicos ─────────────────────────────────────────────── */}
      <details className="mt-4 group">
        <summary className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition select-none list-none">
          <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
          Datos técnicos del sistema
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-slate-400">
              <Hash size={13} /><p className="text-xs font-semibold uppercase tracking-wide">Registro</p>
            </div>
            <DetailRow label="Código INGEMMET" value={c.code} />
            <DetailRow label="ID interno" value={c.id} />
            <DetailRow label="Fuente" value={c.source} />
            <DetailRow label="Actualizado" value={fmt(c.updated_at)} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-slate-400">
              <MapPin size={13} /><p className="text-xs font-semibold uppercase tracking-wide">Ubicación</p>
            </div>
            <DetailRow label="Región" value={c.region} />
            <DetailRow label="Provincia" value={c.province} />
            <DetailRow label="Distrito" value={c.district} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-slate-400">
              <Layers size={13} /><p className="text-xs font-semibold uppercase tracking-wide">Concesión</p>
            </div>
            <DetailRow label="Tipo" value={c.concession_type} />
            <DetailRow label="Área exacta" value={c.area_hectares != null ? `${c.area_hectares.toFixed(4)} ha` : null} />
            <DetailRow label="Titular (RUC)" value={c.holder_ruc} />
          </div>
        </div>
      </details>

      {/* ── Back ───────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <button onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
          <ArrowLeft size={15} /> Volver
        </button>
      </div>
    </div>
  );
}
