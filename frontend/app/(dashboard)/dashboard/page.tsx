"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bell, Bookmark, Map, TrendingUp,
  AlertTriangle, CheckCircle2, RefreshCw, User,
  Zap, TrendingDown, Database, BarChart3, Search,
  DatabaseZap, ChevronRight, Activity,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import SubstanceBadge from "@/components/ui/SubstanceBadge";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

const STATUS_DOT: Record<string, string> = {
  active:    "bg-emerald-500",
  pending:   "bg-amber-400",
  expired:   "bg-red-400",
  suspended: "bg-slate-400",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Vigente", pending: "En trámite", expired: "Caducada", suspended: "Suspendida",
};
const ALERT_ICON: Record<string, any> = {
  debt: TrendingDown, status_change: RefreshCw, expiration: AlertTriangle,
};
const ALERT_COLOR: Record<string, string> = {
  debt:          "bg-orange-100 text-orange-600",
  status_change: "bg-amber-100  text-amber-600",
  expiration:    "bg-red-100    text-red-600",
};

/* ── Peru map SVG ────────────────────────────────────────────────────────── */
function PeruMapSvg() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] lg:block">
      <svg viewBox="0 0 520 360" className="h-full w-full">
        <defs>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path
          d="M314 30 L349 58 L342 84 L367 112 L357 142 L384 183 L372 214 L378 244 L363 274 L337 307 L309 323 L285 315 L271 290 L248 262 L239 232 L224 206 L227 174 L209 149 L214 117 L236 98 L252 67 L280 46 Z"
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"
        />
        {([
          [298,90],[318,104],[326,122],[308,138],[286,154],[334,166],[320,190],
          [294,178],[280,201],[306,224],[323,243],[347,220],[353,194],[341,134],
          [286,109],[268,130],[257,170],[270,234],[303,272],[328,287],[349,266],
        ] as [number,number][]).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.7)" filter="url(#glow2)" />
        ))}
      </svg>
    </div>
  );
}

/* ── Metric card ─────────────────────────────────────────────────────────── */
function MetricCard({
  label, value, sub, accent, icon: Icon, href,
}: {
  label: string; value: string; sub: string;
  accent: string; icon: any; href?: string;
}) {
  const Inner = (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 transition-all ${href ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""}`}
      style={{ borderColor: "#e2ebe9" }}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
          <p className="text-[2rem] font-bold leading-none tracking-tight text-slate-900">{value}</p>
          <p className="mt-1.5 text-[11px] text-slate-400">{sub}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.replace("bg-", "bg-").replace("-500","") } bg-opacity-10`}
          style={{ background: "rgba(0,0,0,0.04)" }}>
          <Icon size={18} className="text-slate-500" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{Inner}</Link> : Inner;
}

