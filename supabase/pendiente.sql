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
--  11. Accesos y roles (lote 8): columnas de salon_members e invitaciones.
--  12. Historial de cambios y versiones del perfil (lote 9).
--  13. Auditoría del deshacer en la cita (lote 9b).
--  14. Caja: pagos reales, tabla `payments` (lote 11).
--  15. Caja: cierre del día, tabla `cash_closings` (lote 11).
--  16. `cambios.entidad` admite también 'pago' (lote 11).
--  17-19. Calendarios externos: conexiones, mapeo de eventos y bloqueos (lote 13).
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

-- 10. Ciclo de vida de la señal (25/09, noche) -----------------------------------
alter table appointments add column if not exists deposit_status text;
alter table appointments add column if not exists deposit_method text;
alter table appointments add column if not exists deposit_received_eur numeric;
alter table appointments add column if not exists deposit_applied_at timestamptz;
alter table appointments add column if not exists deposit_applied_eur numeric;
alter table appointments add column if not exists deposit_refunded_at timestamptz;
alter table appointments add column if not exists deposit_refunded_eur numeric;
alter table appointments add column if not exists deposit_retained_at timestamptz;
alter table appointments add column if not exists deposit_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_deposit_status_chk') then
    alter table appointments add constraint appointments_deposit_status_chk
      check (deposit_status is null or deposit_status in ('por_pedir','pedida','recibida','aplicada','devuelta','retenida','anulada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_deposit_method_chk') then
    alter table appointments add constraint appointments_deposit_method_chk
      check (deposit_method is null or deposit_method in ('bizum','efectivo','tarjeta','transferencia'));
  end if;
end $$;
update appointments set deposit_status = case
    when deposit_received_at is not null then 'recibida'
    else 'pedida' end,
  deposit_received_eur = case when deposit_received_at is not null then deposit_eur else null end
  where deposit_status is null and deposit_requested_at is not null;

-- 11. Accesos y roles (lote 8, 26/09) ----------------------------------------
-- Rol, profesional vinculada, nombre para el saludo y estado de cada miembro.
-- Mientras esto no se aplique, el servidor lee la fila con select(*) y trata
-- a todo miembro como gerente: nadie se queda fuera.
alter table salon_members add column if not exists employee_id text;
alter table salon_members add column if not exists display_name text;
alter table salon_members add column if not exists email text;
alter table salon_members add column if not exists invited_by uuid references auth.users (id);
alter table salon_members add column if not exists estado text not null default 'activa';
alter table salon_members add column if not exists actualizado timestamptz not null default now();
update salon_members set rol = 'gerente' where rol in ('dueno', 'encargado');
alter table salon_members alter column rol set default 'gerente';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'salon_members_rol_chk') then
    alter table salon_members add constraint salon_members_rol_chk
      check (rol in ('gerente','subencargado','recepcion','estilista'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'salon_members_estado_chk') then
    alter table salon_members add constraint salon_members_estado_chk
      check (estado in ('activa','baja'));
  end if;
end $$;
-- Una profesional, como mucho un acceso activo vinculado.
create unique index if not exists salon_members_empleada_idx on salon_members (salon_slug, employee_id)
  where employee_id is not null and estado = 'activa';

-- Invitaciones pendientes: la invitada aún no existe en auth.users.
create table if not exists salon_invitaciones (
  id uuid primary key,
  salon_slug text not null,
  email text not null,
  rol text not null check (rol in ('gerente','subencargado','recepcion','estilista')),
  employee_id text,
  display_name text,
  invited_by uuid references auth.users (id),
  creada timestamptz not null default now(),
  caduca timestamptz not null,
  aceptada_en timestamptz,
  revocada boolean not null default false
);
create index if not exists salon_invitaciones_salon_idx on salon_invitaciones (salon_slug);
-- Mismo criterio que el resto: RLS activado y sin políticas; solo el servidor.
alter table salon_invitaciones enable row level security;

-- 12. Historial de cambios y versiones del perfil (lote 9, 26/09) ------------
-- Cada acción reversible guarda SOLO los campos que cambia (antes/después).
-- El id lo genera el navegador: subir dos veces el mismo cambio no lo duplica.
create table if not exists cambios (
  id text primary key,
  salon_slug text not null,
  tipo text not null,
  entidad text not null check (entidad in ('cita','clienta','servicio','perfil')),
  id_entidad text not null,
  antes jsonb not null,
  despues jsonb not null,
  resumen text not null,
  autor uuid references auth.users (id) on delete set null,
  autor_nombre text,
  fecha timestamptz not null default now(),
  deshecho_en timestamptz,
  deshecho_por uuid references auth.users (id) on delete set null,
  deshace_a text references cambios (id) on delete set null,
  aviso_enviado boolean not null default false
);
create index if not exists cambios_salon_fecha_idx on cambios (salon_slug, fecha desc);
alter table cambios enable row level security;

-- Cada «Publicar» de Mi página guarda la versión publicada.
create table if not exists perfil_versiones (
  id uuid primary key,
  salon_slug text not null,
  perfil jsonb not null,
  publicado_por uuid references auth.users (id) on delete set null,
  autor_nombre text,
  fecha timestamptz not null default now(),
  nota text
);
create index if not exists perfil_versiones_salon_fecha_idx on perfil_versiones (salon_slug, fecha desc);
alter table perfil_versiones enable row level security;

-- 13. Auditoría del deshacer en la cita (lote 9b, 26/09) ---------------------
-- Cuándo se deshizo algo en esta cita por última vez. No se reutiliza `origen`:
-- esa columna es la procedencia (sishow/tpv123) y la usa la importación.
alter table appointments add column if not exists ultimo_deshacer_en timestamptz;

-- 14. Caja: pagos reales (lote 11, 26/09) ------------------------------------
-- El cuaderno del mostrador en digital: lo que la dueña o su encargada han
-- anotado que ha entrado. siShow NUNCA cobra ni mueve dinero (mismo principio
-- que la fianza, contrato v4.1): esto no es un ticket ni una factura, es un
-- registro interno para cuadrar la caja (ver docs/contrato-caja.md).
--
-- `ref_externa` evita duplicar en dos casos: la señal aplicada al cobrar
-- (`senal:<local_id de la cita>`, la crea `syncAppointmentPatch`) y el
-- importador de TPV 123 (el número de Factura, o `Factura#2` si se repite).
-- El índice único es PARCIAL (solo cuando `ref_externa` no es null): un alta
-- manual sin referencia no tiene con qué comparar y no debe topar con nada.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  appointment_id text,
  client_id uuid references clients (id) on delete set null,
  client_name text,
  importe_eur numeric not null,
  metodo text not null check (metodo in ('efectivo', 'tarjeta', 'bizum')),
  concepto text not null default 'servicio' check (concepto in ('servicio', 'producto', 'propina', 'senal', 'ajuste')),
  cobrado_por text,
  nota text,
  origen text not null default 'sishow' check (origen in ('sishow', 'tpv123')),
  ref_externa text,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists payments_salon_fecha_idx on payments (salon_slug, fecha);
create unique index if not exists payments_salon_origen_ref_idx
  on payments (salon_slug, origen, ref_externa) where ref_externa is not null;
alter table payments enable row level security;

-- 15. Caja: cierre del día (lote 11, 26/09) ----------------------------------
-- El "esperado" sale de `payments` (calculado en el servidor, `cerrarCaja`),
-- no de `appointments.paid_at`: eso sigue siendo el viejo `cierreDelDia` de
-- `lib/caja.ts`, que no se toca. Único por salón+fecha: re-cerrar actualiza
-- la misma fila y dice lo que había antes en `anterior` (auditoría mínima,
-- sin depender de la tabla `cambios`).
create table if not exists cash_closings (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  fecha date not null,
  efectivo_contado numeric not null,
  esperado numeric not null,
  descuadre numeric not null,
  cerrado_por uuid references auth.users (id) on delete set null,
  nota text,
  anterior jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_slug, fecha)
);
alter table cash_closings enable row level security;

