import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   GEOCONCES — Identidad visual minera
   Paleta: Malaquita (primary) + Cobre (copper) + Tierra (earth)
   El verde malaquita es el color del mineral de cobre,
   el más común en yacimientos peruanos como Quellaveco,
   Las Bambas y Antapaccay. Intencionado, no genérico.
══════════════════════════════════════════════════════════ */

/* ── Logo mark: Hexágono geológico ─────────────────────
   El hexágono representa:
   1. La celda básica del catastro minero (cuadrícula UTM)
   2. La estructura cristalina de la malaquita
   3. La forma de los polígonos de concesión en mapas
   Las líneas horizontales = estratos geológicos
   El punto inferior = yacimiento mineral
────────────────────────────────────────────────────────── */
function GeoLogo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Hexágono — celda de catastro */}
      <path
        d="M20 2 L37 11.5 L37 32.5 L20 42 L3 32.5 L3 11.5 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Estratos geológicos — capas de tierra */}
      <line x1="9"  y1="17" x2="31" y2="17" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
      <line x1="7"  y1="22" x2="33" y2="22" stroke="currentColor" strokeWidth="1.8" opacity="0.65" strokeLinecap="round"/>
      <line x1="9"  y1="27" x2="31" y2="27" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
      {/* Yacimiento mineral */}
      <circle cx="20" cy="33" r="2.8" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}

/* ── Concession status row ──────────────────────────── */
type RowStatus = "active" | "expiring" | "expired" | "opportunity";

