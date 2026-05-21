import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Upload } from "lucide-react";

type DashboardHeroPanelAction = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

function PeruGraphic() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] lg:block">
      <svg viewBox="0 0 520 360" className="h-full w-full opacity-95">
        <defs>
          <pattern id="topoLines" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M0 50 C30 20, 80 20, 110 50 S190 80, 220 50" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>
            <path d="M-10 88 C25 58, 85 58, 118 88 S200 118, 235 88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
            <path d="M10 120 C45 95, 100 95, 128 120 S205 145, 235 120" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="520" height="360" fill="url(#topoLines)" />
        <path
          d="M314 30 L349 58 L342 84 L367 112 L357 142 L384 183 L372 214 L378 244 L363 274 L337 307 L309 323 L285 315 L271 290 L248 262 L239 232 L224 206 L227 174 L209 149 L214 117 L236 98 L252 67 L280 46 Z"
          fill="rgba(210,245,239,0.10)"
          stroke="rgba(231,255,250,0.92)"
          strokeWidth="2"
        />
        {[
          [298, 90], [318, 104], [326, 122], [308, 138], [286, 154], [334, 166], [320, 190],
          [294, 178], [280, 201], [306, 224], [323, 243], [347, 220], [353, 194], [341, 134],
          [286, 109], [268, 130], [257, 170], [270, 234], [303, 272], [328, 287], [349, 266],
          [355, 96], [309, 58], [246, 202], [233, 143], [275, 247],
        ].map(([cx, cy], index) => (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r="3"
            fill="rgba(255,255,255,0.9)"
            filter="url(#glow)"
          />
        ))}
      </svg>
    </div>
  );
}

export default function DashboardHeroPanel({
  title,
  description,
  primaryAction,
}: {
  title: string;
  description: string;
  primaryAction: DashboardHeroPanelAction;
}) {
  const PrimaryIcon = primaryAction.icon || Upload;

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#dce8e6] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="relative min-h-[268px] overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#063b39_0%,#0b4c48_55%,#083634_100%)] px-10 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(120,255,236,0.12),_transparent_34%)]" />
        <PeruGraphic />
        <div className="relative max-w-[520px] text-white">
          <h2 className="max-w-[360px] text-[2.35rem] font-semibold leading-[1.08] tracking-tight">
            {title}
          </h2>
          <p className="mt-4 max-w-[430px] text-[1.05rem] leading-8 text-white/84">
            {description}
          </p>

          <div className="mt-8">
            <Link
              href={primaryAction.href}
              className="inline-flex h-14 min-w-[230px] items-center justify-center gap-3 rounded-[14px] bg-white px-6 text-base font-semibold text-primary-900 shadow-[0_18px_36px_rgba(7,36,35,0.2)] transition hover:bg-slate-50"
            >
              <PrimaryIcon size={18} />
              {primaryAction.label}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