/* ── Section card wrapper ────────────────────────────────────────────────── */
function Card({
  title, action, actionHref, children, className = "",
}: {
  title: string; action?: string; actionHref?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white ${className}`} style={{ borderColor: "#e2ebe9" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#eff3f2" }}>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action && actionHref && (
          <Link href={actionHref}
            className="flex items-center gap-0.5 text-xs font-medium text-primary-600 hover:text-primary-800 transition">
            {action} <ChevronRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, text, cta, ctaHref }: {
  icon: any; text: string; cta?: string; ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
        <Icon size={22} />
      </div>
      <p className="text-sm text-slate-500">{text}</p>
      {cta && ctaHref && (
        <Link href={ctaHref}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 transition">
          {cta} <ArrowRight size={11} />
        </Link>
      )}
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

  const firstName = user?.full_name?.split(" ")[0] || "usuario";
  const hour = now.getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  /* ── Queries ─────────────────────────────────────────────────────────── */
  const { data: stats } = useQuery({
    queryKey: ["concession-stats"],
    queryFn:  async () => (await api.get("/concessions/stats")).data,
    staleTime: 1000 * 60 * 5,
  });
  const { data: trackedRucs } = useQuery<any[]>({
    queryKey: ["tracked-rucs"],
    queryFn:  async () => (await api.get("/users/me/tracked-rucs")).data,
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn:  async () => (await api.get("/alerts/unread-count")).data,
    refetchInterval: 60_000,
  });
  const { data: recentAlerts } = useQuery<any[]>({
    queryKey: ["alerts-recent"],
    queryFn:  async () => (await api.get("/alerts", { params: { limit: 5 } })).data,
  });
  const { data: myConcessions } = useQuery<any[]>({
    queryKey: ["my-concessions-dash"],
    queryFn:  async () => (await api.get("/concessions/mine")).data,
    enabled:  (trackedRucs?.length ?? 0) > 0,
  });
  const { data: oppStats } = useQuery({
    queryKey: ["opp-stats"],
    queryFn:  async () => (await api.get("/opportunities/stats")).data,
    staleTime: 1000 * 60 * 10,
  });
  const { data: importLogs } = useQuery<any[]>({
    queryKey: ["import-logs"],
    queryFn:  async () => (await api.get("/ingestion/logs", { params: { limit: 3 } })).data,
    enabled:  user?.role === "admin",
  });

  const unread      = unreadData?.count ?? 0;
  const myCount     = myConcessions?.length ?? 0;
  const debtCount   = myConcessions?.filter((c: any) => c.sidemcat_data?.has_debt).length ?? 0;
  const trackedCount = trackedRucs?.length ?? 0;
  const totalOpp    = oppStats
    ? (oppStats.libre_denunciabilidad ?? 0) + (oppStats.adquisicion ?? 0) + (oppStats.monitoreo ?? 0)
    : null;

  return (
    <div className="flex flex-col gap-5 pb-8 max-w-[1400px]">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 pt-1">
        <div>
          <p className="text-[13px] font-medium text-slate-400">
            {now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {firstName}
          </h1>
          {/* Portfolio health line */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {myCount > 0 ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {myCount} concesiones monitoreadas
                </span>
                {debtCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-orange-600 font-medium">
                    <AlertTriangle size={11} />
                    {debtCount} con deuda de vigencia
                  </span>
                )}
                {unread > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <Bell size={11} />
                    {unread} alerta{unread !== 1 ? "s" : ""} sin leer
                  </span>
                )}
                {unread === 0 && debtCount === 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 size={11} />
                    Portafolio al día
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">
                Comienza siguiendo titulares para monitorear sus concesiones
              </span>
            )}
          </div>
        </div>

        <Link href="/alertas" className="relative mt-1 shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:border-slate-300 hover:text-slate-700 transition">
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-700 text-[9px] font-bold text-white border border-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </header>

      {/* ── Hero card ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-950 min-h-[180px]">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_0%_100%,rgba(30,139,129,0.25),transparent_60%)]" />
        <PeruMapSvg />

        <div className="relative z-10 px-7 py-7 lg:px-9 lg:py-8">
          <h2 className="max-w-lg text-[1.6rem] font-bold leading-[1.2] tracking-tight text-white">
            {myCount > 0
              ? `${myCount.toLocaleString("es-PE")} concesiones bajo tu radar`
              : "Tu plataforma de inteligencia geominera"}
          </h2>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/60">
            {myCount > 0
              ? `${trackedCount} titular${trackedCount !== 1 ? "es" : ""} seguido${trackedCount !== 1 ? "s" : ""} · ${debtCount > 0 ? `${debtCount} con deuda de vigencia` : "Sin deudas detectadas"}`
              : "Sigue titulares, detecta oportunidades y recibe alertas en tiempo real."}
          </p>

          {/* Inline stats strip */}
          {myCount > 0 && (
            <div className="mt-5 flex flex-wrap gap-4">
              {[
                { label: "Vigentes",   value: myConcessions?.filter((c:any) => c.status === "active").length ?? 0,   dot: "bg-emerald-500" },
                { label: "En trámite", value: myConcessions?.filter((c:any) => c.status === "pending").length ?? 0,  dot: "bg-amber-400"   },
                { label: "Caducadas",  value: myConcessions?.filter((c:any) => c.status === "expired").length ?? 0,  dot: "bg-red-400"     },
              ].map(({ label, value, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="text-xs font-semibold text-white/80">{value} {label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/mis-concesiones"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-semibold text-primary-900 shadow-sm transition hover:bg-slate-50">
              <User size={14} /> Mis concesiones <ArrowRight size={13} />
            </Link>
            <Link href="/oportunidades"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 text-[13px] font-semibold text-white transition hover:bg-white/20">
              <Zap size={14} /> Oportunidades
            </Link>
          </div>
        </div>
      </div>

      {/* ── Metrics ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Catastro nacional"
          value={stats?.total?.toLocaleString("es-PE") ?? "—"}
          sub={stats ? `${stats.active?.toLocaleString("es-PE")} vigentes · ${stats.expired?.toLocaleString("es-PE")} caducadas` : "Cargando…"}
          accent="bg-emerald-500"
          icon={Database}
          href="/explorar"
        />
        <MetricCard
          label="Bajo monitoreo"
          value={myCount > 0 ? myCount.toLocaleString("es-PE") : (trackedCount > 0 ? "—" : "0")}
          sub={trackedCount > 0 ? `${trackedCount} titular${trackedCount !== 1 ? "es" : ""} seguido${trackedCount !== 1 ? "s" : ""}` : "Sin titulares rastreados"}
          accent="bg-primary-500"
          icon={Bookmark}
          href="/mis-concesiones"
        />
        <MetricCard
          label="Alertas sin leer"
          value={unread.toLocaleString("es-PE")}
          sub={unread > 0 ? "Requieren revisión" : "Sin alertas pendientes"}
          accent={unread > 0 ? "bg-amber-400" : "bg-slate-300"}
          icon={Bell}
          href="/alertas"
        />
        <MetricCard
          label="Oportunidades"
          value={totalOpp != null ? totalOpp.toLocaleString("es-PE") : "—"}
          sub={oppStats ? `${oppStats.libre_denunciabilidad ?? 0} libres · ${oppStats.adquisicion ?? 0} adquisición` : "Calculando…"}
          accent="bg-violet-500"
          icon={TrendingUp}
          href="/oportunidades"
        />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Mis concesiones */}
        <Card title="Mis concesiones" action="Ver todas" actionHref="/mis-concesiones" className="lg:col-span-1">
          {!trackedCount ? (
            <EmptyState icon={Bookmark} text="No sigues ningún titular aún"
              cta="Agregar titular" ctaHref="/mis-concesiones" />
          ) : !myConcessions?.length ? (
            <EmptyState icon={Activity} text="Cargando concesiones…" />
          ) : (
            <div className="divide-y" style={{ borderColor: "#f0f4f3" }}>
              {myConcessions.slice(0, 6).map((c: any) => (
                <Link key={c.id} href={`/explorar/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition group">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-primary-700 transition">
                      {c.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {c.code} · {c.region || "—"}
                    </p>
                  </div>
                  <SubstanceBadge type={c.concession_type} />
                </Link>
              ))}
              {myConcessions.length > 6 && (
                <Link href="/mis-concesiones"
                  className="flex items-center justify-center gap-1 px-5 py-3 text-xs font-medium text-slate-400 hover:text-primary-600 hover:bg-slate-50 transition">
                  +{myConcessions.length - 6} más <ChevronRight size={12} />
                </Link>
              )}
            </div>
          )}
        </Card>

        {/* Alertas recientes */}
        <Card title="Alertas recientes" action="Ver todas" actionHref="/alertas" className="lg:col-span-1">
          {!recentAlerts?.length ? (
            <EmptyState icon={CheckCircle2} text="Sin alertas. Todo al día." />
          ) : (
            <div className="divide-y" style={{ borderColor: "#f0f4f3" }}>
              {recentAlerts.map((a: any) => {
                const Icon = ALERT_ICON[a.alert_type] ?? Bell;
                const clr  = ALERT_COLOR[a.alert_type] ?? "bg-slate-100 text-slate-500";
                return (
                  <Link key={a.id}
                    href={a.related_concession_id ? `/explorar/${a.related_concession_id}` : "/alertas"}
                    className={`flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition ${!a.is_read ? "bg-primary-50/40" : ""}`}>
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${clr}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{fmt(a.created_at)}</p>
                    </div>
                    {!a.is_read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right monitoring panel */}
        <div className="flex flex-col gap-4 lg:col-span-1">

          {/* Oportunidades */}
          <Card title="Oportunidades detectadas" action="Ver análisis" actionHref="/oportunidades">
            <div className="divide-y" style={{ borderColor: "#f0f4f3" }}>
              {[
                {
                  key:   "libre_denunciabilidad",
                  label: "Libre denunciabilidad",
                  sub:   "Áreas caducadas disponibles",
                  dot:   "bg-red-500",
                  bar:   "bg-red-400",
                },
                {
                  key:   "adquisicion",
                  label: "Adquisición potencial",
                  sub:   "Titulares con deuda",
                  dot:   "bg-amber-400",
                  bar:   "bg-amber-400",
                },
                {
                  key:   "monitoreo",
                  label: "Monitoreo",
                  sub:   "Petitorios grandes",
                  dot:   "bg-blue-400",
                  bar:   "bg-blue-400",
                },
              ].map((t) => {
                const val   = oppStats?.[t.key] ?? 0;
                const total = totalOpp ?? 1;
                const pct   = total > 0 ? Math.round((val / total) * 100) : 0;
                return (
                  <Link key={t.key} href={`/oportunidades?opp_type=${t.key}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition group">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-800">{t.label}</p>
                        <span className="text-[13px] font-bold text-slate-900 tabular-nums shrink-0">
                          {oppStats ? val.toLocaleString("es-PE") : "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100">
                        <div className={`h-1 rounded-full ${t.bar} transition-all duration-500`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Acceso rápido */}
          <Card title="Acceso rápido">
            <div className="px-3 py-2">
              {[
                { href: "/mapa",            icon: Map,       label: "Mapa interactivo",      sub: "Ver catastro completo" },
                { href: "/explorar",        icon: Search,    label: "Explorar concesiones",   sub: "64k+ en el catastro" },
                { href: "/oportunidades",   icon: TrendingUp,label: "Oportunidades",          sub: "Análisis con IA" },
                { href: "/watchlist",       icon: Bookmark,  label: "Watchlist",              sub: "Concesiones guardadas" },
                { href: "/reportes",        icon: BarChart3, label: "Reportes",               sub: "Exportar en Excel/PDF" },
              ].map(({ href, icon: Icon, label, sub }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 transition group">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-700 transition">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800 leading-tight">{label}</p>
                    <p className="text-[11px] text-slate-400">{sub}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition shrink-0" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Admin: Import logs ───────────────────────────────────────────── */}
      {user?.role === "admin" && (
        <Card title="Historial de importaciones" action="Ver todo" actionHref="/importaciones">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                style={{ borderColor: "#eff3f2", background: "#fafbfb" }}>
                <tr>
                  {["Fuente", "Procesados", "Creados", "Actualizados", "Fecha", "Estado"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#f0f4f3" }}>
                {(importLogs ?? []).map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border bg-white" style={{ borderColor: "#e2ebe9" }}>
                          <DatabaseZap size={13} className="text-slate-400" />
                        </div>
                        <span className="font-semibold text-slate-800">{log.source}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800 tabular-nums">
                      {log.records_processed?.toLocaleString("es-PE") ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-emerald-600 tabular-nums">
                      {log.records_created?.toLocaleString("es-PE") ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-blue-600 tabular-nums">
                      {log.records_updated?.toLocaleString("es-PE") ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{fmt(log.started_at)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        log.error_message
                          ? "border-red-200 bg-red-50 text-red-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}>
                        {log.error_message
                          ? <><AlertTriangle size={9} /> Error</>
                          : <><CheckCircle2 size={9} /> Completado</>}
                      </span>
                    </td>
                  </tr>
                ))}
                {!importLogs?.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                      Sin importaciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}
