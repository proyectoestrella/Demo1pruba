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

-- Una ficha importada puede venir sin teléfono. La restricción UNIQUE admite
-- varios NULL y la búsqueda de duplicados sin teléfono se hace por nombre.
alter table clients alter column phone drop not null;

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

-- Enlace secreto para suscribir el calendario del salón. Solo el servidor
-- (service role) lee esta tabla; regenerar el token invalida la URL anterior.
create table if not exists calendar_subscriptions (
  salon_slug text primary key references salons (slug) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now()
);
alter table calendar_subscriptions enable row level security;

-- Columnas que el `create table if not exists` de arriba NO añade cuando la
-- tabla ya existía de una versión anterior (fue el caso en producción el
-- 19/09/2026: `client_confirmed_at` y `notes` faltaban y el panel no cargaba).
alter table appointments add column if not exists client_confirmed_at timestamptz;
alter table appointments add column if not exists note text;
alter table clients add column if not exists email text;
alter table clients add column if not exists notes text;

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

-- ---------------------------------------------------------------------------
-- 20/09/2026 — lista de espera, cierre de caja, fianza por Bizum y caducidad
-- del bloqueo por plantón.
--
-- PENDIENTE DE APLICAR EN PRODUCCIÓN. El código que lo usa ya está desplegado
-- y aguanta sin esto: si una columna o la tabla no existen, se avisa por
-- consola y se guarda sin esos campos (ver `faltaEsquema` en
-- src/lib/api/salons.functions.ts). Lo único que NO funciona hasta aplicarlo
-- es que la lista de espera persista entre recargas.
-- ---------------------------------------------------------------------------

-- Lista de espera del salón. Antes solo existía en el navegador, con el
-- resultado de que un salón REAL veía las cuatro entradas de ejemplo del seed
-- (+34 611 111 222, 622 333 444...) como si fueran clientes suyos, y lo que
-- apuntaba de verdad se perdía al recargar.
--
-- Misma mecánica que appointments: la clave de upsert es (salon_slug,
-- local_id) porque la entrada nace con un id del navegador ("w-1758...").
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

-- Cierre de caja: cómo se cobró cada cita y cuándo se marcó. Lo elige el
-- dueño a mano (efectivo / Bizum / tarjeta): aquí no se procesa ningún pago.
alter table appointments add column if not exists payment_method text;
alter table appointments add column if not exists paid_at timestamptz;

-- Fianza por Bizum (PeluChic): cuándo se pidió por WhatsApp, cuándo el salón
-- confirmó A MANO que había llegado, y por cuánto. Tampoco hay pasarela aquí.
alter table appointments add column if not exists deposit_requested_at timestamptz;
alter table appointments add column if not exists deposit_received_at timestamptz;
alter table appointments add column if not exists deposit_eur numeric;
alter table appointments add column if not exists color_formula text;
alter table appointments add column if not exists technical_notes text;
alter table appointments add column if not exists reminder_sent_at timestamptz;

-- Caducidad del bloqueo por plantón: a los 30 días de `penalty_at` el cliente
-- vuelve a poder reservar solo, salvo que el dueño marque `penalty_keep`. La
-- deuda (`penalty_eur`) sigue anotada: lo que caduca es el bloqueo, no el cobro.
alter table clients add column if not exists penalty_at timestamptz;
alter table clients add column if not exists penalty_keep boolean not null default false;
-- Las penalizaciones que ya existían no tienen fecha: se les pone la de ahora
-- para que también empiecen a caducar en vez de quedarse bloqueadas para siempre.
update clients set penalty_at = now() where penalty_eur is not null and penalty_at is null;

-- ---------------------------------------------------------------------------
-- 20/09/2026 (tarde) — la deuda por plantón se ve y se decide
--
-- PENDIENTE DE APLICAR EN PRODUCCIÓN. El código aguanta sin esto: si la
-- columna no existe se guarda la ficha sin ella y la deuda se comporta como
-- antes (deber dinero bloquea la reserva online) — ver `faltaEsquema` en
-- src/lib/api/salons.functions.ts.
-- ---------------------------------------------------------------------------

-- ¿Esta deuda le impide volver a reservar por la web?
--
-- `false` es la tercera decisión del dueño, la que pidió Tomás: "déjasela
-- anotada, que venga igual y se la cobro en el siguiente corte". `true` (el
-- valor por defecto, y el de todas las filas que ya existían) se comporta
-- exactamente como hasta ahora.
alter table clients add column if not exists penalty_block boolean not null default true;

-- El estado 'late' (vino tarde y sin avisar) entra por la columna `status` de
-- appointments, que ya es texto libre: no hace falta DDL para él.

