-- ---------------------------------------------------------------------------
-- PENDIENTE DE APLICAR EN SUPABASE (producción) — un solo fichero, ordenado.
-- Reescrito el 18/10/2026 (auditoría de backend). NO SE HA EJECUTADO contra
-- ningún proyecto real.
--
-- Cómo se aplica: Supabase → SQL Editor →
--   1) pega SOLO el bloque «0. COMPROBACIÓN PREVIA» y dale a Run. Son selects:
--      no cambian nada. Guarda o fotografía el resultado («antes»).
--   2) pega el resto (secciones 1 a 19) y dale a Run.
--   3) vuelve a ejecutar el bloque 0: debe mostrar todo en «ok».
--
-- Garantías de este fichero:
--   · Idempotente: `if not exists` / bloques `do $$` que miran antes de crear.
--     Ejecutarlo dos veces no cambia nada la segunda.
--   · NO TOCA DATOS: ningún UPDATE ni DELETE. Los rellenos de filas viejas
--     (que existían en la versión anterior) están al final, comentados, en la
--     sección «DATOS», para que los decidas y lances tú aparte.
--   · Las restricciones CHECK sobre columnas con filas previas se crean
--     `not valid`: se aplican a lo que se escriba desde ahora, sin leer ni
--     rechazar lo que ya hay. (`alter table … validate constraint …` las
--     valida cuando quieras.)
--   · Cada sección termina con su REVERSIÓN en un comentario.
--   · Las secciones 20 y 21 son OPCIONALES y están comentadas: necesitan
--     decisión de Tomás (ver el informe peluchic-backend-auditoria-2026-10-18).
--
-- Requisitos: ya existen `salons`, `clients` y `appointments` (si no,
-- ejecuta antes supabase/schema.sql entero) y el esquema `auth` de Supabase.
-- `supabase/schema.sql` es la fuente completa y debe quedar igual que la base
-- tras aplicar esto.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 0. COMPROBACIÓN PREVIA (solo lectura). Ejecutar ANTES y DESPUÉS.
-- ===========================================================================

-- 0.1 Tablas que debe haber (columna `existe`: true/false).
select t as tabla, to_regclass('public.' || t) is not null as existe
from unnest(array['salons','clients','appointments','waitlist','salon_members','salon_invitaciones',
  'calendar_subscriptions','leads_demo','cambios','perfil_versiones','payments','cash_closings',
  'calendario_conexiones','calendario_mapeo_eventos','calendario_bloqueos_externos']) as t
order by existe, t;

-- 0.2 Columnas que el código usa y deben existir. Las que salgan con
-- `existe = false` son las que este fichero va a crear.
with esperadas(tabla, columna) as (values
  ('salon_members','permisos_extra'),('salon_members','estado'),('salon_members','employee_id'),
  ('salon_members','display_name'),('salon_members','email'),('salon_members','invited_by'),('salon_members','actualizado'),
  ('appointments','local_id'),('appointments','client_name'),('appointments','payment_method'),('appointments','paid_at'),
  ('appointments','deposit_status'),('appointments','deposit_method'),('appointments','deposit_due_at'),
  ('appointments','booking_answers'),('appointments','origen'),('appointments','updated_at'),
  ('appointments','ultimo_deshacer_en'),('appointments','reminder_sent_at'),('appointments','privacy_notice_acknowledged_at'),
  ('clients','phone_key'),('clients','email'),('clients','notes'),('clients','penalty_at'),('clients','penalty_keep'),
  ('clients','penalty_block'),('clients','manual_block'),('clients','tpv_code'),('clients','birthday'),
  ('clients','address'),('clients','tax_id'),('clients','tpv_alta'),('clients','tpv_last_visit'),('clients','updated_at')
)
select e.tabla, e.columna,
  exists (select 1 from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = e.tabla and c.column_name = e.columna) as existe
from esperadas e
order by existe, e.tabla, e.columna;

-- 0.3 RLS: todas las tablas deben tener `rls_activa = true`.
select c.relname as tabla, c.relrowsecurity as rls_activa
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 0.4 Políticas: debe salir VACÍO (diseño: RLS sin políticas, solo entra la service role).
select schemaname, tablename, policyname from pg_policies where schemaname = 'public';

-- 0.5 Valores de `appointments.status` que existen hoy (para decidir la sección 20).
select status, count(*) as filas from appointments group by status order by filas desc;

-- 0.6 Restricciones CHECK que ya hay sobre appointments y salon_members.
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where contype = 'c' and conrelid in ('appointments'::regclass, 'salon_members'::regclass)
order by 1, 2;

