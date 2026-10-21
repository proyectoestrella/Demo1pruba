-- Fotos reales de clientas y equipo. Idempotente: se puede ejecutar más de una vez.
-- Aplicar desde el SQL Editor de Supabase del proyecto de siShow (no el personal).
-- Acceso: SOLO vía funciones de servidor con la service role. Sin políticas = nadie
-- más (anon/authenticated) puede leer ni escribir, ni la tabla ni el bucket.
begin;

-- 1. Bucket PRIVADO: máx. 300 KB por archivo, solo webp/jpeg/png.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-personas', 'fotos-personas', false, 307200, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Historial de fotos por persona. Rutas: <salon_slug>/<equipo|clientas>/<id>/<uuid>.<ext>
create table if not exists fotos_personas (
  id uuid primary key default gen_random_uuid(),
  salon_slug text not null,
  tipo text not null check (tipo in ('equipo', 'clienta')),
  persona_id text not null,
  ruta text not null unique,
  creado timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  activa boolean not null default false
);

create index if not exists fotos_personas_persona_idx
  on fotos_personas (salon_slug, tipo, persona_id, creado desc);
-- Como mucho UNA foto activa por persona.
create unique index if not exists fotos_personas_una_activa_idx
  on fotos_personas (salon_slug, tipo, persona_id) where activa;

-- 3. RLS activado y sin políticas: solo la service role (que se salta RLS) entra.
alter table fotos_personas enable row level security;
revoke all on fotos_personas from anon, authenticated;

commit;

-- COMPROBACIÓN (si algo falla, lanza el error; al final debe salir 'ok'):
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'fotos-personas' and public = false) then
    raise exception 'fotos-personas.sql: falta el bucket privado fotos-personas';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'fotos_personas') then
    raise exception 'fotos-personas.sql: falta la tabla fotos_personas';
  end if;
  if not exists (select 1 from pg_class where relname = 'fotos_personas' and relrowsecurity) then
    raise exception 'fotos-personas.sql: fotos_personas no tiene RLS activado';
  end if;
  if exists (select 1 from pg_policies where tablename = 'fotos_personas') then
    raise exception 'fotos-personas.sql: fotos_personas no debe tener políticas';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'fotos_personas_una_activa_idx') then
    raise exception 'fotos-personas.sql: falta el índice de una sola foto activa';
  end if;
  raise notice 'fotos-personas.sql: ok';
end $$;

-- MARCHA ATRÁS (borra las fotos subidas; antes, vaciar el bucket desde Storage):
-- drop table if exists fotos_personas;
-- delete from storage.buckets where id = 'fotos-personas';
