import {
  MapPin,
  PhoneOutgoing,
  Truck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardTitle, PageHeader } from "@/components/ui/page";
import { CATEGORY_BAR } from "@/components/ui/badges";
import { getClientStats } from "@/lib/clients";
import { getDictionary, getLocale } from "@/i18n/server";
import { CLIENT_CATEGORIES } from "@/types";

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{label}</span>
        <span
          className={
            accent
              ? "flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"
              : "flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500"
          }
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const t = getDictionary(await getLocale());
  const stats = getClientStats();

  const categoryRows = CLIENT_CATEGORIES.map((c) => ({
    cat: c,
    label: t.category[c],
    count: stats.byCategory[c],
  })).filter((r) => r.count > 0);
  const catMax = Math.max(...categoryRows.map((r) => r.count), 1);
  const provMax = Math.max(...stats.byProvince.map((r) => r.count), 1);

  return (
    <div>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label={t.dashboard.kpi.clients} value={stats.total} accent />
        <Kpi icon={UserCheck} label={t.dashboard.kpi.active} value={stats.byStatus.actif} />
        <Kpi
          icon={PhoneOutgoing}
          label={t.dashboard.kpi.toContact}
          value={stats.byStatus.a_contacter}
        />
        <Kpi icon={MapPin} label={t.dashboard.charts.clientsByProvince} value={stats.cities} />
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>{t.dashboard.charts.clientsByCategory}</CardTitle>
          <div className="mt-4 space-y-3">
            {categoryRows.map((r) => (
              <div key={r.cat} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-sm text-zinc-600">{r.label}</div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${CATEGORY_BAR[r.cat]}`}
                    style={{ width: `${(r.count / catMax) * 100}%` }}
                  />
                </div>
                <div className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-zinc-900">
                  {r.count}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle>{t.dashboard.charts.clientsByProvince}</CardTitle>
          <div className="mt-4 space-y-3">
            {stats.byProvince.map((r) => (
              <div key={r.key} className="flex items-center gap-3">
                <div className="w-36 shrink-0 truncate text-sm text-zinc-600">
                  {r.label}
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(r.count / provMax) * 100}%` }}
                  />
                </div>
                <div className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-zinc-900">
                  {r.count}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Widgets */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <CardTitle>{t.dashboard.widgets.recentActivity}</CardTitle>
          <p className="mt-6 text-center text-sm text-zinc-400">
            {t.dashboard.widgets.none}
          </p>
        </Card>

        <Card className="p-5">
          <CardTitle>{t.nav.flotta}</CardTitle>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-semibold text-zinc-900">3</div>
              <div className="text-xs text-zinc-500">Iveco Daily — {t.common.comingSoon}</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-400">{t.dashboard.widgets.seedNote}</p>
        </Card>

        <Card className="p-5">
          <CardTitle>{t.dashboard.widgets.upcomingDeadlines}</CardTitle>
          <p className="mt-6 text-center text-sm text-zinc-400">
            {t.dashboard.widgets.none}
          </p>
        </Card>
      </div>
    </div>
  );
}
