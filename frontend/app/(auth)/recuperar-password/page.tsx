"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function RecoverPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/password-reset/request", { email });
      setSent(true);
    } catch {
      setError("No se pudo enviar el correo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">

        <Link href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition">
          <ArrowLeft size={14} /> Volver al inicio de sesión
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {!sent ? (
            <>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Mail size={22} />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Recuperar contraseña</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Enviando…" : "Enviar enlace de recuperación"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Revisa tu correo</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Si <strong className="text-slate-700">{email}</strong> está registrado,
                recibirás un enlace en los próximos minutos.
              </p>
              <p className="mt-3 text-xs text-slate-400">¿No llegó? Revisa spam.</p>
              <Link href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-800 transition">
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
