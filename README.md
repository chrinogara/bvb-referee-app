# Srl Chrisa — CRM

CRM aziendale di **Srl Chrisa** (Anderlues, BE) — distribuzione alimentare.
Centro operativo per clienti, catalogo prodotti, flotta, autisti, logistica,
documenti, scadenze e business intelligence.

> ⚠️ Questo branch (`claude/charming-sagan-q2hs86`) ospita il CRM. L'app
> "BVB Referee" originale resta intatta sugli altri branch / nello storico git.

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** — design system enterprise (palette grafite + accento bordeaux)
- **Supabase** (Postgres + Auth + Storage + RLS) — backend
- **Vercel** — deploy
- **i18n IT/FR** bilingue, con selettore di lingua per utente (cookie)

## Stato — Incremento 1: Fondamenta + Modulo Clienti

✅ Shell applicativa (sidebar professionale, topbar, ricerca, selettore lingua)
✅ Dashboard con KPI e grafici reali sui **71 clienti** Srl Chrisa
✅ **Clienti**: lista con ricerca, filtri (categoria/stato), viste Tabella/Schede/Mappa
✅ **Scheda cliente** a 3 pannelli (riepilogo + azioni, tab, rail collegamenti)
✅ Bilingue IT/FR su tutta l'interfaccia
✅ Schema Supabase del modulo Clienti (`supabase/migrations/0001_init_clients.sql`)
✅ Moduli futuri già navigabili (placeholder): Catalogo, Flotta, Autisti, Logistica…

### Prossimi incrementi
1. Supabase live + **Auth** (login) + lettura/scrittura dati + form crea/modifica cliente
2. Import automatico clienti + **geocoding** indirizzi → Mappa
3. Catalogo prodotti (listini Nonna Ida) per iPad
4. Flotta (3 Iveco Daily) · Autisti · Logistica (PDF + estrazione AI)

## Avvio locale

```bash
npm install
cp .env.example .env.local   # inserisci le chiavi Supabase
npm run dev                  # http://localhost:3000
```

## Struttura

```
src/
  app/                 # route (App Router): dashboard, clienti, moduli…
  components/
    layout/            # Sidebar, Topbar, AppShell, LanguageSwitcher
    ui/                # badge, card, page header
  data/                # dataset reale 71 clienti (fonte di seed)
  i18n/                # dizionari IT/FR + provider + helper server
  lib/                 # accesso dati clienti, navigazione, utility
  types.ts             # tipi di dominio
supabase/migrations/   # schema SQL
```
