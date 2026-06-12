import { Hammer } from "lucide-react";

export function ComingSoon({
  title,
  description,
  tag,
}: {
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white/60 p-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Hammer className="h-7 w-7" />
      </div>
      <span className="mb-3 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
        {tag}
      </span>
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500">{description}</p>
    </div>
  );
}
