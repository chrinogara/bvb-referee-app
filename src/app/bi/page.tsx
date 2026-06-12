import { ComingSoon } from "@/components/ComingSoon";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function BiPage() {
  const t = getDictionary(await getLocale());
  return (
    <ComingSoon
      title={t.nav.bi}
      description={t.common.comingSoonDesc}
      tag={t.common.comingSoon}
    />
  );
}
