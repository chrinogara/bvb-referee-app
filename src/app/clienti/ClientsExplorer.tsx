"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  LayoutGrid,
  MapPinned,
  Rows3,
  Search,
} from "lucide-react";
import { CategoryBadge, StatusBadge } from "@/components/ui/badges";
import { Card } from "@/components/ui/page";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/cn";
import { CLIENT_CATEGORIES, CLIENT_STATUSES, type Client } from "@/types";

type View = "table" | "cards" | "map";

export function ClientsExplorer({ clients }: { clients: Client[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<View>("table");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (status && c.status !== status) return false;
      if (needle) {
        const hay = `${c.name} ${c.city ?? ""} ${c.postalCode ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [clients, q, cat, status]);

  const hasFilters = q !== "" || cat !== "" || status !== "";
  function reset() {
    setQ("");
    setCat("");
    setStatus("");
  }

  const views: { id: View; icon: typeof Rows3; label: string }[] = [
    { id: "table", icon: Rows3, label: t.clients.views.table },
    { id: "cards", icon: LayoutGrid, label: t.clients.views.cards },
    { id: "map", icon: MapPinned, label: t.clients.views.map },
  ];

  return (
    <div>
      {/* Toolbar */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${t.common.search}…`}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>

          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-accent"
          >
            <option value="">{t.clients.filters.allCategories}</option>
            {CLIENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.category[c]}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-accent"
          >
            <option value="">{t.clients.filters.allStatuses}</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={reset}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900"
            >
              {t.common.resetFilters}
            </button>
          )}

          <div className="ml-auto flex items-center rounded-lg border border-zinc-200 bg-white p-0.5">
            {views.map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  title={v.label}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    view === v.id
                      ? "bg-accent text-white"
                      : "text-zinc-500 hover:text-zinc-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="mb-2 px-1 text-sm text-zinc-500">
        {filtered.length} {t.clients.title.toLowerCase()}
      </div>

      {/* Views */}
      {view === "map" ? (
        <Card className="flex min-h-[320px] items-center justify-center p-10 text-center text-sm text-zinc-500">
          {t.clients.mapPlaceholder}
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/clienti/${c.id}`}>
              <Card className="p-4 transition hover:border-accent/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-zinc-900">{c.name}</div>
                  <StatusBadge status={c.status} label={t.status[c.status]} />
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  {c.postalCode} {c.city}
                </div>
                <div className="mt-3">
                  <CategoryBadge category={c.category} label={t.category[c.category]} />
                </div>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-zinc-500">
              {t.clients.empty}
            </p>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">{t.clients.columns.name}</th>
                  <th className="px-4 py-3">{t.clients.columns.category}</th>
                  <th className="hidden px-4 py-3 md:table-cell">
                    {t.clients.columns.city}
                  </th>
                  <th className="hidden px-4 py-3 lg:table-cell">
                    {t.clients.columns.phone}
                  </th>
                  <th className="px-4 py-3">{t.clients.columns.status}</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/clienti/${c.id}`)}
                    className="cursor-pointer transition-colors hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{c.name}</div>
                      <div className="text-xs text-zinc-400">{c.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge
                        category={c.category}
                        label={t.category[c.category]}
                      />
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                      {c.postalCode} {c.city}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-400 lg:table-cell">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} label={t.status[c.status]} />
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-zinc-500"
                    >
                      {t.clients.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
