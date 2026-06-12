import { Building2, Hash, MapPin, Phone } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/page";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function AziendaPage() {
  const t = getDictionary(await getLocale());

  const rows = [
    { icon: Building2, label: "Srl Chrisa", value: "Société à responsabilité limitée" },
    { icon: MapPin, label: t.client.general.address, value: "6150 Anderlues, Belgique" },
    { icon: Phone, label: "Tél.", value: "0496 48 27 07" },
    { icon: Hash, label: "BCE / KBO", value: "0778.905.743" },
  ];

  return (
    <div>
      <PageHeader title={t.nav.azienda} subtitle="Srl Chrisa — Anderlues" />
      <Card className="max-w-2xl divide-y divide-zinc-100">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-900">{r.label}</div>
                <div className="text-sm text-zinc-500">{r.value}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