-- 0.7 Filas que incumplirían las restricciones NOT VALID de la sección 11
-- (si salen filas, usa la sección «DATOS» antes de validar; no impide aplicar).
select 'rol no permitido' as problema, rol as valor, count(*) as filas
from salon_members where rol not in ('gerente','subencargado','recepcion','estilista') group by rol;

-- 0.8 Citas sin local_id (el código las identifica por local_id).
select count(*) as citas_sin_local_id from appointments where local_id is null;

-- 0.9 Solapes reales entre citas vivas de la misma profesional (informa de la sección 21 opcional).
select count(*) as pares_solapados
from appointments a join appointments b
  on a.salon_slug = b.salon_slug and a.employee_id = b.employee_id and a.id < b.id
 and a.start_at < b.start_at + b.duration_min * interval '1 minute'
 and b.start_at < a.start_at + a.duration_min * interval '1 minute'
where a.status not in ('cancelled','no-show') and b.status not in ('cancelled','no-show');

-- 0.10 Fichas duplicadas por (salon, teléfono normalizado): debe ser 0 para el upsert de la reserva.
select salon_slug, phone_key, count(*) as filas from clients
where phone_key is not null group by salon_slug, phone_key having count(*) > 1;

-- ===========================================================================
-- FIN DE LA COMPROBACIÓN PREVIA. Lo que sigue modifica el esquema (no los datos).
-- ===========================================================================

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
-- (relleno de local_id en filas viejas: ver «DATOS», al final; NO se ejecuta aquí)
create unique index if not exists waitlist_salon_local_idx on waitlist (salon_slug, local_id);

-- 1. Cierre de caja y fianza por Bizum ---------------------------------------
alter table appointments add column if not exists payment_method text;
alter table appointments add column if not exists paid_at timestamptz;
alter table appointments add column if not exists deposit_requested_at timestamptz;
alter table appointments add column if not exists deposit_received_at timestamptz;
alter table appointments add column if not exists deposit_eur numeric;
-- REVERSIÓN: drop table if exists waitlist;  (⚠ borra la lista de espera)  ·  alter table appointments drop column if exists payment_method, drop column if exists paid_at, drop column if exists deposit_requested_at, drop column if exists deposit_received_at, drop column if exists deposit_eur;

-- 2. Color y notas técnicas por visita; recordatorio enviado -----------------
alter table appointments add column if not exists color_formula text;
alter table appointments add column if not exists technical_notes text;
alter table appointments add column if not exists reminder_sent_at timestamptz;
-- Guarda cuándo se confirmó el aviso de privacidad en una nueva reserva web.
alter table appointments add column if not exists privacy_notice_acknowledged_at timestamptz;
-- REVERSIÓN: alter table appointments drop column if exists color_formula, drop column if exists technical_notes, drop column if exists reminder_sent_at, drop column if exists privacy_notice_acknowledged_at;

-- 3. Caducidad y decisión del bloqueo por plantón ----------------------------
alter table clients add column if not exists penalty_at timestamptz;
alter table clients add column if not exists penalty_keep boolean not null default false;
-- (relleno de penalty_at en filas viejas: ver «DATOS», al final; NO se ejecuta aquí)
alter table clients add column if not exists penalty_block boolean not null default true;
-- REVERSIÓN: alter table clients drop column if exists penalty_at, drop column if exists penalty_keep, drop column if exists penalty_block;

-- 4. Calendario suscribible (enlace secreto por salón) -----------------------
create table if not exists calendar_subscriptions (
  salon_slug text primary key references salons (slug) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now()
);
alter table calendar_subscriptions enable row level security;
-- REVERSIÓN: drop table if exists calendar_subscriptions;  (invalida los enlaces .ics ya compartidos)

-- 5. Fichas importadas de TPV 123 sin teléfono -------------------------------
-- UNIQUE (salon_slug, phone) admite varios NULL; los duplicados sin teléfono
-- se buscan por nombre en el servidor.
alter table clients alter column phone drop not null;
-- REVERSIÓN: alter table clients alter column phone set not null;  (falla si hay fichas sin teléfono)

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
-- REVERSIÓN: alter table clients disable row level security; (idem appointments, salons, waitlist)  ⚠ NO recomendado: dejaría las tablas abiertas a la clave anónima.  ·  drop table if exists salon_members;

-- 7. Índices nuevos (25/09) ----------------------------------------------------
-- El control de solapes de la reserva pública lee las citas de UNA
-- profesional en una ventana de fechas; el recordatorio automático lee las
-- citas de mañana de todos los salones. Sin esto, las dos consultas
-- recorren la tabla entera.
create index if not exists appointments_salon_employee_start_idx
  on appointments (salon_slug, employee_id, start_at);
create index if not exists appointments_start_status_idx
  on appointments (start_at, status);
