import { ComingSoon } from "@/components/ComingSoon";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function CatalogoPage() {
  const t = getDictionary(await getLocale());
  return (
    <ComingSoon
      title={t.nav.catalogo}
      description={t.common.comingSoonDesc}
      tag={t.common.comingSoon}
    />
  );
}
