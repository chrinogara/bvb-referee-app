import { ComingSoon } from "@/components/ComingSoon";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function ScadenzePage() {
  const t = getDictionary(await getLocale());
  return (
    <ComingSoon
      title={t.nav.scadenze}
      description={t.common.comingSoonDesc}
      tag={t.common.comingSoon}
    />
  );
}
