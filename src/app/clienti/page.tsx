import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { getClients } from "@/lib/clients";
import { getDictionary, getLocale } from "@/i18n/server";
import { ClientsExplorer } from "./ClientsExplorer";

export default async function ClientiPage() {
  const t = getDictionary(await getLocale());
  const clients = getClients();

  return (
    <div>
      <PageHeader
        title={t.clients.title}
        subtitle={t.clients.subtitle}
        actions={
          <>
            <button
              title={t.common.comingSoon}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{t.common.import}</span>
            </button>
            <button
              title={t.common.comingSoon}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-600"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t.common.newClient}</span>
            </button>
          </>
        }
      />
      <ClientsExplorer clients={clients} />
    </div>
  );
}
