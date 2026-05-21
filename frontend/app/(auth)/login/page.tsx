"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

function GeoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" fill="none" className={className} aria-hidden>
      <path d="M20 2 L37 11.5 L37 32.5 L20 42 L3 32.5 L3 11.5 Z"
        stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <line x1="9"  y1="17" x2="31" y2="17" stroke="currentColor" strokeWidth="1.4" opacity="0.4" strokeLinecap="round"/>
      <line x1="7"  y1="22" x2="33" y2="22" stroke="currentColor" strokeWidth="1.8" opacity="0.65" strokeLinecap="round"/>
      <line x1="9"  y1="27" x2="31" y2="27" stroke="currentColor" strokeWidth="1.4" opacity="0.4" strokeLinecap="round"/>
      <circle cx="20" cy="33" r="2.8" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function LoginForm() {
  const router      = useRouter();
  const params      = useSearchParams();
  const setAuth     = useAuthStore((s) => s.setAuth);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const justRegistered = params.get("registered") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      const { access_token, refresh_token } = res.data;
      localStorage.setItem("refresh_token", refresh_token);
      const me = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      setAuth(me.data, access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[360px] mx-auto">
      {/* Mobile logo */}
      <div className="flex items-center gap-2.5 mb-10 lg:hidden">
        <GeoMark size={28} className="text-primary-700" />
        <span className="text-lg font-semibold text-primary-900 tracking-tight">GeoConces</span>
      </div>

      <h2 className="text-[1.75rem] font-bold text-slate-900 tracking-tight">Inicia sesión</h2>
      <p className="mt-1.5 text-sm text-slate-500 mb-8">Accede a tu cuenta de GeoConces</p>

      {justRegistered && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">
          Cuenta creada. Ingresa con tus credenciales.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contraseña
            </label>
            <Link href="/recuperar-password"
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100"
            />
            <button type="button" onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Ingresando…" : "Ingresar a GeoConces"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary-700 hover:text-primary-900 transition">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: Brand panel ── */}
      <div className="hidden lg:flex w-[420px] xl:w-[460px] shrink-0 flex-col justify-between relative overflow-hidden bg-primary-950 px-10 py-12 xl:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_0%_110%,rgba(30,139,129,0.28),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <GeoMark size={32} className="text-primary-400" />
            <span className="text-lg font-semibold text-white tracking-tight">GeoConces</span>
          </div>

          <h1 className="text-[2.4rem] xl:text-[2.7rem] font-bold text-white leading-[1.1] mb-5">
            Inteligencia<br />
            <span className="text-primary-400">geominera</span><br />
            para el Perú.
          </h1>
          <p className="text-primary-300/80 text-[15px] leading-relaxed mb-12">
            64,000+ concesiones mineras en tiempo real. Datos de INGEMMET, SIDEMCAT y GEOCATMIN en una sola plataforma.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { n: "64k+", label: "Concesiones en catastro" },
              { n: "3",    label: "Fuentes oficiales" },
              { n: "IA",   label: "Score de oportunidades" },
              { n: "OCR",  label: "Expedientes digitalizados" },
            ].map(({ n, label }) => (
              <div key={label} className="rounded-xl border border-primary-800/50 bg-primary-900/40 px-4 py-3">
                <p className="text-lg font-bold text-white">{n}</p>
                <p className="text-xs text-primary-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-700">
          © {new Date().getFullYear()} GeoConces · Datos públicos INGEMMET / MINEM
        </p>
      </div>

      {/* ── Right: Form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
