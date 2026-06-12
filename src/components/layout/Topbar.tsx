"use client";

import { Bell, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/i18n/provider";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          placeholder={t.common.searchPlaceholder}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <Link
          href="/clienti"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-600"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">{t.common.newClient}</span>
        </Link>
        <button
          className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
          SC
        </div>
      </div>
    </header>
  );
}
