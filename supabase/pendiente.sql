-- ---------------------------------------------------------------------------
-- TODO LO QUE FALTA POR APLICAR EN SUPABASE (producción), en un solo bloque.
--
-- Cómo se aplica: Supabase → SQL Editor → pegar este fichero entero → Run.
-- Es idempotente (`if not exists` / `drop not null` repetibles): si algo ya
-- estaba aplicado, esa sentencia no hace nada y las demás siguen.
--
-- Qué hay aquí y por qué (25/09/2026):
--   1. Lista de espera, cierre de caja y fianza por Bizum (bloque 20/09).
--   2. Color y notas técnicas por visita (B1) y recordatorio enviado (B3),
--      que además marca el recordatorio automático por email.
--   3. Caducidad y decisión del bloqueo por plantón (20/09 tarde).
--   4. Calendario suscribible con enlace secreto (B6).
--   5. Fichas importadas de TPV 123 sin teléfono (`clients.phone` opcional).
--   6. Row Level Security y `salon_members` (21/09). Si ya se activaron a
--      mano en el panel, estas sentencias no cambian nada.
--   7. Índices para el control de solapes en el servidor y para la
--      selección de citas de mañana del recordatorio por email.
--
-- `supabase/schema.sql` sigue siendo la fuente completa: este fichero es el
-- subconjunto que producción todavía no tiene. Después de aplicarlo, los dos
-- deben dejar la base de datos igual.
-- ---------------------------------------------------------------------------

-- 1. Lista de espera ---------------------------------------------------------
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  local_id text,
  client_name text not null,
  phone text not null default '',
  service_id text not null default '',
  preferred_employee_id text not null default 'any',
  preferred_range text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists waitlist_salon_slug_idx on waitlist (salon_slug);
update waitlist set local_id = id::text where local_id is null;
create unique index if not exists waitlist_salon_local_idx on waitlist (salon_slug, local_id);

-- 1. Cierre de caja y fianza por Bizum ---------------------------------------
alter table appointments add column if not exists payment_method text;
alter table appointments add column if not exists paid_at timestamptz;
alter table appointments add column if not exists deposit_requested_at timestamptz;
alter table appointments add column if not exists deposit_received_at timestamptz;
alter table appointments add column if not exists deposit_eur numeric;

-- 2. Color y notas técnicas por visita; recordatorio enviado -----------------
alter table appointments add column if not exists color_formula text;
alter table appointments add column if not exists technical_notes text;
alter table appointments add column if not exists reminder_sent_at timestamptz;

-- 3. Caducidad y decisión del bloqueo por plantón ----------------------------
alter table clients add column if not exists penalty_at timestamptz;
alter table clients add column if not exists penalty_keep boolean not null default false;
update clients set penalty_at = now() where penalty_eur is not null and penalty_at is null;
alter table clients add column if not exists penalty_block boolean not null default true;

-- 4. Calendario suscribible (enlace secreto por salón) -----------------------
create table if not exists calendar_subscriptions (
  salon_slug text primary key references salons (slug) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now()
);
alter table calendar_subscriptions enable row level security;

-- 5. Fichas importadas de TPV 123 sin teléfono -------------------------------
-- UNIQUE (salon_slug, phone) admite varios NULL; los duplicados sin teléfono
-- se buscan por nombre en el servidor.
alter table clients alter column phone drop not null;

-- 6. Row Level Security y pertenencia al salón --------------------------------
-- Sin políticas a propósito: el servidor entra con la service role key (que
-- salta la RLS) y la clave anónima no ve ni escribe ninguna fila.
alter table clients enable row level security;
alter table appointments enable row level security;
alter table salons enable row level security;
alter table waitlist enable row level security;

create table if not exists salon_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  salon_slug text not null,
  rol text not null default 'dueno',
  creado timestamptz not null default now(),
  primary key (user_id, salon_slug)
);
create index if not exists salon_members_salon_slug_idx on salon_members (salon_slug);
alter table salon_members enable row level security;

-- 7. Índices nuevos (25/09) ----------------------------------------------------
-- El control de solapes de la reserva pública lee las citas de UNA
-- profesional en una ventana de fechas; el recordatorio automático lee las
-- citas de mañana de todos los salones. Sin esto, las dos consultas
-- recorren la tabla entera.
create index if not exists appointments_salon_employee_start_idx
  on appointments (salon_slug, employee_id, start_at);
create index if not exists appointments_start_status_idx
  on appointments (start_at, status);

-- 8. Leads de las demos de venta (25/09, tarde) -------------------------------
create table if not exists leads_demo (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  name text not null,
  phone text not null,
  email text,
  service_id text not null default '',
  employee_id text not null default '',
  start_at timestamptz not null,
  duration_min integer not null default 0,
  price_eur numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists leads_demo_salon_slug_idx on leads_demo (salon_slug);
alter table leads_demo enable row level security;

-- 9. Lote 3: columnas propias para lo que iba en `note`/`penalty_note`, tpv_code, birthday, updated_at + trigger (26/09) ---

alter table appointments add column if not exists booking_answers jsonb;
alter table appointments add column if not exists deposit_due_at timestamptz;
alter table appointments add column if not exists deposit_period_hours smallint;
alter table appointments add column if not exists origen text not null default 'sishow';

alter table clients add column if not exists manual_block boolean not null default false;
alter table clients add column if not exists tpv_code text;
alter table clients add column if not exists birthday date;
create index if not exists clients_salon_tpv_code_idx on clients (salon_slug, tpv_code);

alter table appointments add column if not exists updated_at timestamptz not null default now();
alter table clients add column if not exists updated_at timestamptz not null default now();

create or replace function sishow_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_set_updated_at on appointments;
create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function sishow_set_updated_at();

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at
  before update on clients
  for each row execute function sishow_set_updated_at();
