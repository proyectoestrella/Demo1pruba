-- Alta de María como gerente de PeluChic. Ejecutar a mano en el SQL Editor
-- SOLO después de que María haya abierto el enlace mágico de su correo (así su
-- cuenta ya existe en auth.users). No crea la cuenta ni envía correos.
-- ÚNICO cambio a hacer: sustituir el correo de la línea marcada con ◄◄◄.
-- Si el correo sigue siendo el marcador, o no hay usuario con ese correo,
-- aborta con un error (no devuelve "0 filas" en silencio).
begin;
do $alta$
declare
  correo text := lower('__CORREO_CONFIRMADO_POR_MARIA__');  -- ◄◄◄ AQUÍ
  uid uuid;
  tiene_empleada boolean;
begin
  if correo like '%__correo_confirmado_por_maria__%' or position('@' in correo) = 0 then
    raise exception 'Sustituye el marcador por el correo que María confirmó.';
  end if;
  if not exists (select 1 from salons where slug = 'peluchic') then
    raise exception 'No existe el salón peluchic: carga antes seed-peluchic.sql.';
  end if;
  select id into uid from auth.users where lower(email) = correo;
  if uid is null then
    raise exception 'No hay ningún usuario con el correo %. Que María abra antes el enlace mágico.', correo;
  end if;
  insert into salon_members (user_id, salon_slug, rol) values (uid, 'peluchic', 'gerente')
    on conflict (user_id, salon_slug) do nothing;
  select exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='salon_members' and column_name='employee_id') into tiene_empleada;
  if tiene_empleada then
    update salon_members set employee_id = 'maria' where user_id = uid and salon_slug = 'peluchic';
  else
    raise exception 'Falta salon_members.employee_id: aplica primero supabase/pendiente.sql.';
  end if;
end
$alta$;
commit;
-- Debe devolver una fila con rol gerente y employee_id maria.
select m.salon_slug, m.rol, m.employee_id, u.email, m.creado
from salon_members m join auth.users u on u.id = m.user_id
where m.salon_slug = 'peluchic';