-- REVERSIÓN: drop index if exists appointments_salon_employee_start_idx; drop index if exists appointments_start_status_idx;

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
-- REVERSIÓN: drop table if exists leads_demo;

-- 9. Lote 3: columnas propias para lo que iba en `note`/`penalty_note`, tpv_code, birthday, updated_at + trigger (26/09) ---

alter table appointments add column if not exists booking_answers jsonb;
alter table appointments add column if not exists deposit_due_at timestamptz;
alter table appointments add column if not exists deposit_period_hours smallint;
alter table appointments add column if not exists origen text not null default 'sishow';

alter table clients add column if not exists manual_block boolean not null default false;
alter table clients add column if not exists tpv_code text;
alter table clients add column if not exists birthday date;
create index if not exists clients_salon_tpv_code_idx on clients (salon_slug, tpv_code);
-- REVERSIÓN: drop trigger if exists appointments_set_updated_at on appointments; drop trigger if exists clients_set_updated_at on clients; drop function if exists sishow_set_updated_at(); alter table appointments drop column if exists booking_answers, drop column if exists deposit_due_at, drop column if exists deposit_period_hours, drop column if exists origen, drop column if exists updated_at; alter table clients drop column if exists manual_block, drop column if exists tpv_code, drop column if exists birthday, drop column if exists updated_at; drop index if exists clients_salon_tpv_code_idx;

-- 9b. TPV 123: datos de ficha y facturación (17/10) ------------------------
-- Pegar este bloque en el editor SQL antes de importar datos nuevos. Es
-- idempotente: volver a ejecutarlo no altera las fichas existentes.
-- El DNI/CIF queda restringido a la ficha de la clienta en la aplicación.
alter table clients add column if not exists address text;
alter table clients add column if not exists tax_id text;
alter table clients add column if not exists tpv_alta date;
alter table clients add column if not exists tpv_last_visit date;

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
-- REVERSIÓN: alter table clients drop column if exists address, drop column if exists tax_id, drop column if exists tpv_alta, drop column if exists tpv_last_visit;

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
-- (relleno de deposit_status en filas viejas: ver «DATOS», al final; NO se ejecuta aquí)
-- REVERSIÓN: alter table appointments drop constraint if exists appointments_deposit_status_chk; alter table appointments drop constraint if exists appointments_deposit_method_chk; alter table appointments drop column if exists deposit_status, drop column if exists deposit_method, drop column if exists deposit_received_eur, drop column if exists deposit_applied_at, drop column if exists deposit_applied_eur, drop column if exists deposit_refunded_at, drop column if exists deposit_refunded_eur, drop column if exists deposit_retained_at, drop column if exists deposit_note;

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
-- Excepciones acotadas por persona. `{}` mantiene exactamente la matriz del
-- rol y permite desplegar este código antes de configurar a nadie.
alter table salon_members add column if not exists permisos_extra jsonb not null default '{}'::jsonb;
-- (migración de roles 'dueno'/'encargado' a 'gerente': ver «DATOS», al final; NO se ejecuta aquí)
alter table salon_members alter column rol set default 'gerente';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'salon_members_rol_chk') then
    alter table salon_members add constraint salon_members_rol_chk
      check (rol in ('gerente','subencargado','recepcion','estilista')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'salon_members_estado_chk') then
    alter table salon_members add constraint salon_members_estado_chk
      check (estado in ('activa','baja')) not valid;
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
-- REVERSIÓN: drop table if exists salon_invitaciones; drop index if exists salon_members_empleada_idx; alter table salon_members drop constraint if exists salon_members_rol_chk; alter table salon_members drop constraint if exists salon_members_estado_chk; alter table salon_members drop column if exists employee_id, drop column if exists display_name, drop column if exists email, drop column if exists invited_by, drop column if exists estado, drop column if exists actualizado, drop column if exists permisos_extra;  (⚠ sin permisos_extra, aceptar invitaciones y cambiar roles deja de funcionar)

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
-- REVERSIÓN: drop table if exists perfil_versiones; drop table if exists cambios;  (⚠ borra el historial)

-- 13. Auditoría del deshacer en la cita (lote 9b, 26/09) ---------------------
-- Cuándo se deshizo algo en esta cita por última vez. No se reutiliza `origen`:
-- esa columna es la procedencia (sishow/tpv123) y la usa la importación.
alter table appointments add column if not exists ultimo_deshacer_en timestamptz;
-- REVERSIÓN: alter table appointments drop column if exists ultimo_deshacer_en;

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
-- REVERSIÓN: drop table if exists payments;  (⚠ borra los pagos de la caja)

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
-- REVERSIÓN: drop table if exists cash_closings;  (⚠ borra los cierres)

