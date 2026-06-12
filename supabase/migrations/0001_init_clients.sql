-- ============================================================
--  Srl Chrisa CRM — Migration 0001 · Clients module
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
create type client_category as enum
  ('gms', 'horeca', 'traiteur', 'epicerie', 'distributeur', 'autre');

create type client_status as enum
  ('actif', 'inactif', 'prospect', 'a_contacter');

create type activity_type as enum
  ('call', 'visit', 'email', 'note', 'other');

create type issue_kind as enum ('reclamo', 'problema');
create type issue_priority as enum ('low', 'medium', 'high', 'urgent');
create type issue_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ── updated_at helper ────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Clients ──────────────────────────────────────────────────
create table clients (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,
  name            text not null,
  category        client_category not null default 'autre',
  status          client_status   not null default 'actif',
  address         text,
  postal_code     text,
  city            text,
  country         text not null default 'BE',
  lat             double precision,
  lng             double precision,
  phone           text,
  email           text,
  vat_number      text,
  tags            text[] not null default '{}',
  notes           text,
  last_contact_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index clients_category_idx on clients (category);
create index clients_status_idx   on clients (status);
create index clients_city_idx      on clients (city);
create trigger trg_clients_updated
  before update on clients for each row execute function set_updated_at();

-- ── Client contacts ──────────────────────────────────────────
create table client_contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  first_name text,
  last_name  text,
  role       text,
  phone      text,
  email      text,
  is_primary boolean not null default false,
  notes      text,
  created_at timestamptz not null default now()
);
create index client_contacts_client_idx on client_contacts (client_id);

-- ── Client activities (timeline) ─────────────────────────────
create table client_activities (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  type        activity_type not null default 'note',
  subject     text,
  body        text,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index client_activities_client_idx on client_activities (client_id);

-- ── Client reminders ─────────────────────────────────────────
create table client_reminders (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  title      text not null,
  notes      text,
  due_at     timestamptz,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index client_reminders_client_idx on client_reminders (client_id);

-- ── Client issues (réclamations + problèmes) ─────────────────
create table client_issues (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  kind        issue_kind     not null default 'problema',
  title       text not null,
  description text,
  priority    issue_priority not null default 'medium',
  status      issue_status   not null default 'open',
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index client_issues_client_idx on client_issues (client_id);

-- ── Documents (polymorphic, shared across modules) ───────────
create table documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  related_type text not null,            -- client | vehicle | driver | product | company
  related_id   uuid,
  file_path    text,
  mime_type    text,
  size_bytes   bigint,
  expiry_date  date,
  version      int not null default 1,
  created_at   timestamptz not null default now()
);
create index documents_related_idx on documents (related_type, related_id);

-- ── Row Level Security ───────────────────────────────────────
-- Authenticated users have full access; anonymous role has none.
-- (The service-role key bypasses RLS for server-side seeding/admin.)
alter table clients           enable row level security;
alter table client_contacts   enable row level security;
alter table client_activities enable row level security;
alter table client_reminders  enable row level security;
alter table client_issues     enable row level security;
alter table documents         enable row level security;

create policy "auth_all_clients"   on clients
  for all to authenticated using (true) with check (true);
create policy "auth_all_contacts"  on client_contacts
  for all to authenticated using (true) with check (true);
create policy "auth_all_acts"      on client_activities
  for all to authenticated using (true) with check (true);
create policy "auth_all_reminders" on client_reminders
  for all to authenticated using (true) with check (true);
create policy "auth_all_issues"    on client_issues
  for all to authenticated using (true) with check (true);
create policy "auth_all_documents" on documents
  for all to authenticated using (true) with check (true);
