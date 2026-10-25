-- PeluChic · comprobación de SOLO LECTURA antes de abrir reservas (25-oct-2026)
-- Pegar en el SQL Editor del proyecto de siShow. No cambia nada.

-- 1 · Columnas que la reserva web necesita. Deben salir las 2 filas.
--     Si falta privacy_notice_acknowledged_at, TODA reserva web falla:
--     aplicar antes supabase/pendiente.sql (tarea «Aplicar el SQL pendiente de PeluChic en Supabase»).
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'appointments'
  and column_name in ('privacy_notice_acknowledged_at', 'origen_reserva')
order by 1;

-- 2 · ¿Existe la exclusión antigua que impide solapar reservas web?
--     1 fila = existe → un solape en la exposición del color saldrá como «hueco
--     ocupado» hasta aplicar supabase/solape-exposicion.sql. 0 filas = nada que hacer.
select conname from pg_constraint where conname = 'appointments_web_sin_solape_excl';

-- 3 · Clientas de PeluChic y cuántas sin teléfono (esperado ≈ 1.248 + altas a mano).
select count(*) as clientas, count(*) filter (where phone is null) as sin_telefono,
       count(*) filter (where tpv_code is null) as sin_codigo_tpv
from clients where salon_slug = 'peluchic';

-- 4 · Plan, equipo y ajustes que mira la reserva.
select profile->>'plan' as plan, profile->'team' as equipo, profile->>'timeZone' as zona,
       profile->>'depositMode' as fianza, profile->>'depositHourlyRateEur' as euros_hora,
       profile->>'ocultarPrecioReserva' as oculta_precio, profile->'rating' as nota
from salons where slug = 'peluchic';
