# Handoff — CRM Srl Chrisa → repository autonomo `crm-chrisa`

Questo archivio contiene il CRM aziendale di **Srl Chrisa**, pronto a vivere nel
suo repository dedicato e indipendente.

## Come ripartire nella nuova sessione (repo `crm-chrisa`)
1. Estrai l'archivio nella root del progetto (sovrascrivendo il README iniziale).
2. `npm install`
3. `npm run build` (verifica) oppure `npm run dev` → http://localhost:3000
4. Commit + push su `crm-chrisa`, poi collega il repo a **Vercel** e deploya
   (per l'incremento attuale **non servono variabili d'ambiente**).

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase · Vercel · i18n IT/FR

## Stato — Incremento 1 completato
- Shell applicativa: sidebar professionale, topbar, ricerca, selettore lingua IT/FR
- Dashboard con KPI e grafici reali sui **71 clienti** Srl Chrisa
- Modulo **Clienti**: lista (ricerca/filtri/viste tabella·schede·mappa) + scheda a 3 pannelli
- 71 clienti reali in `src/data/clients.seed.ts` (fonte unica per UI e seed)
- Schema Supabase del modulo Clienti (RLS) in `supabase/migrations/0001_init_clients.sql`
- Moduli futuri navigabili come placeholder

## Roadmap prossimi incrementi
1. Supabase **live** + **Auth** (login) + CRUD clienti + import 71 clienti + geocoding → Mappa
2. **Catalogo** prodotti (listini Nonna Ida: Frais/Surgelés/Gastronomie) per iPad
3. **Flotta** (3 Iveco Daily refrigerati) · **Autisti** · **Logistica** (PDF + estrazione AI)
4. **Documenti**, **Scadenze/Alert**, **Mappa**, **Business Intelligence**

## Riferimenti azienda
Srl Chrisa — 6150 Anderlues (BE) — tel. 0496 48 27 07 — BCE/KBO 0778.905.743

## Note di design
- Palette: grafite/inchiostro + accento bordeaux (ispirata al logo monocromatico).
- Bilingue IT/FR con selettore per utente (cookie `crm_locale`).
- La UI dell'incremento 1 usa i 71 clienti come dataset reale: nessun segreto
  richiesto per il deploy attuale. Il collegamento live a Supabase è l'incremento 2.
