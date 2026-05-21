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
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import SubstanceBadge from "@/components/ui/SubstanceBadge";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

/* ── Static config (hoisted outside component per react best-practices) ─── */
const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500", pending: "bg-amber-400",
  expired: "bg-red-400",   suspended: "bg-slate-400",
};

const ALERT_META: Record<string, { icon: any; badge: string }> = {
  debt:          { icon: TrendingDown, badge: "bg-orange-100 text-orange-700 border-orange-200" },
  status_change: { icon: RefreshCw,    badge: "bg-amber-100 text-amber-700 border-amber-200"   },
  expiration:    { icon: AlertTriangle, badge: "bg-red-100 text-red-700 border-red-200"        },
};

const OPP_ROWS = [
  { key: "libre_denunciabilidad", label: "Libre denunciabilidad", sub: "Áreas caducadas disponibles", color: "bg-red-500",   progress: "bg-red-400"   },
  { key: "adquisicion",           label: "Adquisición potencial", sub: "Titulares con deuda",         color: "bg-amber-400", progress: "bg-amber-400" },
  { key: "monitoreo",             label: "Petitorios grandes",    sub: "En zonas mineras activas",    color: "bg-blue-400",  progress: "bg-blue-400"  },
] as const;

const QUICK_LINKS = [
  { href: "/mapa",          icon: Map,        label: "Mapa interactivo",    sub: "Catastro completo" },
  { href: "/explorar",      icon: Search,     label: "Explorar",            sub: "64k+ concesiones" },
  { href: "/oportunidades", icon: TrendingUp, label: "Oportunidades",       sub: "Análisis con IA" },
  { href: "/watchlist",     icon: Bookmark,   label: "Watchlist",           sub: "Concesiones guardadas" },
  { href: "/reportes",      icon: BarChart3,  label: "Reportes",            sub: "Excel y PDF" },
] as const;

/* ── Peru map SVG decoration ─────────────────────────────────────────────── */
function PeruMapSvg() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 lg:block" aria-hidden>
      <svg viewBox="0 0 520 360" className="h-full w-full">
        <defs>
          <filter id="glow-d"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path d="M314 30 L349 58 L342 84 L367 112 L357 142 L384 183 L372 214 L378 244 L363 274 L337 307 L309 323 L285 315 L271 290 L248 262 L239 232 L224 206 L227 174 L209 149 L214 117 L236 98 L252 67 L280 46 Z"
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        {([
          [298,90],[318,104],[326,122],[308,138],[286,154],[334,166],[320,190],
          [294,178],[280,201],[306,224],[323,243],[347,220],[353,194],[341,134],
          [286,109],[268,130],[257,170],[270,234],[303,272],[328,287],[349,266],
        ] as [number,number][]).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.65)" filter="url(#glow-d)" />
        ))}
      </svg>
    </div>
  );
}

/* ── MetricCard ──────────────────────────────────────────────────────────── */
interface MetricCardProps {
  label: string;
  value: string | null;
  sub: string;
  accentClass: string;
  icon: React.ElementType;
  href?: string;
  loading?: boolean;
}

