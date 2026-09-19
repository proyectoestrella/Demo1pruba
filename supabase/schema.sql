-- Esquema de Supabase. Se aplica con `bun run scripts/migrate.ts` (conexión
-- directa con POSTGRES_URL_NON_POOLING): PostgREST no ejecuta DDL, así que
-- este fichero no se puede aplicar con la service role key por REST.
--
-- Todo es idempotente: se puede volver a lanzar sin romper nada.
-- Mirrors src/lib/mock/types.ts (Client, Appointment, SalonProfile).

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  unique (salon_slug, phone)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  client_id uuid not null references clients (id) on delete cascade,
  -- Ids de servicio separados por comas cuando la cita lleva varios
  -- ("corte,barba"). Se eligio esto antes que una tabla appointment_services
  -- para no migrar: el panel no lee de aqui todavia.
  service_id text not null,
  employee_id text not null,
  start_at timestamptz not null,
  duration_min integer not null,
  price_eur numeric not null,
  status text not null default 'confirmed',
  client_confirmed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_salon_slug_idx on appointments (salon_slug);
create index if not exists clients_salon_slug_idx on clients (salon_slug);

-- ---------------------------------------------------------------------------
-- Salones reales (18/09/2026) — el panel deja de ser solo localStorage
-- ---------------------------------------------------------------------------

-- Perfil del salón real. Un solo jsonb con la forma exacta de SalonProfile
-- (src/lib/mock/types.ts) para no duplicar columna por campo y no divergir del
-- tipo TypeScript cada vez que se añada algo (team, menu, noShowFeeEur...).
--
-- La EXISTENCIA de la fila es la señal que enciende todo el backend: un slug
-- sin fila aquí sigue siendo una demo de venta y se comporta exactamente como
-- antes, sin ninguna otra llamada a Supabase.
create table if not exists salons (
  slug text primary key,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

-- Penalización por plantón: ya existe en el modelo TS (Client.penaltyEur /
-- penaltyNote, del feature de plantón) pero solo vivía en local.
alter table clients add column if not exists penalty_eur numeric;
alter table clients add column if not exists penalty_note text;

-- Teléfono normalizado (últimos 9 dígitos — la misma regla que normalizePhone()
-- en src/lib/no-show.ts). Es la clave real del cliente: "+34 622 87 46 38",
-- "622874638" y "34 622 87 46 38" son la misma persona, y sin esto cada forma
-- de teclearlo creaba una ficha nueva y la penalización no bloqueaba a nadie.
alter table clients add column if not exists phone_key text;
update clients set phone_key = right(regexp_replace(phone, '\D', '', 'g'), 9) where phone_key is null;
create unique index if not exists clients_salon_phone_key_idx on clients (salon_slug, phone_key);

-- Id de la cita tal y como lo conoce el navegador ("a-new-1758…"). El panel
-- muta citas que nacieron en local, así que necesita una clave estable propia
-- para hacer upsert sin inventarse uuids. Las filas anteriores se rellenan con
-- su propio uuid: quedan direccionables igual.
alter table appointments add column if not exists local_id text;
update appointments set local_id = id::text where local_id is null;
create unique index if not exists appointments_salon_local_idx on appointments (salon_slug, local_id);

-- Nombre del cliente en la propia cita. Un "Sin cita" (walk-in) entra sin
-- teléfono y por tanto sin ficha de cliente, pero la agenda tiene que poder
-- pintar su nombre igual — de ahí también que client_id deje de ser obligatorio.
alter table appointments add column if not exists client_name text;
alter table appointments alter column client_id drop not null;
