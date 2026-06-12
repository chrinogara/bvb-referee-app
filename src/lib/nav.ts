import {
  BarChart3,
  BellRing,
  Building2,
  CircleUserRound,
  FileText,
  LayoutDashboard,
  Map,
  Package,
  Route,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (t: Dictionary) => string;
}

export interface NavSection {
  title: (t: Dictionary) => string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: (t) => t.nav.sectionMain,
    items: [
      { href: "/", icon: LayoutDashboard, label: (t) => t.nav.dashboard },
      { href: "/clienti", icon: Users, label: (t) => t.nav.clienti },
      { href: "/catalogo", icon: Package, label: (t) => t.nav.catalogo },
    ],
  },
  {
    title: (t) => t.nav.sectionOps,
    items: [
      { href: "/flotta", icon: Truck, label: (t) => t.nav.flotta },
      { href: "/autisti", icon: CircleUserRound, label: (t) => t.nav.autisti },
      { href: "/logistica", icon: Route, label: (t) => t.nav.logistica },
    ],
  },
  {
    title: (t) => t.nav.sectionData,
    items: [
      { href: "/documenti", icon: FileText, label: (t) => t.nav.documenti },
      { href: "/scadenze", icon: BellRing, label: (t) => t.nav.scadenze },
      { href: "/mappa", icon: Map, label: (t) => t.nav.mappa },
      { href: "/bi", icon: BarChart3, label: (t) => t.nav.bi },
      { href: "/azienda", icon: Building2, label: (t) => t.nav.azienda },
      { href: "/impostazioni", icon: Settings, label: (t) => t.nav.impostazioni },
    ],
  },
];
