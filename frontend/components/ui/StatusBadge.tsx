/** Unified concession-status badge with Spanish labels. */

const STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: "Vigente",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  expired:   { label: "Caducada",   cls: "bg-red-100    text-red-700    border-red-200"    },
  pending:   { label: "Pendiente",  cls: "bg-amber-100  text-amber-700  border-amber-200"  },
  suspended: { label: "Suspendida", cls: "bg-slate-100  text-slate-600  border-slate-200"  },
};

export default function StatusBadge({ status }: { status: string }) {
  const { label, cls } = STATUS[status] ?? STATUS.suspended;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