function MetricCard({ label, value, sub, accentClass, icon: Icon, href, loading }: MetricCardProps) {
  const content = (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200",
      href && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
    )}>
      {/* Top accent stripe */}
      <div className={cn("absolute inset-x-0 top-0 h-0.5 rounded-t-xl", accentClass)} />
      <CardHeader className="pb-1 pt-5 px-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading || value === null ? (
          <>
            <Skeleton className="h-9 w-24 mb-1.5" />
            <Skeleton className="h-3 w-36" />
          </>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <p className="text-[2.1rem] font-bold leading-none tracking-tight text-foreground tabular-nums">
                {value}
              </p>
              <div className={cn("mb-1 flex h-7 w-7 items-center justify-center rounded-lg", accentClass, "bg-opacity-15")}>
                <Icon size={15} className="text-slate-600" />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, text, cta, ctaHref }: {
  icon: React.ElementType; text: string; cta?: string; ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Icon size={20} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {cta && ctaHref && (
        <Link href={ctaHref}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition">
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
  const { data: stats, isLoading: statsLoading } = useQuery({
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

  /* ── Derived values ──────────────────────────────────────────────────── */
  const unread       = unreadData?.count ?? 0;
  const myCount      = myConcessions?.length ?? 0;
  const debtCount    = myConcessions?.filter((c: any) => c.sidemcat_data?.has_debt).length ?? 0;
  const trackedCount = trackedRucs?.length ?? 0;
  const totalOpp     = oppStats
    ? (oppStats.libre_denunciabilidad ?? 0) + (oppStats.adquisicion ?? 0) + (oppStats.monitoreo ?? 0)
    : null;

  return (
    <div className="flex flex-col gap-5 pb-8 max-w-[1400px]">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 pt-1">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            {greeting}, {firstName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {myCount > 0 ? (
              <>
                <Badge variant="secondary" className="gap-1.5 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {myCount} monitoreadas
                </Badge>
                {debtCount > 0 && (
                  <Badge variant="outline" className="gap-1.5 border-orange-200 bg-orange-50 text-orange-700 font-medium">
                    <AlertTriangle size={10} />
                    {debtCount} con deuda
                  </Badge>
                )}
                {unread > 0 && (
                  <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 font-medium">
                    <Bell size={10} />
                    {unread} sin leer
                  </Badge>
                )}
                {unread === 0 && debtCount === 0 && (
                  <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
                    <CheckCircle2 size={10} />
                    Portafolio al día
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Comienza siguiendo titulares para monitorear sus concesiones
              </span>
            )}
          </div>
        </div>

        <Link href="/alertas"
          className="relative mt-1 shrink-0 rounded-xl border bg-card p-2.5 text-muted-foreground shadow-sm hover:border-border hover:text-foreground transition">
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground border-2 border-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-950 min-h-[176px]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_0%_110%,rgba(30,139,129,0.22),transparent_60%)]" />
        <PeruMapSvg />
        <div className="relative z-10 px-7 py-7 lg:px-9 lg:py-8">
          <h2 className="max-w-md text-[1.55rem] font-bold leading-snug tracking-tight text-white">
            {myCount > 0
              ? `${myCount.toLocaleString("es-PE")} concesiones bajo tu radar`
              : "Tu plataforma de inteligencia geominera"}
          </h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
            {myCount > 0
              ? `${trackedCount} titular${trackedCount !== 1 ? "es" : ""} · ${debtCount > 0 ? `${debtCount} con deuda` : "Sin deudas detectadas"}`
              : "Sigue titulares, detecta oportunidades y recibe alertas en tiempo real."}
          </p>

          {myCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
              {([
                ["active",    "bg-emerald-500", "Vigentes"],
                ["pending",   "bg-amber-400",   "En trámite"],
                ["expired",   "bg-red-400",     "Caducadas"],
              ] as const).map(([status, dot, label]) => {
                const count = myConcessions?.filter((c: any) => c.status === status).length ?? 0;
                return count > 0 ? (
                  <span key={status} className="flex items-center gap-1.5 text-xs text-white/70">
                    <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                    {count} {label}
                  </span>
                ) : null;
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/mis-concesiones"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-semibold text-primary-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]">
              <User size={14} /> Mis concesiones <ArrowRight size={13} />
            </Link>
            <Link href="/oportunidades"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 text-[13px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">
              <Zap size={14} /> Oportunidades
            </Link>
          </div>
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Catastro nacional"
          value={stats ? stats.total.toLocaleString("es-PE") : null}
          sub={stats ? `${stats.active?.toLocaleString("es-PE")} vigentes · ${stats.expired?.toLocaleString("es-PE")} caducadas` : ""}
          accentClass="bg-emerald-500"
          icon={Database}
          href="/explorar"
          loading={statsLoading}
        />
        <MetricCard
          label="Bajo monitoreo"
          value={trackedRucs ? (myCount > 0 ? myCount.toLocaleString("es-PE") : "0") : null}
          sub={trackedCount > 0 ? `${trackedCount} titular${trackedCount !== 1 ? "es" : ""} seguido${trackedCount !== 1 ? "s" : ""}` : "Sin titulares rastreados"}
          accentClass="bg-primary-500"
          icon={Bookmark}
          href="/mis-concesiones"
          loading={!trackedRucs}
        />
        <MetricCard
          label="Alertas sin leer"
          value={unreadData ? unread.toLocaleString("es-PE") : null}
          sub={unread > 0 ? "Requieren revisión" : "Sin alertas pendientes"}
          accentClass={unread > 0 ? "bg-amber-400" : "bg-slate-300"}
          icon={Bell}
          href="/alertas"
          loading={!unreadData}
        />
        <MetricCard
          label="Oportunidades"
          value={oppStats ? (totalOpp ?? 0).toLocaleString("es-PE") : null}
          sub={oppStats ? `${oppStats.libre_denunciabilidad ?? 0} libres · ${oppStats.adquisicion ?? 0} adquisición` : ""}
          accentClass="bg-violet-500"
          icon={TrendingUp}
          href="/oportunidades"
          loading={!oppStats}
        />
      </div>

      {/* ── Content grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Mis concesiones */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-semibold">Mis concesiones</CardTitle>
            <Link href="/mis-concesiones"
              className="flex items-center gap-0.5 text-xs font-medium text-primary hover:opacity-80 transition">
              Ver todas <ChevronRight size={13} />
            </Link>
          </CardHeader>
          <CardContent className="p-0 mt-3">
            <Separator />
            {!trackedCount ? (
              <EmptyState icon={Bookmark} text="No sigues ningún titular aún"
                cta="Agregar titular" ctaHref="/mis-concesiones" />
            ) : !myConcessions ? (
              <div className="space-y-px p-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : myConcessions.length === 0 ? (
              <EmptyState icon={Activity} text="Cargando concesiones…" />
            ) : (
              <div>
                {myConcessions.slice(0, 6).map((c: any) => (
                  <Link key={c.id} href={`/explorar/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition group">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[c.status] ?? "bg-slate-300")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground group-hover:text-primary transition">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{c.code} · {c.region || "—"}</p>
                    </div>
                    <SubstanceBadge type={c.concession_type} />
                  </Link>
                ))}
                {myConcessions.length > 6 && (
                  <Link href="/mis-concesiones"
                    className="flex items-center justify-center gap-1 px-5 py-3 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition border-t">
                    +{myConcessions.length - 6} más <ChevronRight size={11} />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas recientes */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-semibold">Alertas recientes</CardTitle>
            <Link href="/alertas"
              className="flex items-center gap-0.5 text-xs font-medium text-primary hover:opacity-80 transition">
              Ver todas <ChevronRight size={13} />
            </Link>
          </CardHeader>
          <CardContent className="p-0 mt-3">
            <Separator />
            {!recentAlerts ? (
              <div className="space-y-px p-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5 pt-0.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentAlerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} text="Sin alertas. Todo al día." />
            ) : (
              recentAlerts.map((a: any) => {
                const meta = ALERT_META[a.alert_type] ?? { icon: Bell, badge: "bg-slate-100 text-slate-600 border-slate-200" };
                const Icon = meta.icon;
                return (
                  <Link key={a.id}
                    href={a.related_concession_id ? `/explorar/${a.related_concession_id}` : "/alertas"}
                    className={cn(
                      "flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition border-b last:border-0",
                      !a.is_read && "bg-primary/5",
                    )}>
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", meta.badge)}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(a.created_at)}</p>
                    </div>
                    {!a.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right: Oportunidades + Quick links */}
        <div className="flex flex-col gap-4 lg:col-span-1">

          {/* Oportunidades */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Oportunidades</CardTitle>
              <Link href="/oportunidades"
                className="flex items-center gap-0.5 text-xs font-medium text-primary hover:opacity-80 transition">
                Análisis <ChevronRight size={13} />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {OPP_ROWS.map((row) => {
                const val = oppStats?.[row.key] ?? 0;
                const pct = totalOpp && totalOpp > 0 ? Math.round((val / totalOpp) * 100) : 0;
                return (
                  <Link key={row.key} href={`/oportunidades?opp_type=${row.key}`}
                    className="block hover:opacity-80 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", row.color)} />
                        <span className="text-[13px] font-semibold text-foreground">{row.label}</span>
                      </div>
                      {!oppStats ? (
                        <Skeleton className="h-4 w-12" />
                      ) : (
                        <span className="text-[13px] font-bold text-foreground tabular-nums">
                          {val.toLocaleString("es-PE")}
                        </span>
                      )}
                    </div>
                    <Progress value={oppStats ? pct : 0} className="h-1.5" />
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.sub}</p>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* Acceso rápido */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Acceso rápido</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              {QUICK_LINKS.map(({ href, icon: Icon, label, sub }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60 transition group">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{sub}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-muted-foreground transition shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Admin: Import logs ───────────────────────────────────────────── */}
      {user?.role === "admin" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Historial de importaciones</CardTitle>
            <Link href="/importaciones"
              className="flex items-center gap-0.5 text-xs font-medium text-primary hover:opacity-80 transition">
              Ver todo <ChevronRight size={13} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Separator />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">
                    {["Fuente", "Procesados", "Creados", "Actualizados", "Fecha", "Estado"].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!importLogs ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-5 py-3.5">
                            <Skeleton className="h-4" style={{ width: `${50 + j * 10}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : importLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Sin importaciones registradas.
                      </td>
                    </tr>
                  ) : (
                    importLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border bg-card">
                              <DatabaseZap size={13} className="text-muted-foreground" />
                            </div>
                            <span className="font-semibold text-foreground">{log.source}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-foreground tabular-nums">
                          {log.records_processed?.toLocaleString("es-PE") ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-emerald-600 tabular-nums">
                          {log.records_created?.toLocaleString("es-PE") ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-blue-600 tabular-nums">
                          {log.records_updated?.toLocaleString("es-PE") ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{fmt(log.started_at)}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant="outline" className={cn(
                            "font-semibold",
                            log.error_message
                              ? "border-red-200 bg-red-50 text-red-600"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700",
                          )}>
                            {log.error_message ? "Error" : "Completado"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
