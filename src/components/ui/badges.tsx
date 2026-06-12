import { cn } from "@/lib/cn";
import type { ClientCategory, ClientStatus } from "@/types";

const STATUS_STYLES: Record<ClientStatus, string> = {
  actif: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  inactif: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  prospect: "bg-sky-50 text-sky-700 ring-sky-600/20",
  a_contacter: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const STATUS_DOT: Record<ClientStatus, string> = {
  actif: "bg-emerald-500",
  inactif: "bg-zinc-400",
  prospect: "bg-sky-500",
  a_contacter: "bg-amber-500",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ClientStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {label}
    </span>
  );
}

const CATEGORY_STYLES: Record<ClientCategory, string> = {
  gms: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  horeca: "bg-rose-50 text-rose-700 ring-rose-600/20",
  traiteur: "bg-violet-50 text-violet-700 ring-violet-600/20",
  epicerie: "bg-teal-50 text-teal-700 ring-teal-600/20",
  distributeur: "bg-orange-50 text-orange-700 ring-orange-600/20",
  autre: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

export const CATEGORY_BAR: Record<ClientCategory, string> = {
  gms: "bg-indigo-500",
  horeca: "bg-rose-500",
  traiteur: "bg-violet-500",
  epicerie: "bg-teal-500",
  distributeur: "bg-orange-500",
  autre: "bg-zinc-400",
};

export function CategoryBadge({
  category,
  label,
}: {
  category: ClientCategory;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        CATEGORY_STYLES[category],
      )}
    >
      {label}
    </span>
  );
}
