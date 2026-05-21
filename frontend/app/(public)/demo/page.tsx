import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-6 text-center">
      <h1 className="font-serif text-3xl text-earth-950">Demo interactivo</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-earth-500">
        La mejor forma de ver GeoConces en acción es con tu propia cuenta.
        Crea una en segundos, sin tarjeta de crédito.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/registro"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-6 text-[14px] font-semibold text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-700"
        >
          Crear cuenta gratis <ArrowRight size={14} />
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center rounded-xl border border-earth-200 px-6 text-[14px] font-medium text-earth-600 transition hover:bg-earth-100"
        >
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}
