"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bell, Bookmark, Map, TrendingUp,
  AlertTriangle, CheckCircle2, RefreshCw,
  Zap, TrendingDown, Database, BarChart3, Search,
  DatabaseZap, ChevronRight, Activity, User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SubstanceBadge from "@/components/ui/SubstanceBadge";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

/* ── Static config ───────────────────────────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  active:    "bg-emerald-500",
  pending:   "bg-amber-400",
  expired:   "bg-red-400",
  suspended: "bg-slate-300",
};

const ALERT_META: Record<string, { icon: React.ElementType; cls: string }> = {
  debt:          { icon: TrendingDown,  cls: "bg-orange-50 text-orange-600 border-orange-200" },
  status_change: { icon: RefreshCw,     cls: "bg-amber-50  text-amber-600  border-amber-200"  },
  expiration:    { icon: AlertTriangle, cls: "bg-red-50    text-red-600    border-red-200"     },
};

const OPP_ROWS = [
  { key: "libre_denunciabilidad", label: "Libre denunciabilidad", sub: "Caducadas disponibles",    bar: "bg-red-400"    },
  { key: "adquisicion",           label: "Adquisición potencial", sub: "Titulares con deuda",       bar: "bg-amber-400"  },
  { key: "monitoreo",             label: "Monitoreo",             sub: "Petitorios en zonas clave", bar: "bg-blue-400"   },
] as const;

const QUICK_LINKS = [
  { href: "/mapa",          icon: Map,        label: "Mapa interactivo",  sub: "Catastro completo"   },
  { href: "/explorar",      icon: Search,     label: "Explorar",          sub: "64k+ concesiones"    },
  { href: "/oportunidades", icon: TrendingUp, label: "Oportunidades",     sub: "Análisis con IA"     },
  { href: "/watchlist",     icon: Bookmark,   label: "Watchlist",         sub: "Guardadas"            },
  { href: "/reportes",      icon: BarChart3,  label: "Reportes",          sub: "Excel / PDF"          },
] as const;

/* ── Peru map ────────────────────────────────────────────────────────────── */
function PeruMapSvg() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 lg:block opacity-90" aria-hidden>
      <svg viewBox="0 0 520 360" className="h-full w-full">
        <defs>
          <filter id="dm-glow">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path
          d="M314 30 L349 58 L342 84 L367 112 L357 142 L384 183 L372 214 L378 244 L363 274 L337 307 L309 323 L285 315 L271 290 L248 262 L239 232 L224 206 L227 174 L209 149 L214 117 L236 98 L252 67 L280 46 Z"
          fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
        />
        {([
          [298,90],[318,104],[326,122],[308,138],[286,154],[334,166],[320,190],
          [294,178],[280,201],[306,224],[323,243],[347,220],[353,194],[341,134],
          [286,109],[268,130],[257,170],[270,234],[303,272],[328,287],[349,266],
        ] as [number,number][]).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.8" fill="rgba(255,255,255,0.6)" filter="url(#dm-glow)" />
        ))}
      </svg>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, icon: Icon, href, loading }: {
  label: string; value: string | null; sub: string;
  color: string; icon: React.ElementType; href?: string; loading?: boolean;
}) {
  const body = (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200",
      href && "cursor-pointer hover:shadow-md hover:-translate-y-[2px]",
    )}>
      {/* color stripe */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-2xl", color)} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-70", color.replace("bg-", "bg-").replace(/\d{3}$/, "50"))}>
          <Icon size={14} className="text-foreground/60" />
        </div>
      </div>

      {loading || value === null ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[2.2rem] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ── Section header ──────────────────────────────────────────────────────── */
function SectionHeader({ title, href, action = "Ver todas" }: {
  title: string; href?: string; action?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {href && (
        <Link href={href}
          className="flex items-center gap-0.5 text-xs font-medium text-primary-600 hover:text-primary-800 transition">
          {action} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, text, cta, ctaHref }: {
  icon: React.ElementType; text: string; cta?: string; ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <Icon size={22} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
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

  const firstName  = user?.full_name?.split(" ")[0] || "usuario";
  const hour       = now.getHours();
  const greeting   = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const dateStr    = now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

  /* ── Queries ─────────────────────────────────────────────────────────── */
  const { data: stats,       isLoading: statsLoading } = useQuery({
    queryKey: ["concession-stats"],
    queryFn:  () => api.get("/concessions/stats").then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const { data: trackedRucs } = useQuery<any[]>({
    queryKey: ["tracked-rucs"],
    queryFn:  () => api.get("/users/me/tracked-rucs").then(r => r.data),
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn:  () => api.get("/alerts/unread-count").then(r => r.data),
    refetchInterval: 60_000,
  });
  const { data: recentAlerts } = useQuery<any[]>({
    queryKey: ["alerts-recent"],
    queryFn:  () => api.get("/alerts", { params: { limit: 5 } }).then(r => r.data),
  });
  const { data: myConcessions } = useQuery<any[]>({
    queryKey: ["my-concessions-dash"],
    queryFn:  () => api.get("/concessions/mine").then(r => r.data),
    enabled:  (trackedRucs?.length ?? 0) > 0,
  });
  const { data: oppStats } = useQuery({
    queryKey: ["opp-stats"],
    queryFn:  () => api.get("/opportunities/stats").then(r => r.data),
    staleTime: 1000 * 60 * 10,
  });
  const { data: importLogs } = useQuery<any[]>({
    queryKey: ["import-logs"],
    queryFn:  () => api.get("/ingestion/logs", { params: { limit: 3 } }).then(r => r.data),
    enabled:  user?.role === "admin",
  });

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const unread       = unreadData?.count ?? 0;
  const myCount      = myConcessions?.length ?? 0;
  const debtCount    = myConcessions?.filter((c: any) => c.sidemcat_data?.has_debt).length ?? 0;
  const trackedCount = trackedRucs?.length ?? 0;
  const totalOpp     = oppStats
    ? (oppStats.libre_denunciabilidad ?? 0) + (oppStats.adquisicion ?? 0) + (oppStats.monitoreo ?? 0)
    : null;

  return (
    <div className="flex flex-col gap-5 pb-10 max-w-[1440px] mx-auto">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-medium capitalize text-muted-foreground">{dateStr}</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-foreground">
            {greeting}, {firstName}
          </h1>
        </div>

        {/* Bell */}
        <Link href="/alertas"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:border-slate-300 hover:text-foreground">
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-700 text-[9px] font-bold text-white ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_0%_110%,rgba(30,139,129,0.25),transparent_55%)]" />
        <PeruMapSvg />

        <div className="relative z-10 flex flex-col justify-between gap-5 px-7 py-7 lg:flex-row lg:items-end lg:px-9 lg:py-8">
          {/* Left: headline */}
          <div>
            {/* Status pills */}
            <div className="mb-3 flex flex-wrap gap-2">
              {myCount > 0 ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {myCount} monitoreadas
                  </span>
                  {debtCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 border border-orange-400/30 px-3 py-1 text-[11px] font-semibold text-orange-200">
                      <AlertTriangle size={10} />
                      {debtCount} con deuda
                    </span>
                  )}
                  {unread > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-[11px] font-semibold text-amber-200">
                      <Bell size={10} />
                      {unread} alertas
                    </span>
                  )}
                  {unread === 0 && debtCount === 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/20 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 size={10} />
                      Portafolio al día
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/60">
                  Catastro minero del Perú
                </span>
              )}
            </div>

            <h2 className="max-w-sm text-[1.6rem] font-bold leading-[1.15] tracking-tight text-white">
              {myCount > 0
                ? `${myCount.toLocaleString("es-PE")} concesiones bajo tu radar`
                : "Tu plataforma de inteligencia geominera"}
            </h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/50">
              {myCount > 0
                ? `${trackedCount} titular${trackedCount !== 1 ? "es" : ""} seguidos${debtCount > 0 ? ` · ${debtCount} con deuda de vigencia` : ""}`
                : "Sigue titulares, detecta oportunidades y recibe alertas automáticas."}
            </p>
          </div>

          {/* Right: CTAs */}
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/mis-concesiones"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-primary-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]">
              <User size={14} /> Mis concesiones <ArrowRight size={13} />
            </Link>
            <Link href="/oportunidades"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-[13px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">
              <Zap size={14} /> Oportunidades
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Catastro nacional"
          value={stats ? stats.total.toLocaleString("es-PE") : null}
          sub={stats ? `${stats.active?.toLocaleString("es-PE")} vigentes` : ""}
          color="bg-emerald-500"
          icon={Database}
          href="/explorar"
          loading={statsLoading}
        />
        <StatCard
          label="Bajo monitoreo"
          value={trackedRucs ? (myCount > 0 ? myCount.toLocaleString("es-PE") : "0") : null}
          sub={trackedCount > 0 ? `${trackedCount} titular${trackedCount !== 1 ? "es" : ""} seguidos` : "Sin rastrear"}
          color="bg-primary-500"
          icon={Bookmark}
          href="/mis-concesiones"
          loading={!trackedRucs}
        />
        <StatCard
          label="Alertas pendientes"
          value={unreadData ? unread.toLocaleString("es-PE") : null}
          sub={unread > 0 ? "Requieren revisión" : "Todo al día"}
          color={unread > 0 ? "bg-amber-400" : "bg-slate-300"}
          icon={Bell}
          href="/alertas"
          loading={!unreadData}
        />
        <StatCard
          label="Oportunidades"
          value={oppStats ? (totalOpp ?? 0).toLocaleString("es-PE") : null}
          sub={oppStats ? `${oppStats.libre_denunciabilidad ?? 0} libres · ${oppStats.adquisicion ?? 0} adquisición` : ""}
          color="bg-violet-500"
          icon={TrendingUp}
          href="/oportunidades"
          loading={!oppStats}
        />
      </div>

      {/* ── Content: 60/40 layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Left 3/5: Concesiones + Alertas */}
        <div className="flex flex-col gap-4 lg:col-span-3">

          {/* Mis concesiones */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <SectionHeader title="Mis concesiones" href="/mis-concesiones" />
            {!trackedCount ? (
              <EmptyState icon={Bookmark} text="No sigues ningún titular aún"
                cta="Agregar titular" ctaHref="/mis-concesiones" />
            ) : !myConcessions ? (
              <div className="divide-y divide-border">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : myConcessions.length === 0 ? (
              <EmptyState icon={Activity} text="Sin concesiones rastreadas" />
            ) : (
              <div className="divide-y divide-border/60">
                {myConcessions.slice(0, 6).map((c: any) => (
                  <Link key={c.id} href={`/explorar/${c.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-muted/40">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[c.status] ?? "bg-slate-300")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary-700 transition-colors">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.code} · {c.region || "—"}
                      </p>
                    </div>
                    <SubstanceBadge type={c.concession_type} />
                  </Link>
                ))}
                {myConcessions.length > 6 && (
                  <Link href="/mis-concesiones"
                    className="flex items-center justify-center gap-1 py-3 text-xs font-medium text-muted-foreground hover:text-primary-600 hover:bg-muted/40 transition">
                    +{myConcessions.length - 6} más <ChevronRight size={11} />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Alertas recientes */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <SectionHeader title="Alertas recientes" href="/alertas" />
            {!recentAlerts ? (
              <div className="divide-y divide-border">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 pt-0.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentAlerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} text="Sin alertas. Todo al día." />
            ) : (
              <div className="divide-y divide-border/60">
                {recentAlerts.map((a: any) => {
                  const meta = ALERT_META[a.alert_type] ?? { icon: Bell, cls: "bg-slate-50 text-slate-500 border-slate-200" };
                  const Icon = meta.icon;
                  return (
                    <Link key={a.id}
                      href={a.related_concession_id ? `/explorar/${a.related_concession_id}` : "/alertas"}
                      className={cn(
                        "flex items-start gap-3 px-5 py-4 transition hover:bg-muted/40",
                        !a.is_read && "bg-primary-50/60",
                      )}>
                      <div className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.cls,
                      )}>
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{a.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(a.created_at)}</p>
                      </div>
                      {!a.is_read && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 2/5: Oportunidades + Acceso rápido */}
        <div className="flex flex-col gap-4 lg:col-span-2">

          {/* Oportunidades */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <SectionHeader title="Oportunidades" href="/oportunidades" action="Ver análisis" />
            <div className="space-y-1 p-4">
              {OPP_ROWS.map((row) => {
                const val = oppStats?.[row.key] ?? 0;
                const pct = totalOpp && totalOpp > 0 ? Math.round((val / totalOpp) * 100) : 0;
                return (
                  <Link key={row.key} href={`/oportunidades?opp_type=${row.key}`}
                    className="block rounded-xl p-3 transition hover:bg-muted/50 group">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-semibold text-foreground">{row.label}</p>
                      {!oppStats ? (
                        <Skeleton className="h-4 w-10" />
                      ) : (
                        <span className="text-[13px] font-bold text-foreground tabular-nums">
                          {val.toLocaleString("es-PE")}
                        </span>
                      )}
                    </div>
                    {/* Simple progress bar — native div, no dependency */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", row.bar)}
                        style={{ width: `${oppStats ? pct : 0}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{row.sub}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Acceso rápido */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <SectionHeader title="Acceso rápido" />
            <div className="p-3">
              {QUICK_LINKS.map(({ href, icon: Icon, label, sub }) => (
                <Link key={href} href={href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-muted/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-primary-50 group-hover:text-primary-700">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{sub}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-slate-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* Última sync — solo si hay datos */}
          {importLogs?.[0] && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <SectionHeader title="Última importación" href="/importaciones" action="Historial" />
              <div className="space-y-2.5 p-5">
                {([
                  ["Fuente",      importLogs[0].source],
                  ["Procesados",  importLogs[0].records_processed?.toLocaleString("es-PE")],
                  ["Creados",     importLogs[0].records_created?.toLocaleString("es-PE")],
                  ["Fecha",       fmt(importLogs[0].started_at)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <span className="text-xs font-semibold text-foreground">{v ?? "—"}</span>
                  </div>
                ))}
                <div className="pt-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[11px]", importLogs[0].error_message
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {importLogs[0].error_message ? "Error" : "Completado"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Admin import logs (tabla completa) ──────────────────────────── */}
      {user?.role === "admin" && importLogs && importLogs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader title="Historial de importaciones" href="/importaciones" action="Ver todo" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Fuente", "Procesados", "Creados", "Actualizados", "Fecha", "Estado"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {importLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border bg-card">
                          <DatabaseZap size={13} className="text-muted-foreground" />
                        </div>
                        <span className="font-semibold">{log.source}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold tabular-nums">{log.records_processed?.toLocaleString("es-PE") ?? "—"}</td>
                    <td className="px-5 py-3.5 font-semibold text-emerald-600 tabular-nums">{log.records_created?.toLocaleString("es-PE") ?? "—"}</td>
                    <td className="px-5 py-3.5 font-semibold text-blue-600 tabular-nums">{log.records_updated?.toLocaleString("es-PE") ?? "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap text-[13px]">{fmt(log.started_at)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={cn(
                        "text-[11px] font-semibold",
                        log.error_message
                          ? "border-red-200 bg-red-50 text-red-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      )}>
                        {log.error_message ? "Error" : "Completado"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
