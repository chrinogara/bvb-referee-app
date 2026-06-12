import "./globals.css";
import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Srl Chrisa — CRM",
  description:
    "CRM aziendale Srl Chrisa — clienti, catalogo, flotta, autisti e logistica.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} dictionary={dictionary}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
