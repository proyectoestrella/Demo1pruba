-- Historial de cambios por persona y aparato (deshacer desde cualquier dispositivo)
-- ---------------------------------------------------------------------------
-- NO SE HA EJECUTADO. Aplicar como postgres en el SQL Editor de Supabase.
-- Idempotente: se puede lanzar varias veces. No borra ni modifica filas.
--
-- Decisión de diseño: NO se crea una tabla paralela (`cambios_panel`) porque la
-- tabla `cambios` (supabase/pendiente.sql §12 y §16) ya es el registro del
-- servidor y la usan guardarCambio / listarCambios. Aquí se garantiza que
-- exista (por si pendiente.sql no se aplicó entera) y se le añaden:
--   employee_id        profesional de quien hizo el cambio (si tiene ficha de equipo)
--   dispositivo_id     id estable del aparato (uuid guardado en su localStorage)
--   dispositivo_nombre nombre legible, p. ej. «iPhone · Safari»
-- y un índice por autora para «ver lo mío» en cualquier dispositivo.
--
-- Acceso: RLS activado y SIN políticas => solo el servidor con service role.
-- El rol se comprueba en las server functions (src/lib/api/cambios.functions.ts):
-- estilista/recepción solo ven y deshacen lo suyo; gerente y subencargada, todo.
begin;

create table if not exists cambios (
  id text primary key,
  salon_slug text not null,
  tipo text not null,
  entidad text not null,
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

-- La restricción de entidades admite también 'pago' (igual que pendiente.sql §16).
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

alter table cambios add column if not exists employee_id text;
alter table cambios add column if not exists dispositivo_id text;
alter table cambios add column if not exists dispositivo_nombre text;

create index if not exists cambios_salon_fecha_idx on cambios (salon_slug, fecha desc);
create index if not exists cambios_salon_autor_fecha_idx on cambios (salon_slug, autor, fecha desc);

alter table cambios enable row level security;

commit;

-- COMPROBACIÓN (debe devolver 'ok' en las cuatro filas; si algo falla, lanza el error):
do $$ declare faltan text; begin
  select string_agg(c, ', ') into faltan
  from unnest(array['employee_id','dispositivo_id','dispositivo_nombre','autor_nombre']) as c
  where not exists (select 1 from information_schema.columns where table_name = 'cambios' and column_name = c);
  if faltan is not null then raise exception 'cambios-panel.sql: faltan columnas: %', faltan; end if;
  if not exists (select 1 from pg_class where relname = 'cambios' and relrowsecurity) then
    raise exception 'cambios-panel.sql: cambios no tiene RLS activado';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'cambios_salon_autor_fecha_idx') then
    raise exception 'cambios-panel.sql: falta el índice por autora';
  end if;
  raise notice 'cambios-panel.sql: ok';
end $$;

-- MARCHA ATRÁS (solo quita lo añadido aquí; el historial anterior se conserva):
-- alter table cambios drop column if exists employee_id, drop column if exists dispositivo_id, drop column if exists dispositivo_nombre; drop index if exists cambios_salon_autor_fecha_idx;
