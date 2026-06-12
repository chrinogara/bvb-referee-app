import type { Locale } from "@/types";

export const LOCALES: Locale[] = ["it", "fr"];
export const DEFAULT_LOCALE: Locale = "it";
export const LOCALE_COOKIE = "crm_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  it: "Italiano",
  fr: "Français",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "it" || value === "fr";
}
