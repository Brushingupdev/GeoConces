import Link from "next/link";
import { Map, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-6 text-center">

      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5 text-primary-600">
        <svg width="32" height="36" viewBox="0 0 40 44" fill="none" aria-hidden="true">
          <path d="M20 2 L37 11.5 L37 32.5 L20 42 L3 32.5 L3 11.5 Z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round"/>
          <line x1="9" y1="17" x2="31" y2="17" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
          <line x1="7" y1="22" x2="33" y2="22" stroke="currentColor" strokeWidth="1.8" opacity="0.65" strokeLinecap="round"/>
          <line x1="9" y1="27" x2="31" y2="27" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
          <circle cx="20" cy="33" r="2.8" fill="currentColor" opacity="0.9"/>
        </svg>
        <span className="text-[15px] font-black uppercase tracking-[0.1em] text-earth-900">GeoConces</span>
      </Link>

      {/* 404 — grande, tipográfico */}
      <p className="font-serif text-[8rem] leading-none tracking-tight text-earth-200 select-none">
        404
      </p>

      <h1 className="mt-2 font-serif text-2xl text-earth-900">
        Concesión no encontrada
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-earth-500">
        La ruta que buscas no existe o fue movida.
        Verifica la URL o regresa al inicio.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          Ir al dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-earth-200 px-5 text-sm font-medium text-earth-600 transition hover:bg-earth-100"
        >
          <ArrowLeft size={14} /> Inicio
        </Link>
      </div>
    </div>
  );
}
