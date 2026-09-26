-- ---------------------------------------------------------------------------
-- PENDIENTE DE APLICAR EN PRODUCCIÓN — lote 13 (calendarios externos,
-- 26/09/2026). Fichero PROPIO, independiente de supabase/pendiente.sql (que
-- otra sesión está aplicando en paralelo, secciones 1-13): no lo toca, y
-- todo aquí es idempotente y no depende de que ese otro fichero ya se haya
-- aplicado.
--
-- Cómo se aplica: Supabase → SQL Editor → pegar este fichero entero → Run.
-- Para validar sin aplicar nada: scripts/validar-sql/validar-pendiente.py
-- supabase/pendiente-calendarios.sql scripts/validar-sql/comprobar-cal.sql
--
-- Tres tablas nuevas, ninguna con política de RLS (mismo criterio que
-- `salon_members`, `cambios`, `leads_demo`...): RLS activada y SIN políticas,
-- así que la clave anónima no ve ni una fila; solo el servidor, con la
-- service role key, que la salta.
-- ---------------------------------------------------------------------------

-- 14. Conexiones de calendario externo (Google/Apple) por salón/profesional -
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
create unique index if not exists calendario_conexiones_unica_idx
  on calendario_conexiones (salon_slug, coalesce(employee_id, ''), proveedor)
  where estado <> 'desconectada';
create index if not exists calendario_conexiones_salon_idx on calendario_conexiones (salon_slug);
alter table calendario_conexiones enable row level security;

-- 15. Mapeo cita ↔ evento externo, para no crear el mismo evento dos veces y
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

-- 16. Bloqueos importados del calendario externo (lo "ocupado" que NO nace en
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
