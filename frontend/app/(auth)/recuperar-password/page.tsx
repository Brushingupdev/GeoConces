"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api } from "@/lib/api";

export default function RecoverPasswordPage() {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

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
    <div className="min-h-screen flex items-center justify-center bg-earth-50 px-6">
      <div className="w-full max-w-md">

        {/* Back */}
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-earth-500 hover:text-earth-800 transition"
        >
          <ArrowLeft size={14} /> Volver al inicio de sesión
        </Link>

        <div className="rounded-2xl border border-earth-200 bg-white p-8 shadow-sm">

          {!sent ? (
            <>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Mail size={22} />
              </div>

              <h1 className="text-xl font-bold text-earth-950">Recuperar contraseña</h1>
              <p className="mt-2 text-sm leading-relaxed text-earth-500">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-earth-700 mb-1">
                    Correo electrónico
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" disabled={loading || !email} className="w-full" size="lg">
                  {loading ? "Enviando…" : "Enviar enlace de recuperación"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <CheckCircle size={28} />
              </div>
              <h2 className="text-lg font-bold text-earth-950">Revisa tu correo</h2>
              <p className="mt-2 text-sm leading-relaxed text-earth-500">
                Si <strong className="text-earth-700">{email}</strong> está registrado,
                recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <p className="mt-4 text-xs text-earth-400">
                ¿No llegó? Revisa tu carpeta de spam.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition"
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
