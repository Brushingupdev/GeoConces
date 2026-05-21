import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export interface DashboardQuickActionItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

function QuickActionIllustration({ variant }: { variant: "map" | "search" }) {
  if (variant === "map") {
    return (
      <svg viewBox="0 0 112 112" className="h-[92px] w-[92px]" fill="none" aria-hidden="true">
        <path
          d="M21 30L45 18L70 28L92 20V79L69 91L45 81L21 92V30Z"
          fill="#d9f1ee"
          stroke="#0f7770"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M45 18V81M70 28V91" stroke="#0f7770" strokeWidth="1" opacity="0.45" />
        <path
          d="M30 42C42 37 48 45 59 39C70 33 76 36 86 31M29 60C40 55 48 64 59 58C71 52 77 56 87 50M30 75C43 69 49 77 59 72C70 67 78 70 88 63"
          stroke="#0f7770"
          strokeWidth="1"
          opacity="0.3"
        />
        <path
          d="M47 50L58 43L70 50L74 64L64 74H49L39 63L47 50Z"
          fill="#5aaea7"
          stroke="#0f7770"
          strokeWidth="1.4"
        />
        <circle cx="58" cy="59" r="6" fill="#0f7770" opacity="0.22" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 112 112" className="h-[92px] w-[92px]" fill="none" aria-hidden="true">
      <path
        d="M22 28L46 18L70 28L91 20V78L68 90L45 80L22 91V28Z"
        fill="#fae7c8"
        stroke="#d09a3b"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity="0.78"
      />
      <path
        d="M31 43C42 37 50 45 60 39C70 34 76 37 86 32M30 61C42 55 50 64 60 58C71 53 77 56 87 51"
        stroke="#d09a3b"
        strokeWidth="1"
        opacity="0.32"
      />
      <circle cx="50" cy="54" r="18" fill="#f8fbfb" stroke="#334155" strokeWidth="4" />
      <path d="M64 68L82 86" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="54" r="11" stroke="#0f7770" strokeWidth="1.4" opacity="0.5" />
    </svg>
  );
}

export default function DashboardQuickActions({
  title,
  description,
  actions,
}: {
  title?: string;
  description?: string;
  actions: DashboardQuickActionItem[];
}) {
  return (
    <section className="rounded-[8px] border border-[#dce8e6] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:px-6">
      {title ? <h3 className="text-[1.18rem] font-semibold tracking-tight text-slate-950">{title}</h3> : null}
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}

      <div className="mt-5 grid gap-4">
        {actions.slice(0, 2).map((action, index) => (
          <Link
            key={action.label}
            href={action.href}
            className={`group flex min-h-[158px] items-center justify-between gap-6 rounded-[16px] border px-5 py-5 transition ${
              index === 0
                ? "border-[#d8e8e4] bg-[linear-gradient(135deg,#edf7f6_0%,#f7fbfb_100%)] hover:border-[#c7ddd8]"
                : "border-[#efe3cf] bg-[linear-gradient(135deg,#fbf3e6_0%,#fffaf2_100%)] hover:border-[#e3d2b8]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-5">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center">
                <QuickActionIllustration variant={index === 0 ? "map" : "search"} />
              </div>
              <div className="min-w-0">
                <p className="text-[1.1rem] font-semibold text-slate-950">{action.label}</p>
                <p className="mt-2 max-w-[230px] text-sm leading-7 text-slate-600">{action.description}</p>
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-800 transition group-hover:translate-x-0.5 group-hover:text-primary-950">
              <ArrowRight size={18} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