function ConcRow({
  code, name, region, status, days,
}: {
  code: string; name: string; region: string;
  status: RowStatus; days?: number;
}) {
  const cfg = {
    active:      { dot: "bg-primary-400",  label: "Vigente",          cls: "text-primary-700 bg-primary-50 border-primary-200/70" },
    expiring:    { dot: "bg-copper-400",   label: `${days}d`,         cls: "text-copper-700  bg-copper-50  border-copper-200/70"  },
    expired:     { dot: "bg-red-400",      label: "Caducada",         cls: "text-red-700     bg-red-50     border-red-200/70"     },
    opportunity: { dot: "bg-amber-400",    label: "Oportunidad",      cls: "text-amber-700   bg-amber-50   border-amber-200/70"   },
  }[status];

  return (
    <div className="flex items-center gap-3 border-b border-earth-100/60 px-4 py-[10px] last:border-0 transition-colors hover:bg-earth-50/40">
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold leading-tight text-earth-900">{name}</p>
        <p className="mt-0.5 font-mono text-[10px] tracking-wide text-earth-400">{code} · {region}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-[2px] text-[10px] font-bold tracking-wide ${cfg.cls}`}>
        {cfg.label}
      </span>
    </div>
  );
}

/* ── Sección label — estilo geológico ───────────────── */
function SectionLabel({
  children,
  variant = "dark",
}: {
  children: React.ReactNode;
  variant?: "dark" | "light" | "copper";
}) {
  const cls =
    variant === "light"  ? "text-primary-300 before:bg-primary-400" :
    variant === "copper" ? "text-copper-600  before:bg-copper-400"  :
                           "text-primary-600 before:bg-primary-400";
  return (
    <p className={`mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.25em] ${cls}`}>
      <span className="h-px w-8 bg-current" aria-hidden="true" />
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-earth-50 font-sans antialiased">

      {/* ════ NAVBAR ════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-earth-200/60 bg-earth-50/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3" aria-label="GeoConces">
            <div className="text-primary-600 transition group-hover:text-primary-700">
              <GeoLogo size={30} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-black uppercase tracking-[0.12em] text-earth-900">
                GeoConces
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-earth-400">
                Catastro Minero · Perú
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center" aria-label="Navegación">
            {[
              { label: "Funciones",     href: "#funciones"     },
              { label: "Cómo funciona", href: "#como-funciona" },
              { label: "Precios",       href: "/pricing"       },
            ].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-3.5 py-2 text-[13px] font-medium text-earth-600 transition hover:text-earth-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3.5 py-2 text-[13px] font-medium text-earth-600 transition hover:text-earth-950 hover:bg-earth-100 rounded-lg"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            >
              Empieza gratis
            </Link>
          </div>
        </div>
      </header>

      {/* ════ HERO — fondo tierra oscura ════════════════ */}
      <section
        className="grain relative overflow-hidden bg-[#0f1a18]"
        aria-labelledby="hero-heading"
      >
        {/* Venas de mineral — líneas diagonales geológicas */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden="true">
          <defs>
            <pattern id="strata" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
              <line x1="0" y1="0" x2="80" y2="0" stroke="#4ade80" strokeWidth="0.6"/>
              <line x1="0" y1="20" x2="80" y2="20" stroke="#4ade80" strokeWidth="1"/>
              <line x1="0" y1="35" x2="80" y2="35" stroke="#4ade80" strokeWidth="0.4"/>
              <line x1="0" y1="55" x2="80" y2="55" stroke="#4ade80" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#strata)"/>
        </svg>

        {/* Brillo de malaquita — ambientación mineral */}
        <div className="pointer-events-none absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-primary-700/20 blur-[120px]" aria-hidden="true"/>
        <div className="pointer-events-none absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full bg-copper-600/10 blur-[100px]" aria-hidden="true"/>

        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-0 lg:pt-20">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_420px] lg:items-end">

            {/* Izquierda — headline */}
            <div className="pb-16 lg:pb-20">

              <SectionLabel variant="light">
                Catastro minero · Perú · Tiempo real
              </SectionLabel>

              <h1
                id="hero-heading"
                className="font-serif text-[3.4rem] leading-[1.02] tracking-[-0.02em] text-white sm:text-[4rem] lg:text-[5rem]"
              >
                Inteligencia<br />
                sobre el territorio{" "}
                <em className="text-primary-300 italic">
                  minero peruano
                </em>
              </h1>

              {/* Separador de estrato */}
              <div className="mt-8 flex items-center gap-3" aria-hidden="true">
                <div className="h-[3px] w-8 bg-copper-500 rounded-full"/>
                <div className="h-px flex-1 bg-white/10"/>
              </div>

              <p className="mt-6 max-w-[460px] text-[16px] leading-[1.85] text-white/65">
                Monitorea vencimientos, detecta oportunidades y genera reportes
                sobre concesiones de{" "}
                <strong className="font-semibold text-white/85">INGEMMET</strong>,{" "}
                <strong className="font-semibold text-white/85">GEOCATMIN</strong> y{" "}
                <strong className="font-semibold text-white/85">SIDEMCAT</strong>.{" "}
                Actualizado cada día.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/registro"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-6 text-[14px] font-semibold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1a18]"
                >
                  Empezar gratis <ArrowRight size={14} strokeWidth={2.5}/>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-[14px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Ya tengo cuenta
                </Link>
              </div>

              <p className="mt-4 text-[11px] tracking-widest text-white/30 uppercase">
                Sin tarjeta · Acceso inmediato
              </p>
            </div>

            {/* Derecha — panel UI */}
            <div className="relative hidden lg:block self-end" aria-hidden="true">
              {/* Glow verde detrás del panel */}
              <div className="absolute inset-x-8 -top-8 h-16 rounded-full bg-primary-500/20 blur-2xl"/>

              <div className="relative overflow-hidden rounded-t-2xl border border-white/10 bg-[#1a2b28] shadow-[0_-16px_60px_-8px_rgba(0,0,0,0.5)]">

                {/* Barra de chrome — estilo terminal minero */}
                <div className="flex items-center justify-between border-b border-white/8 bg-[#0f1a18]/80 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <GeoLogo size={18} className="text-primary-400"/>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                      Mis Concesiones
                    </span>
                    <span className="rounded-full bg-primary-500/20 px-1.5 py-px text-[9px] font-bold text-primary-300">6</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"/>
                    En vivo
                  </span>
                </div>

                {/* RUC tags */}
                <div className="flex gap-2 border-b border-white/6 px-4 py-2">
                  {[
                    { ruc: "20547812301", label: "Minera Los Andes" },
                    { ruc: "20601234567", label: "Corp. Andina"     },
                  ].map((t) => (
                    <span key={t.ruc} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-copper-400"/>
                      <span className="font-mono text-[9px] text-white/40">{t.ruc}</span>
                    </span>
                  ))}
                </div>

                {/* Filas de concesiones — fondo oscuro */}
                <div className="bg-[#162420]">
                  {[
                    { code: "CONC-1023", name: "San Martín I",    region: "Ancash",      status: "active"      as RowStatus },
                    { code: "CONC-4821", name: "Los Andes Sur",   region: "Puno",        status: "expiring"    as RowStatus, days: 12 },
                    { code: "CONC-7742", name: "Huallanca Norte", region: "Arequipa",    status: "expired"     as RowStatus },
                    { code: "CONC-2210", name: "Coroccohuayco",   region: "Cusco",       status: "opportunity" as RowStatus },
                    { code: "CONC-3355", name: "Shahuindo",       region: "La Libertad", status: "active"      as RowStatus },
                    { code: "CONC-5901", name: "Pallancata",      region: "Ayacucho",    status: "expiring"    as RowStatus, days: 31 },
                  ].map((r) => (
                    <DarkConcRow key={r.code} {...r}/>
                  ))}
                </div>

                {/* Footer bar */}
                <div className="border-t border-white/6 bg-[#0f1a18]/60 px-4 py-2">
                  <p className="font-mono text-[9.5px] text-white/25">
                    INGEMMET · GEOCATMIN · Sync 2h ago
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════ STRIP DE FUENTES ══════════════════════════ */}
      <div className="border-y border-earth-200/60 bg-earth-100/60">
        <div className="mx-auto max-w-6xl px-6 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.25em] text-earth-400">
            Fuentes oficiales
          </span>
          {[
            { id: "INGEMMET",  name: "Instituto Geológico, Minero y Metalúrgico" },
            { id: "GEOCATMIN", name: "Sistema de Catastro Minero" },
            { id: "SIDEMCAT",  name: "Derechos Mineros y Catastro" },
          ].map((s) => (
            <span key={s.id} className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-black tracking-[0.08em] text-earth-700">{s.id}</span>
              <span className="hidden text-[10.5px] text-earth-400 xl:inline">— {s.name}</span>
            </span>
          ))}
          <span className="ml-auto hidden items-center gap-2 text-[11px] text-earth-500 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400"/>
            +60,000 concesiones · 25 regiones · actualización diaria
          </span>
        </div>
      </div>

      {/* ════ FUNCIONES ═════════════════════════════════ */}
      <section id="funciones" className="bg-earth-50 py-28" aria-labelledby="features-heading">
        <div className="mx-auto max-w-6xl px-6">

          <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <div>
              <SectionLabel variant="copper">Funciones</SectionLabel>
              <h2
                id="features-heading"
                className="font-serif text-[2.5rem] leading-[1.08] tracking-[-0.02em] text-earth-950 lg:text-[3rem]"
              >
                Construida para equipos de minería, derecho y prospección
              </h2>
            </div>
            <p className="text-[15px] leading-relaxed text-earth-600 lg:border-l lg:border-earth-200 lg:pl-10">
              No es un visor genérico de mapas. Es una herramienta especializada para profesionales
              que trabajan con concesiones mineras a diario y no pueden depender de PDFs desactualizados.
            </p>
          </div>

          {/* Grid editorial — proporciones asimétricas */}
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-earth-200 bg-earth-200 lg:grid-cols-3">

            {/* F1 — ancho 2/3, con alertas reales */}
            <article className="col-span-1 bg-earth-50 p-8 lg:col-span-2">
              <p className="mb-3 font-mono text-[9.5px] font-black uppercase tracking-[0.25em] text-copper-600">01 · Alertas</p>
              <h3 className="text-[1.45rem] font-bold leading-snug tracking-[-0.01em] text-earth-950">
                Vencimientos y cambios de estado detectados automáticamente
              </h3>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-earth-600">
                Escaneo diario de todas tus concesiones monitoreadas. Notificación
                cuando una está próxima a vencer o cambia de estado, antes de que sea un problema legal.
              </p>
              <div className="mt-6 space-y-2.5">
                {[
                  { code: "CONC-4821",  name: "Los Andes Sur · Puno",       warn: "Vence el 28/06/2026 — 12 días",       type: "amber" },
                  { code: "CONC-7742",  name: "Huallanca Norte · Arequipa", warn: "Cambió a Caducada el 01/05/2026",      type: "red"   },
                ].map((a) => (
                  <div
                    key={a.code}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                      a.type === "amber"
                        ? "border-copper-200/60 bg-copper-50/70"
                        : "border-red-200/60 bg-red-50/70"
                    }`}
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.type === "amber" ? "bg-copper-400" : "bg-red-400"}`} aria-hidden="true"/>
                    <div>
                      <p className="font-mono text-[10.5px] font-bold text-earth-700">{a.code} · {a.name}</p>
                      <p className={`mt-0.5 text-[12.5px] font-semibold ${a.type === "amber" ? "text-copper-800" : "text-red-800"}`}>
                        {a.warn}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* F2 — scoring */}
            <article className="bg-earth-50 p-8">
              <p className="mb-3 font-mono text-[9.5px] font-black uppercase tracking-[0.25em] text-copper-600">02 · Scoring</p>
              <h3 className="text-[1.2rem] font-bold leading-snug tracking-[-0.01em] text-earth-950">
                Oportunidades rankeadas por potencial
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-earth-600">
                Cada concesión disponible puntúa según vencimiento, área y ubicación geográfica.
              </p>
              <div className="mt-6 space-y-4">
                {[
                  { code: "CONC-2210", region: "Cusco",  score: 91 },
                  { code: "CONC-9032", region: "Puno",   score: 74 },
                  { code: "CONC-1188", region: "Ancash", score: 58 },
                ].map((o) => (
                  <div key={o.code}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-earth-400">{o.code}</span>
                        <span className="mx-1.5 text-earth-300">·</span>
                        <span className="text-[12px] font-semibold text-earth-700">{o.region}</span>
                      </div>
                      <span className="tabular-nums text-[13px] font-black text-earth-900">{o.score}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-earth-200" role="progressbar" aria-valuenow={o.score} aria-valuemin={0} aria-valuemax={100}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400"
                        style={{ width: `${o.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* F3, F4, F5 */}
            {[
              {
                n: "03 · Mapa",
                title: "Visualización geoespacial",
                body: "Geometrías oficiales de INGEMMET con capas de estado, titular y región. Selecciona cualquier polígono de concesión para ver su ficha completa.",
              },
              {
                n: "04 · Reportes",
                title: "Exportación Excel y PDF",
                body: "Reportes filtrados por titular, región o estado, listos para compartir con equipos legales y directivos en un solo clic.",
              },
              {
                n: "05 · Datos",
                title: "Sincronización diaria automática",
                body: "Integración directa con INGEMMET, GEOCATMIN y SIDEMCAT. Sin descargas manuales. Sin archivos desactualizados en el escritorio.",
              },
            ].map((f) => (
              <article key={f.n} className="bg-earth-50 p-8">
                <p className="mb-3 font-mono text-[9.5px] font-black uppercase tracking-[0.25em] text-copper-600">{f.n}</p>
                <h3 className="text-[1.15rem] font-bold leading-snug tracking-[-0.01em] text-earth-950">{f.title}</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-earth-600">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CÓMO FUNCIONA — fondo tierra oscura ═══════ */}
      <section
        id="como-funciona"
        className="grain relative overflow-hidden bg-earth-950 py-28 text-white"
        aria-labelledby="how-heading"
      >
        {/* Venas geológicas */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]" aria-hidden="true">
          <defs>
            <pattern id="vein2" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
              <line x1="0" y1="0" x2="60" y2="0" stroke="#a16207" strokeWidth="0.8"/>
              <line x1="0" y1="30" x2="60" y2="30" stroke="#a16207" strokeWidth="0.4"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vein2)"/>
        </svg>
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-copper-800/15 blur-[100px]" aria-hidden="true"/>

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-16">
            <SectionLabel variant="light">Cómo funciona</SectionLabel>
            <h2
              id="how-heading"
              className="max-w-xl font-serif text-[2.5rem] leading-[1.08] tracking-[-0.02em] text-white lg:text-[3rem]"
            >
              De los datos públicos a tu decisión, en minutos
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Agrega los titulares que te interesan",
                body: "Ingresa el RUC de la empresa o persona natural. GeoConces recupera automáticamente todas sus concesiones: activas, pendientes y caducadas.",
              },
              {
                n: "02",
                title: "Monitoreo continuo sin intervención",
                body: "Sincronización diaria con INGEMMET. Detectamos cambios de estado y vencimientos próximos antes de que se conviertan en un problema legal o comercial.",
              },
              {
                n: "03",
                title: "Actúa con información concreta",
                body: "Recibe alertas precisas, explora el mapa, descarga reportes y comparte con tu equipo legal. Sin ruido, sin datos irrelevantes.",
              },
            ].map((step, i) => (
              <div
                key={step.n}
                className={`px-8 py-2 ${i < 2 ? "md:border-r md:border-earth-800" : ""}`}
              >
                <p className="font-mono text-[9.5px] font-black uppercase tracking-[0.25em] text-copper-500 mb-6">
                  {step.n}
                </p>
                <h3 className="text-[16.5px] font-semibold leading-snug text-white mb-3">{step.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-earth-400">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Tabla de muestra — datos concretos */}
          <div className="mt-16 overflow-hidden rounded-xl border border-earth-800 bg-earth-900/50">
            <div className="flex items-center justify-between border-b border-earth-800 px-5 py-2.5">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-earth-500">
                Vista en tiempo real · RUC 20547812301 · Minera Los Andes
              </p>
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-primary-400">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse"/>
                Activo
              </span>
            </div>
            <div className="divide-y divide-earth-800/60">
              {[
                { code: "CONC-4821", name: "Los Andes Sur · Puno",       val: "⚠ Vence en 12 días",  cls: "text-copper-400" },
                { code: "CONC-1023", name: "San Martín I · Ancash",      val: "✓ Vigente",             cls: "text-primary-400" },
                { code: "CONC-7742", name: "Huallanca Norte · Arequipa", val: "✗ Caducada",            cls: "text-red-400" },
              ].map((r) => (
                <div key={r.code} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-5">
                    <span className="font-mono text-[10px] text-earth-500">{r.code}</span>
                    <span className="text-[12.5px] text-earth-300">{r.name}</span>
                  </div>
                  <span className={`font-mono text-[11.5px] font-bold ${r.cls}`}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ CTA ═══════════════════════════════════════ */}
      <section className="border-t border-earth-200 bg-earth-50 py-28" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">

            <div>
              <SectionLabel variant="copper">Empieza hoy</SectionLabel>
              <h2
                id="cta-heading"
                className="font-serif text-[2.5rem] leading-[1.08] tracking-[-0.02em] text-earth-950 lg:text-[3rem]"
              >
                En 5 minutos tienes tus concesiones monitoreadas
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-earth-600">
                Ingresa el RUC de los titulares que te interesan y el sistema recupera
                automáticamente el estado actual, los vencimientos y el historial de cambios.
                Sin instalación. Sin configuración técnica.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/registro"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-6 text-[14px] font-semibold text-white shadow-md shadow-primary-600/25 transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  Crear cuenta gratis <ArrowRight size={14} strokeWidth={2.5}/>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-xl border border-earth-300 px-6 text-[14px] font-medium text-earth-700 transition hover:border-earth-400 hover:bg-earth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earth-400"
                >
                  Ingresar
                </Link>
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-earth-400">
                Sin tarjeta de crédito · Acceso inmediato
              </p>
            </div>

            {/* Stats — con borde cobre en lugar de verde */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-10">
              {[
                { n: "+60K",   label: "concesiones indexadas",       sub: "en todo el Perú"          },
                { n: "25",     label: "regiones cubiertas",           sub: "cobertura nacional"        },
                { n: "3",      label: "fuentes oficiales",            sub: "INGEMMET, GEOCATMIN, más" },
                { n: "Diario", label: "frecuencia de actualización",  sub: "sin intervención manual"  },
              ].map((s) => (
                <div key={s.label} className="group">
                  <div className="mb-3 h-[3px] w-8 rounded-full bg-copper-400 transition-all duration-300 group-hover:w-12"/>
                  <p className="font-serif text-[2.4rem] leading-none tracking-[-0.02em] text-earth-950">
                    {s.n}
                  </p>
                  <p className="mt-2 text-[13px] font-semibold text-earth-800">{s.label}</p>
                  <p className="mt-0.5 text-[11px] text-earth-500">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════════════════════════════════════ */}
      <footer className="border-t border-earth-200 bg-earth-100">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <Link href="/" className="group flex items-center gap-3" aria-label="GeoConces">
              <div className="text-primary-600 transition group-hover:text-primary-700">
                <GeoLogo size={26}/>
              </div>
              <div className="leading-none">
                <p className="text-[13px] font-black uppercase tracking-[0.1em] text-earth-900">GeoConces</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-earth-400">Catastro Minero · Perú</p>
              </div>
            </Link>

            <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
              {[
                { label: "Funciones",     href: "#funciones"     },
                { label: "Cómo funciona", href: "#como-funciona" },
                { label: "Precios",       href: "/pricing"       },
                { label: "Ingresar",      href: "/login"         },
                { label: "Registrarse",   href: "/registro"      },
              ].map((n) => (
                <Link key={n.href} href={n.href} className="text-[13px] text-earth-500 transition hover:text-earth-900">
                  {n.label}
                </Link>
              ))}
            </nav>

            <p className="text-[11px] text-earth-400">© {new Date().getFullYear()} GeoConces · Perú</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ── Variante oscura de ConcRow para el panel del hero ─ */
function DarkConcRow({
  code, name, region, status, days,
}: {
  code: string; name: string; region: string;
  status: RowStatus; days?: number;
}) {
  const cfg = {
    active:      { dot: "bg-primary-400",  label: "Vigente",     cls: "text-primary-300 bg-primary-900/40 border-primary-700/40" },
    expiring:    { dot: "bg-copper-400",   label: `${days}d`,    cls: "text-copper-300  bg-copper-900/30  border-copper-700/40"  },
    expired:     { dot: "bg-red-500",      label: "Caducada",    cls: "text-red-300     bg-red-900/30     border-red-700/40"     },
    opportunity: { dot: "bg-amber-400",    label: "Oportunidad", cls: "text-amber-300   bg-amber-900/30   border-amber-700/40"   },
  }[status];

  return (
    <div className="flex items-center gap-3 border-b border-white/6 px-4 py-[10px] last:border-0 transition-colors hover:bg-white/4">
      <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${cfg.dot}`} aria-hidden="true"/>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-semibold text-white/80">{name}</p>
        <p className="font-mono text-[9.5px] tracking-wide text-white/30">{code} · {region}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-[2px] text-[9.5px] font-bold ${cfg.cls}`}>
        {cfg.label}
      </span>
    </div>
  );
}
