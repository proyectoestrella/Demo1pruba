-- Alta de María como gerente de PeluChic. Ejecutar manualmente en SQL Editor
-- SOLO después de que María haya abierto el enlace mágico en su correo y su
-- cuenta ya aparezca en auth.users. No crea la cuenta ni envía correos.
-- Sustituye únicamente el marcador por el correo que ella confirme.

insert into salon_members (user_id, salon_slug, rol)
select u.id, 'peluchic', 'gerente'
from auth.users u
where lower(u.email) = lower('__CORREO_CONFIRMADO_POR_MARIA__')
on conflict (user_id, salon_slug) do nothing;

-- Debe devolver una fila con rol gerente. Cero filas: revisar correo y que
-- María haya abierto el enlace antes de ejecutar el alta.
select m.salon_slug, m.rol, u.email, m.creado
from salon_members m
join auth.users u on u.id = m.user_id
where m.salon_slug = 'peluchic'
  and lower(u.email) = lower('__CORREO_CONFIRMADO_POR_MARIA__');
