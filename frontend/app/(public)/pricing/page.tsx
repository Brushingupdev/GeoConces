import Link from "next/link";
import { Check, ArrowRight, Map } from "lucide-react";

const PLANS = [
  {
    name: "Gratis",
    price: "S/ 0",
    period: "/ mes",
    description: "Para empezar a explorar el catastro minero.",
    highlight: false,
    cta: { label: "Crear cuenta gratis", href: "/registro" },
    features: [
      "Hasta 3 RUCs seguidos",
      "Alertas básicas (vencimiento)",
      "Mapa interactivo",
      "Búsqueda y exploración",
      "1 reporte por mes",
    ],
    disabled: [],
  },
  {
    name: "Pro",
    price: "S/ 149",
    period: "/ mes",
    description: "Para equipos que trabajan con concesiones a diario.",
    highlight: true,
    cta: { label: "Empieza con Pro", href: "/registro?plan=pro" },
    features: [
      "Hasta 50 RUCs seguidos",
      "Alertas en tiempo real (vencimiento + estado)",
      "Mapa geoespacial completo",
      "Scoring de oportunidades",
      "Reportes ilimitados (Excel + PDF)",
      "Exportación masiva",
      "Acceso API básico",
    ],
    disabled: [],
  },
  {
    name: "Enterprise",
    price: "Consultar",
    period: "",
    description: "Para empresas mineras con grandes volúmenes de concesiones.",
    highlight: false,
    cta: { label: "Contactar ventas", href: "mailto:ventas@geoconces.pe" },
    features: [
      "RUCs ilimitados",
      "Multi-usuario y roles",
      "Integración INGEMMET en vivo",
      "Webhooks y API completa",
      "Soporte prioritario",
      "SLA garantizado",
      "Factura empresarial",
    ],
    disabled: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-earth-50">

      {/* Nav */}
      <header className="border-b border-earth-200/60 bg-earth-50/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Map size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[14px] font-black uppercase tracking-[0.1em] text-earth-900">GeoConces</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-earth-500 hover:text-earth-900 transition">Ingresar</Link>
            <Link href="/registro" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition">
              Empieza gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-20">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.22em] text-primary-600">Precios</p>
          <h1 className="font-serif text-[2.8rem] leading-[1.08] tracking-tight text-earth-950">
            Planes para cada equipo
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-earth-500 max-w-lg mx-auto">
            Desde equipos de un solo analista hasta empresas mineras con cientos de concesiones.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.highlight
                  ? "border-primary-300 bg-primary-600 text-white shadow-xl shadow-primary-600/20"
                  : "border-earth-200 bg-white shadow-sm"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-copper-500 px-3 py-1 text-[10.5px] font-bold uppercase tracking-widest text-white shadow-sm">
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-2 ${plan.highlight ? "text-primary-200" : "text-earth-400"}`}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className={`font-serif text-[2.4rem] leading-none tracking-tight ${plan.highlight ? "text-white" : "text-earth-950"}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={`text-sm ${plan.highlight ? "text-primary-200" : "text-earth-400"}`}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-[13.5px] leading-relaxed ${plan.highlight ? "text-primary-100" : "text-earth-500"}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px]">
                    <Check
                      size={14}
                      className={`mt-0.5 shrink-0 ${plan.highlight ? "text-primary-200" : "text-primary-500"}`}
                    />
                    <span className={plan.highlight ? "text-white/90" : "text-earth-700"}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.cta.href}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-white text-primary-700 hover:bg-primary-50"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                }`}
              >
                {plan.cta.label} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-sm text-earth-400">
          Todos los precios incluyen IGV · Facturación mensual · Cancela cuando quieras
        </p>
      </main>
    </div>
  );
}
