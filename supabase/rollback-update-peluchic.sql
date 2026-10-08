-- Deshace update-peluchic.sql: restaura el perfil que guardó en perfil_versiones
-- (la copia más reciente con nota 'antes de update-peluchic.sql').
-- Descarta lo que se haya cambiado en el perfil DESPUÉS del update. Antes de
-- restaurar guarda el perfil actual como copia ('antes de rollback-update-peluchic.sql'),
-- así que también se puede volver atrás. No toca clientas, citas, pagos ni miembros.
-- Si sale un error, ejecuta `rollback;` y vuelve a pulsar Run.
begin;
do $rollback$
declare
  copia jsonb;
  actual jsonb;
begin
  select profile into actual from salons where slug = 'peluchic' for update;
  if actual is null then
    raise exception 'No existe salons.slug=peluchic.';
  end if;
  select perfil into copia from perfil_versiones
    where salon_slug = 'peluchic' and nota = 'antes de update-peluchic.sql'
    order by fecha desc limit 1;
  if copia is null then
    raise exception 'No hay copia guardada por update-peluchic.sql: no hay nada que restaurar.';
  end if;
  insert into perfil_versiones (id, salon_slug, perfil, nota)
    values (gen_random_uuid(), 'peluchic', actual, 'antes de rollback-update-peluchic.sql');
  update salons set profile = copia, updated_at = now() where slug = 'peluchic';
end
$rollback$;
commit;
select slug, jsonb_array_length(profile->'menu') as servicios, updated_at from salons where slug='peluchic';
