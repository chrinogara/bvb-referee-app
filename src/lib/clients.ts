import { CLIENTS } from "@/data/clients.seed";
import {
  CLIENT_CATEGORIES,
  CLIENT_STATUSES,
  type Client,
  type ClientCategory,
  type ClientStatus,
} from "@/types";

/**
 * Data-access layer for the Clients module. Currently backed by the typed
 * seed dataset; designed to be swapped for Supabase queries (same signatures)
 * in the next increment without touching the UI.
 */

export function getClients(): Client[] {
  return [...CLIENTS].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function getClientById(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id);
}

const PROVINCE_LABELS: Record<string, string> = {
  "1": "Brabant / Bruxelles",
  "4": "Liège",
  "5": "Namur",
  "6": "Hainaut — Charleroi",
  "7": "Hainaut — Mons",
};

export interface ClientStats {
  total: number;
  byStatus: Record<ClientStatus, number>;
  byCategory: Record<ClientCategory, number>;
  byProvince: { key: string; label: string; count: number }[];
  cities: number;
}

export function getClientStats(): ClientStats {
  const byStatus = Object.fromEntries(
    CLIENT_STATUSES.map((s) => [s, 0]),
  ) as Record<ClientStatus, number>;
  const byCategory = Object.fromEntries(
    CLIENT_CATEGORIES.map((c) => [c, 0]),
  ) as Record<ClientCategory, number>;
  const provinceCounts = new Map<string, number>();
  const citySet = new Set<string>();

  for (const c of CLIENTS) {
    byStatus[c.status] += 1;
    byCategory[c.category] += 1;
    if (c.city) citySet.add(c.city);
    const digit = c.postalCode?.[0] ?? "?";
    provinceCounts.set(digit, (provinceCounts.get(digit) ?? 0) + 1);
  }

  const byProvince = [...provinceCounts.entries()]
    .map(([key, count]) => ({
      key,
      label: PROVINCE_LABELS[key] ?? "Altro",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: CLIENTS.length,
    byStatus,
    byCategory,
    byProvince,
    cities: citySet.size,
  };
}
