"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { ArrowRight, Check, Zap } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";

const PLAN_LABELS: Record<string, string> = {
  free: "Gratis",
  pro: "Pro",
  enterprise: "Enterprise",
};

const FREE_FEATURES = ["Hasta 3 RUCs seguidos", "Alertas básicas", "Mapa interactivo", "1 reporte por mes"];
const PRO_FEATURES  = ["Hasta 50 RUCs seguidos", "Alertas en tiempo real", "Reportes ilimitados", "Scoring de oportunidades", "Exportación masiva"];

export default function FacturacionPage() {
  const { user } = useAuthStore();

  const { data: companies } = useQuery<any[]>({
    queryKey: ["companies"],
    queryFn: async () => (await api.get("/companies")).data,
  });

  const companyId = companies?.[0]?.id;

  const { data: sub } = useQuery<any>({
    queryKey: ["subscription", companyId],
    queryFn: async () => (await api.get(`/subscriptions/company/${companyId}`)).data,
    enabled: Boolean(companyId),
  });

  const plan = sub?.plan ?? "free";
  const isPro = plan === "pro" || plan === "enterprise";

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div>
      <PageHeader
        title="Facturación"
        description="Tu plan actual, uso y opciones de actualización."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-4xl">

        {/* Plan actual */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan actual</p>
              <h2 className="text-2xl font-bold text-slate-900">{PLAN_LABELS[plan] ?? plan}</h2>
              {periodEnd && (
                <p className="mt-1 text-sm text-slate-500">
                  {isPro ? "Renueva el" : "Trial vence el"} <strong className="text-slate-700">{periodEnd}</strong>
                </p>
              )}
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${isPro ? "bg-primary-50 border-primary-200 text-primary-700" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
              {isPro ? "Activo" : "Gratis"}
            </span>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Incluye:</p>
            <ul className="space-y-2">
              {(isPro ? PRO_FEATURES : FREE_FEATURES).map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Check size={14} className="text-primary-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Límites de uso */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Límites</p>
          <div className="space-y-4 text-sm">
            {[
              { label: "Usuarios", value: sub?.max_users ?? 1 },
              { label: "RUCs seguidos", value: sub?.max_watchlist_items ?? 3 },
              { label: "Mapas guardados", value: sub?.max_maps ?? 3 },
            ].map((l) => (
              <div key={l.label} className="flex justify-between">
                <span className="text-slate-500">{l.label}</span>
                <span className="font-semibold text-slate-800">{l.value === 99999 ? "Ilimitado" : l.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Upgrade CTA — solo si está en free */}
      {!isPro && (
        <div className="mt-6 max-w-4xl rounded-xl border border-primary-200 bg-primary-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <Zap size={18} />
              </div>
              <div>
                <p className="font-semibold text-primary-900">Actualiza a Pro</p>
                <p className="mt-0.5 text-sm text-primary-700">
                  Desbloquea hasta 50 RUCs, alertas en tiempo real y reportes ilimitados.
                </p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              Ver planes <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Nota */}
      <p className="mt-6 text-xs text-slate-400 max-w-xl">
        Los pagos y la gestión de suscripciones estarán disponibles próximamente.
        Para cambios de plan o facturación empresarial, contáctanos en{" "}
        <a href="mailto:ventas@geoconces.pe" className="text-primary-600 hover:underline">ventas@geoconces.pe</a>.
      </p>
    </div>
  );
}