-- 16. `cambios.entidad` admite también 'pago' (lote 11, 26/09) ---------------
-- Solo se registra pago.borrar (ver src/lib/cambios.ts): un alta de pago no
-- es deshacible por historial —igual que crear una cita o un servicio
-- tampoco lo es—, pero borrarlo sí, y eso sí hay que poder deshacerlo.
alter table cambios drop constraint if exists cambios_entidad_check;
alter table cambios add constraint cambios_entidad_check
  check (entidad in ('cita', 'clienta', 'servicio', 'perfil', 'pago'));

-- 17. Calendarios (lote 13): conexiones de calendario externo (Google/Apple) por salón/profesional -
--
-- `employee_id` nulo = conexión de TODO el salón (un calendario compartido);
-- no nulo = la profesional dueña. La credencial (refresh token de Google o
-- contraseña de aplicación de Apple) viaja SIEMPRE cifrada — ver
-- src/lib/calendario-externo/cifrado.ts — nunca en claro en esta tabla.
create table if not exists calendario_conexiones (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null references salons (slug) on delete cascade,
  employee_id text,
  proveedor text not null check (proveedor in ('google', 'apple')),
  estado text not null default 'activa' check (estado in ('activa', 'error', 'desconectada')),
  -- El blob "v1.iv.tag.ciphertext" de cifrado.ts. Nunca una credencial en claro.
  credencial_cifrada text not null,
  -- Cuenta conectada, solo para pintarla (email de Google; Apple ID de Apple).
  cuenta text,
  -- Google: calendarId ("primary"). Apple: href del calendario descubierto.
  calendario_externo_id text,
  calendario_nombre text,
  sync_token text,
  ctag text,
  canal_watch_id text,
  canal_recurso_id text,
  canal_caduca timestamptz,
  ultimo_error text,
  ultimo_error_en timestamptz,
  ultima_sincronizacion timestamptz,
  -- Los dos interruptores de v1 (26/09, a petición de FRONTEND): por
  -- defecto los dos activos; conectar hace las dos cosas salvo que se
  -- apague explícitamente una.
  bloquear_huecos boolean not null default true,
  escribir_citas boolean not null default true,
  creado_por uuid references auth.users (id) on delete set null,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
-- Como mucho una conexión activa por (salón, profesional-o-salón-entero,
-- proveedor). `coalesce` para que el "salón entero" (employee_id null)
-- también entre en la unicidad.
-- Sin WHERE a propósito: desconectar BORRA la fila (no la marca como
-- 'desconectada'), así que nunca hay una fila vieja con la que competir y
-- un índice parcial solo complicaría el upsert desde el cliente de Supabase.
create unique index if not exists calendario_conexiones_unica_idx
  on calendario_conexiones (salon_slug, coalesce(employee_id, ''), proveedor);
create index if not exists calendario_conexiones_salon_idx on calendario_conexiones (salon_slug);
alter table calendario_conexiones enable row level security;

-- 18. Calendarios: mapeo cita ↔ evento externo, para no crear el mismo evento dos veces y
-- para saber qué borrar/actualizar cuando la cita cambia. `ical_uid` es la
-- misma marca que se manda a Google (`iCalUID`) y a Apple (`UID:`), así que
-- un evento que vuelve con esa marca se reconoce como propio (eco), no como
-- un hueco ocupado de verdad.
create table if not exists calendario_mapeo_eventos (
  id uuid primary key default gen_random_uuid(),
  conexion_id uuid not null references calendario_conexiones (id) on delete cascade,
  cita_id uuid not null references appointments (id) on delete cascade,
  evento_externo_id text not null,
  -- Solo lo usa Apple (ETag del recurso); Google no lo necesita.
  etag text,
  ical_uid text not null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (conexion_id, cita_id),
  unique (conexion_id, evento_externo_id)
);
create index if not exists calendario_mapeo_eventos_cita_idx on calendario_mapeo_eventos (cita_id);
alter table calendario_mapeo_eventos enable row level security;

-- 19. Calendarios: bloqueos importados del calendario externo (lo "ocupado" que NO nace en
-- siShow: una cita del médico, un evento personal...). Se usan para no
-- ofrecer ese hueco en la reserva pública. Si `bloquear_huecos` está apagado
-- en la conexión, el servicio de sincronización no escribe filas aquí (y las
-- que ya hubiera se borran al apagarlo — lo hace el propio servicio).
create table if not exists calendario_bloqueos_externos (
  id uuid primary key default gen_random_uuid(),
  conexion_id uuid not null references calendario_conexiones (id) on delete cascade,
  salon_slug text not null,
  employee_id text,
  evento_externo_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  resumen text,
  actualizado timestamptz not null default now(),
  unique (conexion_id, evento_externo_id)
);
create index if not exists calendario_bloqueos_externos_hueco_idx
  on calendario_bloqueos_externos (salon_slug, employee_id, start_at, end_at);
alter table calendario_bloqueos_externos enable row level security;
