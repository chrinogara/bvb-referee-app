import { ComingSoon } from "@/components/ComingSoon";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function FlottaPage() {
  const t = getDictionary(await getLocale());
  return (
    <ComingSoon
      title={t.nav.flotta}
      description={t.common.comingSoonDesc}
      tag={t.common.comingSoon}
    />
  );
}
