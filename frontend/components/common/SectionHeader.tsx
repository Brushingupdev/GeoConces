export default function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950 lg:text-[2.4rem]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
