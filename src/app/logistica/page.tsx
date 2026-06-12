import { ComingSoon } from "@/components/ComingSoon";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function LogisticaPage() {
  const t = getDictionary(await getLocale());
  return (
    <ComingSoon
      title={t.nav.logistica}
      description={t.common.comingSoonDesc}
      tag={t.common.comingSoon}
    />
  );
}
