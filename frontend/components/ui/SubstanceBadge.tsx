const SUBSTANCE_TYPES = [
  { value: "Metálica",    color: "bg-amber-50  text-amber-700  border-amber-200"  },
  { value: "No metálica", color: "bg-sky-50    text-sky-700    border-sky-200"    },
  { value: "Energética",  color: "bg-orange-50 text-orange-700 border-orange-200" },
];

function normalizeSubstance(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("no metálica") || t.includes("no metalífera") || t === "nm" || t === "n") return "No metálica";
  if (t.includes("metálica") || t.includes("metalífera") || t === "m") return "Metálica";
  if (t.includes("energética") || t === "e") return "Energética";
  return type;
}

export default function SubstanceBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-slate-300 text-xs">—</span>;
  const canonical = normalizeSubstance(type);
  const found = SUBSTANCE_TYPES.find((s) => s.value.toLowerCase() === canonical.toLowerCase());
  const color = found?.color ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${color}`}>
      {canonical}
    </span>
  );
}