-- ---------------------------------------------------------------------------
-- 21/09/2026 — Row Level Security, por fin escrita donde se puede recrear
--
-- La RLS YA está activada en el proyecto de producción, pero se activó a mano
-- en el panel de Supabase y nunca llegó a este fichero. Consecuencia: quien
-- levante el proyecto desde el repositorio —que es exactamente lo que dice la
-- primera línea de aquí arriba: `bun run scripts/migrate.ts`— se encuentra una
-- base de datos SIN RLS y con todas las tablas abiertas a la clave anónima.
-- Una protección que existe por accidente histórico no es una protección.
--
-- Esto no cambia nada en producción (ya está así): sirve para que un proyecto
-- recreado nazca igual de cerrado que el actual.
--
-- CÓMO ENCAJA ESTO CON EL SERVIDOR, que es lo que suele confundirse:
--
--   * El servidor de la aplicación entra con la SERVICE ROLE KEY
--     (src/lib/supabase.server.ts). Esa clave SALTA la RLS por definición:
--     ninguna política de aquí le afecta ni le afectará.
--   * Por tanto la RLS NO es la primera barrera del producto, es la SEGUNDA.
--     La primera —comprobar quién llama antes de leer o escribir el salón que
--     pide— tiene que estar en las funciones de servidor. Mientras eso no
--     exista, activar RLS no protege de nada por el camino normal.
--   * Lo que la RLS sí cierra, y por eso se activa, es el camino directo: que
--     cualquiera con la clave anónima o la publicable —que van en claro en el
--     navegador en cuanto se use un cliente de Supabase desde el cliente—
--     lea o escriba las tablas saltándose la aplicación entera.
--
-- Se activa la RLS y NO se crea ninguna política. Es deliberado y es el estado
-- real de hoy: sin políticas, la clave anónima ve cero filas y no puede
-- escribir ninguna. Una política permisiva («true») aquí abriría la puerta que
-- este bloque está cerrando; cuando haya autenticación de verdad, las
-- políticas se escribirán contra esa sesión, en su propio bloque fechado.
-- ---------------------------------------------------------------------------

alter table clients enable row level security;
alter table appointments enable row level security;
alter table salons enable row level security;
alter table waitlist enable row level security;

-- Ojo con `force row level security`: NO se pone. Forzaría la RLS también al
-- dueño de la tabla, que es con quien conecta `scripts/migrate.ts`, y las
-- sentencias de datos de este mismo fichero (el `update clients set
-- penalty_at = now()` de más arriba) pasarían a afectar a cero filas sin
-- decir nada. Además dejaría de reflejar el estado real de producción, que es
-- justo lo que este bloque viene a versionar.

-- ---------------------------------------------------------------------------
-- 21/09/2026 — Quién puede entrar al panel de cada salón (`salon_members`)
--
-- El problema que cierra esta tabla, dicho en claro: hasta hoy, cualquiera que
-- escribiera `/app?s=the-best-shave-barber` en el navegador veía el panel de
-- ese salón entero, con la lista de sus clientes y sus teléfonos, sin escribir
-- ninguna credencial. El slug no es un secreto: sale en la URL pública de la
-- web de reservas del salón.
--
-- La frontera vuelve a ser una sola fila, igual que en `salons`:
--
--   * Si `salons` NO tiene fila con ese slug, es una DEMO de venta. Se entra
--     como siempre, sin pedir nada. Esto es intocable: el equipo comercial
--     enseña ~54 demos en la calle abriendo un enlace `?d=…`, y una demo que
--     pida contraseña es una venta perdida.
--   * Si `salons` SÍ tiene fila, es un salón de pago. Entonces hace falta una
--     sesión de Supabase Auth Y una fila aquí que diga que ESE usuario puede
--     entrar a ESE salón.
--
-- Quién decide cuál de los dos casos es: el SERVIDOR, consultando `salons`.
-- Nunca un parámetro que mande el navegador. Ver src/lib/api/autorizacion.ts.
--
-- `user_id` apunta a `auth.users`, que es la tabla de usuarios que gestiona
-- Supabase Auth: ahí es donde aparece el dueño del salón en cuanto pincha por
-- primera vez el enlace mágico que le llega al correo. No guardamos
-- contraseñas en ningún sitio porque no hay contraseñas.
--
-- `on delete cascade`: si se borra el usuario, desaparece su pertenencia. No
-- queremos filas huérfanas que den acceso a un id que ya no existe.
--
-- La clave primaria es la pareja (usuario, salón): la misma persona puede
-- tener varios salones, y un salón puede tener varios usuarios (el dueño y su
-- encargado). No se repite la pareja.
-- ---------------------------------------------------------------------------

create table if not exists salon_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- No lleva `references salons (slug)` a propósito: dar de alta al usuario y
  -- dar de alta el salón son dos actos distintos y a veces en distinto orden.
  -- Una fila aquí sin salón no da acceso a nada, porque el acceso se decide
  -- mirando `salons` primero.
  salon_slug text not null,
  -- Hoy solo se usa 'dueno'. 'encargado' queda escrito para cuando haga falta
  -- distinguir quién puede tocar Ajustes y quién solo la agenda; mientras
  -- tanto el servidor trata igual a los dos y no se inventa permisos.
  rol text not null default 'dueno',
  creado timestamptz not null default now(),
  primary key (user_id, salon_slug)
);

-- Se consulta siempre por la pareja, pero también "quién puede entrar a este
-- salón" al dar de alta a alguien nuevo.
create index if not exists salon_members_salon_slug_idx on salon_members (salon_slug);

