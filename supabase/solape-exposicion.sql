-- Solape durante exposiciones
-- ===========================
-- NO se ejecuta desde la aplicación. Revisar y aplicar a mano.
--
-- La exclusión de pendiente.sql §21 compara la duración completa de dos
-- reservas web. Ya no representa la regla de negocio: durante la exposición
-- la profesional puede estar activa con otra clienta y el máximo simultáneo
-- vive en salons.profile. La aplicación conserva la comprobación anterior y
-- la comprobación posterior a la escritura (`perdioLaCarrera`).

begin;

-- Seguridad: solo se retira la restricción si sigue siendo la conocida. Si
-- producción tiene otra definición con el mismo nombre, se para sin cambios.
do $$
declare
  definicion text;
begin
  select pg_get_constraintdef(c.oid)
    into definicion
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'appointments'
     and c.conname = 'appointments_web_sin_solape_excl';

  if definicion is null then
    raise notice 'appointments_web_sin_solape_excl no existe; no hay nada que retirar';
  elsif position('salon_slug' in definicion) = 0
     or position('employee_id' in definicion) = 0
     or position('start_at' in definicion) = 0
     or position('duration_min' in definicion) = 0
     or position('origen_reserva' in definicion) = 0
     or position('status' in definicion) = 0 then
    raise exception 'appointments_web_sin_solape_excl tiene una definición inesperada: %', definicion;
  else
    alter table public.appointments
      drop constraint appointments_web_sin_solape_excl;
  end if;
end $$;

-- Comprobación posterior: aborta la transacción si la exclusión completa
-- siguiera presente por cualquier motivo.
do $$
begin
  if exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'appointments'
       and c.conname = 'appointments_web_sin_solape_excl'
  ) then
    raise exception 'No se pudo retirar appointments_web_sin_solape_excl';
  end if;
end $$;

commit;

-- MARCHA ATRÁS (solo si también se revierte el código de exposiciones):
-- begin;
-- create extension if not exists btree_gist;
-- alter table public.appointments
--   add constraint appointments_web_sin_solape_excl
--   exclude using gist (
--     salon_slug with =,
--     employee_id with =,
--     tsrange(
--       (start_at at time zone 'utc'),
--       (start_at at time zone 'utc') + duration_min * interval '1 minute',
--       '[)'
--     ) with &&
--   ) where (origen_reserva = 'web' and status <> 'cancelled');
-- commit;
