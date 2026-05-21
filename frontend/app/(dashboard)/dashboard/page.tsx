"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bell, Bookmark, CalendarDays, Clock3,
  Database, DatabaseZap, Map, Upload, TrendingUp,
  AlertTriangle, CheckCircle2, RefreshCw, User,
  ExternalLink, Zap, ShieldAlert, TrendingDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import SubstanceBadge from "@/components/ui/SubstanceBadge";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(d);
}
function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

const STATUS_LABELS: Record<string, string> = {
  active: "Vigente", expired: "Caducada", pending: "En trámite", suspended: "Suspendida",
};
const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500", expired: "bg-red-400",
  pending: "bg-amber-400",  suspended: "bg-slate-400",
};
const ALERT_ICON: Record<string, any> = {
  debt:          TrendingDown,
  status_change: RefreshCw,
  expiration:    AlertTriangle,
};
const ALERT_COLOR: Record<string, string> = {
  debt:          "text-orange-500 bg-orange-50",
  status_change: "text-amber-500 bg-amber-50",
  expiration:    "text-red-500 bg-red-50",
};

/* ── Peru map SVG ────────────────────────────────────────────────────────── */
function PeruMapSvg() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[45%] lg:block">
      <svg viewBox="0 0 520 360" className="h-full w-full opacity-90">
        <defs>
          <pattern id="topo" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M0 50 C30 20,80 20,110 50 S190 80,220 50" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
            <path d="M-10 88 C25 58,85 58,118 88 S200 118,235 88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </pattern>
          <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="520" height="360" fill="url(#topo)" />
        <path d="M314 30 L349 58 L342 84 L367 112 L357 142 L384 183 L372 214 L378 244 L363 274 L337 307 L309 323 L285 315 L271 290 L248 262 L239 232 L224 206 L227 174 L209 149 L214 117 L236 98 L252 67 L280 46 Z"
          fill="rgba(210,245,239,0.10)" stroke="rgba(231,255,250,0.85)" strokeWidth="1.5" />
        {[[298,90],[318,104],[326,122],[308,138],[286,154],[334,166],[320,190],[294,178],[280,201],[306,224],[323,243],[347,220],[353,194],[341,134],[286,109],[268,130],[257,170],[270,234],[303,272],[328,287],[349,266],[355,96],[309,58],[246,202],[233,143],[275,247]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="2.5" fill="rgba(255,255,255,0.85)" filter="url(#glow)" />
        ))}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════ PAGE ═══════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuthStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const name = user?.full_name?.split(" ")[0] || "usuario";

  /* ── API queries ────────────────────────────────────────────────────── */
  const { data: stats } = useQuery({
    queryKey: ["concession-stats"],
    queryFn: async () => (await api.get("/concessions/stats")).data,
  });
  const { data: trackedRucs } = useQuery<any[]>({
    queryKey: ["tracked-rucs"],
    queryFn: async () => (await api.get("/users/me/tracked-rucs")).data,
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn: async () => (await api.get("/alerts/unread-count")).data,
    refetchInterval: 60_000,
  });
  const { data: recentAlerts } = useQuery<any[]>({
    queryKey: ["alerts-recent"],
    queryFn: async () => (await api.get("/alerts", { params: { limit: 4 } })).data,
  });
  const { data: myConcessions } = useQuery<any[]>({
    queryKey: ["my-concessions-dash"],
    queryFn: async () => (await api.get("/concessions/mine")).data,
    enabled: (trackedRucs?.length ?? 0) > 0,
  });
  const { data: oppStats } = useQuery({
    queryKey: ["opp-stats"],
    queryFn: async () => (await api.get("/opportunities/stats")).data,
    staleTime: 1000 * 60 * 10,
  });
  const { data: importLogs } = useQuery<any[]>({
    queryKey: ["import-logs"],
    queryFn: async () => (await api.get("/ingestion/logs", { params: { limit: 5 } })).data,
    enabled: user?.role === "admin",
  });

  const unread    = unreadData?.count ?? 0;
  const myCount   = myConcessions?.length ?? 0;
  const debtCount = myConcessions?.filter((c: any) => c.sidemcat_data?.has_debt).length ?? 0;

  return (
    <div className="flex flex-col gap-6 pb-6">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hola, {name}{" "}
            <span className="inline-block origin-[70%_70%]">👋</span>
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Aquí tienes el pulso de tus concesiones monitoreadas.
          </p>
        </div>
        <div className="flex items-center gap-6 text-[14px] font-medium text-slate-600">
          <span className="hidden sm:inline-flex items-center gap-2.5">
            <CalendarDays size={18} className="text-slate-400" />{fmtDate(now)}
          </span>
          <span className="inline-flex items-center gap-2.5">
            <Clock3 size={18} className="text-slate-400" />{fmtTime(now)}
          </span>
          <Link href="/alertas" className="relative cursor-pointer">
            <Bell size={20} className="text-slate-500" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#09413d] text-[10px] font-bold text-white border-2 border-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">

        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col gap-6 w-full min-w-0">

          {/* HERO */}
          <div className="relative overflow-hidden rounded-2xl bg-[#09413d] shadow-sm flex flex-col justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,255,236,0.08),transparent_40%)]" />
            <PeruMapSvg />
            <div className="relative z-10 px-8 py-8 lg:px-10 lg:py-10">
              <h2 className="max-w-[480px] text-[1.8rem] font-bold leading-[1.2] tracking-tight text-white">
                {myCount > 0
                  ? `${myCount.toLocaleString("es-PE")} concesiones bajo tu radar`
                  : "Tu base geoespacial, tu ventaja competitiva."}
              </h2>
              <p className="mt-3 max-w-[500px] text-[15px] leading-relaxed text-white/80">
                {myCount > 0
                  ? `${debtCount > 0 ? `${debtCount} con deuda de vigencia · ` : ""}${unread > 0 ? `${unread} alertas pendientes` : "Todo al día"}`
                  : "Sigue titulares, detecta oportunidades y recibe alertas automáticas."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/mis-concesiones"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-5 text-[14px] font-bold text-[#09413d] shadow-sm transition hover:bg-slate-50">
                  <User size={16} /> Mis concesiones <ArrowRight size={15} />
                </Link>
                <Link href="/oportunidades"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-5 text-[14px] font-bold text-white transition hover:bg-white/20">
                  <Zap size={16} /> Ver oportunidades
                </Link>
              </div>
            </div>
          </div>

          {/* METRICS ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Concesiones en base",
                value: stats?.total?.toLocaleString("es-PE") ?? "—",
                sub:   stats ? `${stats.active?.toLocaleString("es-PE")} vigentes` : "Cargando…",
                Icon: Database, color: "bg-emerald-50 text-emerald-700",
              },
              {
                label: "Titulares seguidos",
                value: (trackedRucs?.length ?? "—").toString(),
                sub:   myCount > 0 ? `${myCount} concesiones monitoreadas` : "Sin concesiones rastreadas",
                Icon: Bookmark, color: "bg-primary-50 text-primary-700",
              },
              {
                label: "Alertas sin leer",
                value: unread.toString(),
                sub:   unread > 0 ? "Pendientes de revisar" : "Estás al día ✓",
                Icon: Bell, color: unread > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400",
              },
              {
                label: "Oportunidades",
                value: oppStats ? (oppStats.libre_denunciabilidad + oppStats.adquisicion + oppStats.monitoreo).toLocaleString("es-PE") : "—",
                sub:   oppStats ? `${oppStats.libre_denunciabilidad} libres · ${oppStats.adquisicion} adquisición` : "Calculando…",
                Icon: TrendingUp, color: "bg-violet-50 text-violet-600",
              },
            ].map((m) => (
              <div key={m.label} className="flex gap-3 rounded-2xl border border-[#e2ebe9] bg-white p-5 shadow-sm">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.color}`}>
                  <m.Icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">{m.label}</p>
                  <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{m.value}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{m.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* MIS CONCESIONES + ALERTAS RECIENTES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Mis concesiones rastreadas */}
            <div className="rounded-2xl border border-[#e2ebe9] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf2f1]">
                <h3 className="text-[15px] font-bold text-slate-900">Mis concesiones</h3>
                <Link href="/mis-concesiones" className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-[#f0f3f2]">
                {!trackedRucs?.length ? (
                  <div className="px-6 py-8 text-center">
                    <Bookmark size={28} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Sin titulares rastreados</p>
                    <Link href="/mis-concesiones" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
                      Agregar titular <ArrowRight size={11} />
                    </Link>
                  </div>
                ) : !myConcessions?.length ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm text-slate-400">Cargando concesiones…</p>
                  </div>
                ) : myConcessions.slice(0, 5).map((c: any) => (
                  <Link key={c.id} href={`/explorar/${c.id}`}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50/60 transition">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.code} · {c.region || "—"}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <SubstanceBadge type={c.concession_type} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Alertas recientes */}
            <div className="rounded-2xl border border-[#e2ebe9] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf2f1]">
                <h3 className="text-[15px] font-bold text-slate-900">Alertas recientes</h3>
                <Link href="/alertas" className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-[#f0f3f2]">
                {!recentAlerts?.length ? (
                  <div className="px-6 py-8 text-center">
                    <CheckCircle2 size={28} className="text-emerald-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Sin alertas. Todo al día.</p>
                  </div>
                ) : recentAlerts.map((a: any) => {
                  const Icon = ALERT_ICON[a.alert_type] ?? Bell;
                  const colorCls = ALERT_COLOR[a.alert_type] ?? "text-slate-500 bg-slate-50";
                  return (
                    <Link key={a.id} href={a.related_concession_id ? `/explorar/${a.related_concession_id}` : "/alertas"}
                      className={`flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50/60 transition ${!a.is_read ? "bg-primary-50/30" : ""}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorCls}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{fmt(a.created_at)}</p>
                      </div>
                      {!a.is_read && <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-1" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ACTIVIDAD / IMPORT LOGS (solo admin) */}
          {user?.role === "admin" && (
            <div className="rounded-2xl border border-[#e2ebe9] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf2f1]">
                <h3 className="text-[15px] font-bold text-slate-900">Historial de importaciones</h3>
                <Link href="/importaciones" className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1">
                  Ver todo <ArrowRight size={12} />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#fafbfb] border-b border-[#edf2f1]">
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-3 text-left">Fuente</th>
                      <th className="px-5 py-3 text-left">Procesados</th>
                      <th className="px-5 py-3 text-left">Creados</th>
                      <th className="px-5 py-3 text-left">Actualizados</th>
                      <th className="px-5 py-3 text-left">Inicio</th>
                      <th className="px-5 py-3 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f3f2]">
                    {(importLogs ?? []).map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2ebe9] bg-white">
                              <DatabaseZap size={14} className="text-slate-500" />
                            </div>
                            <span className="font-semibold text-slate-800">{log.source}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800">{log.records_processed?.toLocaleString("es-PE") ?? "—"}</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-semibold">{log.records_created?.toLocaleString("es-PE") ?? "—"}</td>
                        <td className="px-5 py-3.5 text-blue-600 font-semibold">{log.records_updated?.toLocaleString("es-PE") ?? "—"}</td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{fmt(log.started_at)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                            log.error_message
                              ? "border-red-200 bg-red-50 text-red-600"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}>
                            {log.error_message ? "Error" : "Completado"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!importLogs?.length && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">Sin importaciones registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="w-full xl:w-[300px] 2xl:w-[340px] shrink-0 flex flex-col gap-5">

          {/* Oportunidades destacadas */}
          <div className="rounded-2xl border border-[#e2ebe9] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-900">Oportunidades</h3>
              <Link href="/oportunidades" className="text-xs font-semibold text-primary-600 hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-3">
              {[
                { key: "libre_denunciabilidad", label: "Libre denunciabilidad", color: "bg-red-500", desc: "Áreas caducadas disponibles" },
                { key: "adquisicion",           label: "Adquisición potencial",  color: "bg-amber-400", desc: "Titulares con deuda de vigencia" },
                { key: "monitoreo",             label: "Petitorios a monitorear",color: "bg-blue-400",  desc: "Grandes en zonas mineras" },
              ].map((t) => (
                <Link key={t.key} href={`/oportunidades?opp_type=${t.key}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50 transition">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${t.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{t.label}</p>
                    <p className="text-[10px] text-slate-400">{t.desc}</p>
                  </div>
                  <span className="text-lg font-bold text-slate-800 shrink-0">
                    {oppStats ? (oppStats[t.key] ?? 0).toLocaleString("es-PE") : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="rounded-2xl border border-[#e2ebe9] bg-white p-6 shadow-sm">
            <h3 className="text-[15px] font-bold text-slate-900 mb-4">Acciones rápidas</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: "/mapa",           Icon: Map,        label: "Mapa",        color: "bg-[#f0f6f5] text-[#09413d]" },
                { href: "/explorar",       Icon: Database,   label: "Explorar",    color: "bg-slate-50 text-slate-600" },
                { href: "/alertas",        Icon: Bell,       label: "Alertas",     color: "bg-amber-50 text-amber-600" },
                { href: "/oportunidades",  Icon: TrendingUp, label: "Oportunidades", color: "bg-violet-50 text-violet-600" },
                { href: "/mis-concesiones",Icon: Bookmark,   label: "Monitoreo",   color: "bg-primary-50 text-primary-700" },
                { href: "/watchlist",      Icon: ShieldAlert, label: "Watchlist",  color: "bg-rose-50 text-rose-600" },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className={`flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition hover:scale-[1.02] ${a.color}`}>
                  <a.Icon size={18} />
                  <span className="text-[11px] font-semibold">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Última sync */}
          <div className="rounded-2xl border border-[#e2ebe9] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-900">Última sincronización</h3>
              {importLogs?.[0] && (
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  importLogs[0].error_message
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}>
                  {importLogs[0].error_message ? "Error" : "OK"}
                </span>
              )}
            </div>
            {importLogs?.[0] ? (
              <div className="space-y-3 text-[13px]">
                {[
                  ["Fuente",      importLogs[0].source],
                  ["Procesados",  importLogs[0].records_processed?.toLocaleString("es-PE") ?? "—"],
                  ["Creados",     importLogs[0].records_created?.toLocaleString("es-PE") ?? "—"],
                  ["Actualizados",importLogs[0].records_updated?.toLocaleString("es-PE") ?? "—"],
                  ["Fecha",       fmt(importLogs[0].started_at)],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-slate-500">{l}</span>
                    <span className="font-semibold text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">Sin datos de sync.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