-- Misma decisión que en el bloque anterior: RLS activada y SIN políticas. El
-- servidor entra con la service role key y la salta; la clave anónima no ve ni
-- una fila. Una política permisiva aquí dejaría que cualquiera con la clave
-- pública leyera —o peor, escribiera— quién tiene acceso a qué salón.
alter table salon_members enable row level security;

-- ---------------------------------------------------------------------------
-- 25/09/2026 — reserva fiable y recordatorio automático por email
--
-- PENDIENTE DE APLICAR EN PRODUCCIÓN: ver supabase/pendiente.sql, que reúne
-- en un solo fichero todo lo que falta, listo para el SQL Editor.
-- ---------------------------------------------------------------------------

-- El control de solapes del servidor (`syncAppointment`, reserva pública) lee
-- las citas de UNA profesional en una ventana de siete días alrededor de la
-- hora pedida; el recordatorio automático (`recordatorios.server.ts`) lee las
-- citas de mañana de TODOS los salones. Sin estos índices las dos consultas
-- recorren la tabla entera.
create index if not exists appointments_salon_employee_start_idx
  on appointments (salon_slug, employee_id, start_at);
create index if not exists appointments_start_status_idx
  on appointments (start_at, status);

-- ---------------------------------------------------------------------------
-- 25/09/2026 (tarde) — leads de las demos de venta, en su propia tabla
--
-- Hasta hoy una reserva hecha en la web de una DEMO se guardaba en `clients`
-- y `appointments` mezclada con los datos de los salones reales, y por el
-- mismo camino cualquiera podía meter una cita confirmada en un salón de
-- pago. Ahora los leads viven aquí; ninguna pantalla del panel ni el cron
-- de recordatorios leen esta tabla. RLS activada y sin políticas, como el
-- resto: solo el servidor escribe.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 26/09/2026 — Lote 3: lo que iba codificado en texto pasa a columnas propias
--
-- Hasta hoy, dentro de `appointments.note` viajaban tres cosas con marcadores
-- (`[siShow:reserva:v1:…]`, `[siShow:senal:v1:…]`, `[siShow:origen:v1:tpv123]`)
-- y el bloqueo manual iba en `clients.penalty_note` como JSON. Aquí nacen
-- sus columnas. La lectura es compatible durante una versión: si la columna
-- viene a null, se sigue leyendo el marcador (src/lib/salon-rows.ts). El
-- relleno de las filas antiguas lo hace `bun run scripts/migrar-notas.ts`,
-- con los mismos parsers que el código, no SQL con expresiones regulares.
-- ---------------------------------------------------------------------------

-- Respuestas de la clienta al pedir la cita (largo del pelo, etc.).
alter table appointments add column if not exists booking_answers jsonb;
-- Plazo de la señal por Bizum: vencimiento y horas acordadas.
alter table appointments add column if not exists deposit_due_at timestamptz;
alter table appointments add column if not exists deposit_period_hours smallint;
-- Procedencia del historial: 'sishow' (la app) o 'tpv123' (importado).
alter table appointments add column if not exists origen text not null default 'sishow';

-- Bloqueo manual de la reserva online, separado de la deuda por plantón.
alter table clients add column if not exists manual_block boolean not null default false;
-- Código de clienta en TPV 123 (para volver a importar sin duplicar) y cumpleaños.
alter table clients add column if not exists tpv_code text;
alter table clients add column if not exists birthday date;
create index if not exists clients_salon_tpv_code_idx on clients (salon_slug, tpv_code);

-- `updated_at` como DATO, no como cerrojo: el panel escribe parches por
-- campos (ver syncAppointmentPatch) y el último en tocar un campo gana. La
-- columna sirve para saber cuándo cambió una fila y para depurar.
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

-- ---------------------------------------------------------------------------
-- 25/09/2026 (noche) — Ciclo de vida de la señal (Método A, lib/senal.ts)
--
-- La señal va en la propia cita (es 1:1 con ella y así viaja con el parche
-- por campos, el refresco y los niveles de esquema que ya existen).
-- `deposit_eur` es el importe DEBIDO; lo recibido, aplicado y devuelto va
-- aparte porque puede no coincidir si cambia el servicio. `vencida` no se
-- guarda: se calcula con `deposit_due_at`. siShow nunca cobra: todo esto lo
-- apunta la dueña.
-- ---------------------------------------------------------------------------
alter table appointments add column if not exists deposit_status text;
alter table appointments add column if not exists deposit_method text;
alter table appointments add column if not exists deposit_received_eur numeric;
alter table appointments add column if not exists deposit_applied_at timestamptz;
alter table appointments add column if not exists deposit_applied_eur numeric;
alter table appointments add column if not exists deposit_refunded_at timestamptz;
alter table appointments add column if not exists deposit_refunded_eur numeric;
alter table appointments add column if not exists deposit_retained_at timestamptz;
alter table appointments add column if not exists deposit_note text;
-- Valores válidos, sin romper filas antiguas (null = sin estado guardado).
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
-- Rellena el estado de las citas que ya tenían señal por fechas.
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
