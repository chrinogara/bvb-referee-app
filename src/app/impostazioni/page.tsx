import { ComingSoon } from "@/components/ComingSoon";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function ImpostazioniPage() {
  const t = getDictionary(await getLocale());
  return (
    <ComingSoon
      title={t.nav.impostazioni}
      description={t.common.comingSoonDesc}
      tag={t.common.comingSoon}
    />
  );
}