-- 16. `cambios.entidad` admite también 'pago' (lote 11, 26/09) ---------------
-- Solo se registra pago.borrar (ver src/lib/cambios.ts). Idempotente: solo
-- reemplaza la restricción si la actual todavía no menciona 'pago'. No toca filas.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cambios_entidad_check' and pg_get_constraintdef(oid) like '%pago%'
  ) then
    alter table cambios drop constraint if exists cambios_entidad_check;
    alter table cambios add constraint cambios_entidad_check
      check (entidad in ('cita', 'clienta', 'servicio', 'perfil', 'pago'));
  end if;
end $$;
-- REVERSIÓN: alter table cambios drop constraint if exists cambios_entidad_check; alter table cambios add constraint cambios_entidad_check check (entidad in ('cita','clienta','servicio','perfil'));  (falla si ya hay cambios de tipo 'pago')

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
-- REVERSIÓN: drop table if exists calendario_conexiones cascade;  (⚠ borra también 18 y 19)

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
-- REVERSIÓN: drop table if exists calendario_mapeo_eventos;

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
-- REVERSIÓN: drop table if exists calendario_bloqueos_externos;

-- 20. OPCIONAL — CHECK de `appointments.status` (NO activado) -----------------
-- Hoy `status` es texto libre: 'in-progress' («En el salón»), 'late' y 'blocked'
-- funcionan. Solo si 0.5 muestra únicamente estos valores, y si quieres que la
-- base rechace estados inventados, descomenta. `not valid` = no mira las filas viejas.
-- do $$ begin
--   if not exists (select 1 from pg_constraint where conname = 'appointments_status_chk') then
--     alter table appointments add constraint appointments_status_chk
--       check (status in ('pending','confirmed','in-progress','completed','cancelled','no-show','late','blocked')) not valid;
--   end if;
-- end $$;
-- REVERSIÓN: alter table appointments drop constraint if exists appointments_status_chk;

-- 21. OPCIONAL — impedir en la base dos citas solapadas (M5, NO activado) ------
-- DECISIÓN DE TOMÁS: el panel permite solapar a propósito («permitirSolape»,
-- lib/solape.ts). Esta restricción lo PROHIBIRÍA también al panel. Si se quiere
-- solo para reservas públicas, hay que marcarlas con una columna (p. ej. `origen`)
-- y añadir `and origen = 'web'` al `where`. No se puede crear si 0.9 > 0.
-- Usa `at time zone 'utc'` porque la expresión debe ser inmutable.
-- create extension if not exists btree_gist;
-- alter table appointments add constraint appointments_sin_solape_excl
--   exclude using gist (
--     salon_slug with =, employee_id with =,
--     tsrange((start_at at time zone 'utc'),
--             (start_at at time zone 'utc') + duration_min * interval '1 minute') with &&
--   ) where (status not in ('cancelled','no-show'));
-- REVERSIÓN: alter table appointments drop constraint if exists appointments_sin_solape_excl;
-- Mientras no exista, el código vuelve a comprobar tras escribir (perdioLaCarrera) y deshace la reserva perdedora.

-- ===========================================================================
-- DATOS — rellenos de filas viejas. NO se ejecutan con este fichero.
-- Eran UPDATE en la versión anterior; cada uno tiene antes su select de control.
-- Lánzalos uno a uno, a mano, tras mirar el recuento.
-- ===========================================================================
-- select count(*) from waitlist where local_id is null;
--   update waitlist set local_id = id::text where local_id is null;
-- select count(*) from appointments where local_id is null;
--   update appointments set local_id = id::text where local_id is null;
-- select count(*) from clients where penalty_eur is not null and penalty_at is null;
--   update clients set penalty_at = now() where penalty_eur is not null and penalty_at is null;
-- select count(*) from appointments where deposit_status is null and deposit_requested_at is not null;
--   update appointments set deposit_status = case when deposit_received_at is not null then 'recibida' else 'pedida' end,
--     deposit_received_eur = case when deposit_received_at is not null then deposit_eur else null end
--     where deposit_status is null and deposit_requested_at is not null;
-- select rol, count(*) from salon_members where rol in ('dueno','encargado') group by rol;
--   update salon_members set rol = 'gerente' where rol in ('dueno','encargado');
-- Después de los rellenos: alter table salon_members validate constraint salon_members_rol_chk;
--                           alter table salon_members validate constraint salon_members_estado_chk;
-- Privacidad (aviso 122): el código ya NO escribe `resumen` de eventos ajenos. Limpieza de
-- títulos ya guardados (opcional, tras mirar si hay alguno; la columna se conserva):
-- select count(*) from calendario_bloqueos_externos where resumen is not null;
--   update calendario_bloqueos_externos set resumen = null where resumen is not null;
