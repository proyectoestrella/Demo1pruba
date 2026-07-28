-- Run this once in the Supabase project's SQL editor (Database > SQL Editor).
-- Mirrors src/lib/mock/types.ts (Client, Appointment) for the multi-tenant shape.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (salon_slug, phone)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  client_id uuid not null references clients (id) on delete cascade,
  service_id text not null,
  employee_id text not null,
  start_at timestamptz not null,
  duration_min integer not null,
  price_eur numeric not null,
  status text not null default 'confirmed',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_salon_slug_idx on appointments (salon_slug);
create index if not exists clients_salon_slug_idx on clients (salon_slug);
