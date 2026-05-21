import type { ConcessionListItem } from "@/types/concessions";

export default function ConcessionList({
  concessions,
}: {
  concessions: ConcessionListItem[];
}) {
  return (
    <div className="space-y-3">
      {concessions.map((concession) => (
        <div
          key={concession.id}
          className="rounded-xl border bg-white p-4 shadow-sm"
        >
          <p className="font-semibold text-slate-900">{concession.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {concession.code} · {concession.holder_name || "Sin titular"}
          </p>
        </div>
      ))}
    </div>
  );
}
