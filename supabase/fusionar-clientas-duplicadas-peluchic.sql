-- =============================================================================
-- PeluChic · detectar y fusionar clientas duplicadas (25-oct-2026)
-- NO EJECUTADO. Lo revisa y lo pega Tomás en el SQL Editor del proyecto de
-- Supabase de siShow (el mismo de pendiente.sql). Tres pasos, por separado.
--
-- Por qué: el 22-oct a Patricia y Anca no les salían clientas importadas y
-- alguna se dio de alta a mano (p. ej. la clienta de código TPV 000100). Si la
-- importación complementaria entra después, puede haber dos fichas de la
-- misma persona.
--
-- Criterio de duplicado (mismo salón): mismo nombre normalizado (sin tildes,
-- sin mayúsculas, espacios simples) y, como mucho, UN teléfono entre todas
-- (la creada a mano sin teléfono, o el mismo). Mismo nombre con teléfonos
-- distintos se lista en el paso 1 pero no se fusiona: lo decide una persona. NO se fusiona por teléfono: la base ya
-- impide dos fichas con el mismo teléfono (unique salon_slug+phone_key) y los
-- teléfonos compartidos de TPV 123 son familiares distintos.
-- Se queda la ficha con código TPV (la importada); si ninguna lo tiene, la más
-- antigua. Citas y pagos pasan a la que se queda; las notas se juntan; el
-- teléfono y el correo de la otra se conservan si la que se queda no los tiene.
-- Nada se borra hasta haber movido citas y pagos (appointments.client_id es
-- ON DELETE CASCADE: borrar antes perdería citas).
-- =============================================================================

-- PASO 1 · SOLO LECTURA: qué grupos hay. Revisar la lista antes de seguir.
with norm as (
  select id, name, phone, email, tpv_code, created_at,
         lower(regexp_replace(translate(trim(name),
           'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñ',
           'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'), '\s+', ' ', 'g')) as clave
  from clients where salon_slug = 'peluchic'
)
select clave, count(*) as fichas,
       string_agg(coalesce(tpv_code, '—') || ' · ' || coalesce(phone, 'sin teléfono') || ' · ' ||
                  (select count(*) from appointments a where a.client_id = n.id)::text || ' citas',
                  '  |  ' order by created_at) as detalle
from norm n
group by clave having count(*) > 1
order by clave;

-- PASO 2 · FUSIÓN (en transacción; por defecto termina en ROLLBACK para
-- ensayar: mira los recuentos del final y, si cuadran, cambia ROLLBACK por
-- COMMIT y vuelve a ejecutar).
begin;

create temp table fusion on commit drop as
with norm as (
  select id, tpv_code, created_at, phone_key,
         lower(regexp_replace(translate(trim(name),
           'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñ',
           'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'), '\s+', ' ', 'g')) as clave
  from clients where salon_slug = 'peluchic'
), orden as (
  select id, clave,
         first_value(id) over (partition by clave order by (tpv_code is null), created_at, id) as queda,
         count(*) over (partition by clave) as n
  from norm
), telefonos as (
  -- Dos fichas con el mismo nombre y teléfonos DISTINTOS pueden ser dos
  -- personas (hay muchas «Marta»): esas no se tocan, salen en el paso 1.
  select clave, count(distinct phone_key) as distintos from norm group by clave
)
select o.id as sobra, o.queda from orden o join telefonos t using (clave)
where o.n > 1 and o.id <> o.queda and t.distintos <= 1;

select count(*) as fichas_que_se_fusionan from fusion;

-- Datos que la que se queda no tenga.
update clients c set
  phone = coalesce(c.phone, o.phone),
  phone_key = coalesce(c.phone_key, case when c.phone is null then o.phone_key end),
  email = coalesce(c.email, o.email),
  notes = nullif(concat_ws(E'\n', c.notes, o.notes), '')
from fusion f join clients o on o.id = f.sobra
where c.id = f.queda;

-- Antes de mover datos, el teléfono de la que sobra se libera (unique).
update clients o set phone = null, phone_key = null from fusion f where o.id = f.sobra;

update appointments a set client_id = f.queda from fusion f where a.client_id = f.sobra;
update payments p set client_id = f.queda from fusion f where p.client_id = f.sobra;

select count(*) as citas_que_aun_apuntan_a_fichas_que_sobran
from appointments a join fusion f on a.client_id = f.sobra;   -- debe ser 0

delete from clients c using fusion f where c.id = f.sobra and c.salon_slug = 'peluchic';

select count(*) as clientas_peluchic_tras_fusion from clients where salon_slug = 'peluchic';

rollback;   -- ← cambiar a COMMIT solo tras revisar los recuentos

-- PASO 3 · MARCHA ATRÁS: esta fusión no se deshace con SQL. Antes del COMMIT,
-- haz una copia (Supabase → Database → Backups, o
--   create table clients_copia_20261025 as select * from clients where salon_slug='peluchic';
--   create table appointments_copia_20261025 as select * from appointments where salon_slug='peluchic';
-- ) y, para volver, restaura desde esas copias.
