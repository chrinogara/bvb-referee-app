// ─── Domain types ───────────────────────────────────────────

export type Locale = "it" | "fr";

export type ClientCategory =
  | "gms"
  | "horeca"
  | "traiteur"
  | "epicerie"
  | "distributeur"
  | "autre";

export type ClientStatus = "actif" | "inactif" | "prospect" | "a_contacter";

export interface Client {
  /** Stable code used as the URL identifier (e.g. "CL-0003"). */
  id: string;
  code: string;
  name: string;
  category: ClientCategory;
  status: ClientStatus;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[];
  notes: string | null;
  lastContactAt: string | null;
}

export const CLIENT_CATEGORIES: ClientCategory[] = [
  "gms",
  "horeca",
  "traiteur",
  "epicerie",
  "distributeur",
  "autre",
];

export const CLIENT_STATUSES: ClientStatus[] = [
  "actif",
  "inactif",
  "prospect",
  "a_contacter",
];
