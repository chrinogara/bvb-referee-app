"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/cn";

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale } = useI18n();

  function setLocale(next: string) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={cn(
            "rounded-md px-2 py-1 uppercase transition-colors",
            locale === l
              ? "bg-accent text-white"
              : "text-zinc-500 hover:text-zinc-900",
          )}
          aria-pressed={locale === l}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
