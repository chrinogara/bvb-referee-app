"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { CategoryBadge, StatusBadge } from "@/components/ui/badges";
import { Card } from "@/components/ui/page";
import { useI18n } from "@/i18n/provider";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { Client } from "@/types";

const TABS = [
  "general",
  "contacts",
  "location",
  "activity",
  "reminders",
  "issues",
  "documents",
  "history",
] as const;
type Tab = (typeof TABS)[number];

export function ClientDetail({ client }: { client: Client }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("general");

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${client.address ?? ""} ${client.postalCode ?? ""} ${client.city ?? ""} Belgique`,
  )}`;

  const actions: { icon: LucideIcon; label: string }[] = [
    { icon: StickyNote, label: t.client.actions.note },
    { icon: Phone, label: t.client.actions.call },
    { icon: Mail, label: t.client.actions.email },
    { icon: MapPin, label: t.client.actions.visit },
    { icon: Bell, label: t.client.actions.reminder },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/clienti"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" /> {t.clients.title}
        </Link>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
          <Pencil className="h-4 w-4" /> {t.common.edit}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_300px]">
        {/* LEFT — summary */}
        <div className="space-y-4">
          <Card className="p-5">
            <h1 className="text-lg font-semibold leading-tight text-zinc-900">
              {client.name}
            </h1>
            <div className="mt-1 text-xs text-zinc-400">{client.code}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CategoryBadge category={client.category} label={t.category[client.category]} />
              <StatusBadge status={client.status} label={t.status[client.status]} />
            </div>
            <div className="mt-5 grid grid-cols-5 gap-1">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    title={a.label}
                    className="flex flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-[10px] text-zinc-600 transition hover:bg-zinc-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Icon className="h-4 w-4" />
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
              <MapPin className="h-7 w-7" />
            </div>
            <div className="p-4">
              <div className="text-sm text-zinc-700">{client.address}</div>
              <div className="text-sm text-zinc-500">
                {client.postalCode} {client.city}
              </div>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {t.client.general.openInMaps}
              </a>
            </div>
          </Card>
        </div>

        {/* CENTER — tabs */}
        <Card className="overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-2">
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition",
                  tab === tb
                    ? "border-accent text-accent"
                    : "border-transparent text-zinc-500 hover:text-zinc-800",
                )}
              >
                {t.client.tabs[tb]}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === "general" ? (
              <GeneralTab client={client} t={t} />
            ) : (
              <div className="py-12 text-center text-sm text-zinc-400">
                {t.client.placeholderTab}
              </div>
            )}
          </div>
        </Card>

        {/* RIGHT — related rail */}
        <div className="space-y-4">
          <RailCard
            title={t.client.rail.primaryContact}
            empty={t.client.rail.noContact}
            actionIcon={Plus}
            actionLabel={t.client.rail.addContact}
          />
          <RailCard
            title={t.client.rail.reminders}
            empty={t.client.rail.noReminders}
            actionIcon={Plus}
            actionLabel={t.client.rail.newReminder}
          />
          <RailCard title={t.client.rail.alerts} empty={t.client.rail.noAlerts} />
          <RailCard
            title={t.client.rail.documents}
            empty={t.client.rail.noDocuments}
            actionIcon={Plus}
            actionLabel={t.client.rail.uploadDoc}
          />
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ client, t }: { client: Client; t: Dictionary }) {
  const g = t.client.general;
  const dash = g.none;
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {g.title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <Field label={g.address}>
          {client.address ? `${client.address}, ${client.postalCode} ${client.city}` : dash}
        </Field>
        <Field label={g.vat}>{client.vatNumber ?? dash}</Field>
        <Field label={g.category}>
          <CategoryBadge category={client.category} label={t.category[client.category]} />
        </Field>
        <Field label={g.status}>
          <StatusBadge status={client.status} label={t.status[client.status]} />
        </Field>
        <Field label={g.tags}>
          {client.tags.length > 0 ? client.tags.join(", ") : dash}
        </Field>
        <Field label={g.lastContact}>{client.lastContactAt ?? dash}</Field>
        <div className="sm:col-span-2">
          <Field label={g.notes}>{client.notes ?? dash}</Field>
        </div>
      </dl>

      <h3 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {g.recentActivity}
      </h3>
      <p className="py-6 text-center text-sm text-zinc-400">{t.common.noResults}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 py-3">
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-800">{children}</dd>
    </div>
  );
}

function RailCard({
  title,
  empty,
  actionIcon: ActionIcon,
  actionLabel,
}: {
  title: string;
  empty: string;
  actionIcon?: LucideIcon;
  actionLabel?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h3>
        {ActionIcon && (
          <button
            title={actionLabel}
            className="text-zinc-400 transition hover:text-accent"
          >
            <ActionIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-zinc-400">{empty}</p>
    </Card>
  );
}
