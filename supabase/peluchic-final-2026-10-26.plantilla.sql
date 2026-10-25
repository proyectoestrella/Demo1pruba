-- =============================================================================
-- PeluChic · SQL FINAL (26-oct-2026). Se pega UNA vez en el SQL Editor de
-- Supabase (proyecto de siShow). Idempotente: si se pega dos veces, la segunda
-- no cambia nada. Todo va en UNA transacción: si una comprobación falla, no se
-- aplica nada (sale un ERROR y la base queda como estaba).
--
-- Qué hace:
--   1. Copia de seguridad de clientas y citas de PeluChic (tablas *_respaldo_20261026).
--   2. Permite que dos personas de la familia compartan teléfono (quita el
--      único sobre el texto del teléfono; `phone_key` sigue siendo único y es
--      de la titular del número).
--   3. Completa las 1.336 clientas del Excel de TPV 123: las que ya están se
--      completan sin pisar nada; las altas a mano inequívocas reciben su código;
--      las que faltan (sobre todo las 88 de teléfono compartido) se crean.
--   4. Devuelve su nombre a las titulares que una cita del panel renombró y
--      pasa a cada familiar las citas que son suyas.
--   5. Fusiona solo duplicadas inequívocas (mismo nombre, como mucho un
--      teléfono, una sin código TPV) sin perder citas ni pagos.
--   6. Nota y enlace de reseñas de Google.
--   7. Borra las pruebas llamadas «PRUEBA SISHOW BORRAR».
--   8. Recuentos antes/después y listado de dudosas (no se tocan).
-- Marcha atrás: al final del fichero.
-- =============================================================================

begin;

-- 0 · Esquema esperado -------------------------------------------------------
do $$ begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'clients'
      and column_name in ('tpv_code','birthday','address','tax_id','tpv_alta','tpv_last_visit','phone_key','notes','email')) <> 9 then
    raise exception 'Faltan columnas en clients: no se aplica nada';
  end if;
end $$;

-- 1 · Copia de seguridad (solo la primera vez), en un esquema privado que la
--     API de Supabase no publica (datos personales: nada de `public`).
create schema if not exists respaldo;
revoke all on schema respaldo from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema respaldo from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema respaldo from authenticated'; end if;
end $$;
create table if not exists respaldo.clients_20261026 as
  select * from clients where salon_slug = 'peluchic';
create table if not exists respaldo.appointments_20261026 as
  select * from appointments where salon_slug = 'peluchic';
create table if not exists respaldo.payments_20261026 as
  select * from payments where salon_slug = 'peluchic';

-- ANTES
select 'antes' as momento, count(*) as clientas,
       count(*) filter (where tpv_code is not null) as con_codigo,
       count(*) filter (where phone_key is null) as sin_phone_key
from clients where salon_slug = 'peluchic';

-- 2 · Teléfono compartido en familia -----------------------------------------
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c join pg_class t on t.oid = c.conrelid
    where t.relname = 'clients' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike 'UNIQUE (salon_slug, phone)'
  loop
    execute format('alter table clients drop constraint %I', r.conname);
  end loop;
end $$;

-- 3 · Datos del Excel de TPV 123 (7-oct-2026, 1.336 clientas) ------------------
create temp table tpv (
  codigo text, nombre text, telefono text, clave text, email text, dni text,
  direccion text, alta date, cumple date, ultima date, recomendada text
) on commit drop;
insert into tpv values
/*DATOS*/;

do $$ begin
  if (select count(*) from tpv) <> 1336 then raise exception 'El bloque de datos no tiene 1.336 filas: no se aplica nada'; end if;
  if (select count(distinct ltrim(codigo, '0')) from tpv where coalesce(codigo, '') <> '') <> 1336 then
    raise exception 'Hay códigos TPV vacíos o repetidos en el bloque de datos: no se aplica nada';
  end if;
end $$;

create temp table tpv_n on commit drop as
select t.*, ltrim(codigo, '0') as cod,
  lower(translate(split_part(trim(nombre), ' ', 1), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) as primero,
  lower(regexp_replace(translate(trim(nombre), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '\s+', ' ', 'g')) as completo
from tpv t;

create or replace temp view cli_n as
select c.*, ltrim(coalesce(c.tpv_code, ''), '0') as cod,
  lower(translate(split_part(trim(c.name), ' ', 1), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) as primero,
  lower(regexp_replace(translate(trim(c.name), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '\s+', ' ', 'g')) as completo
from clients c where c.salon_slug = 'peluchic';

-- 3a · Altas a mano inequívocas: reciben el código de su fila del Excel.
--      Solo altas hechas a mano desde el 22-oct, con el mismo primer nombre y
--      (el mismo teléfono, o el primer apellido igual en sus 5 primeras letras
--      y además el mismo nombre completo o sin teléfono), una sola candidata
--      por cada lado. Lo demás va al listado de dudosas.
create temp table enlace_manual on commit drop as
with faltan as (
  select t.* from tpv_n t where not exists (select 1 from cli_n c where c.cod = t.cod and c.tpv_code is not null)
), cand as (
  select f.codigo, c.id
  from faltan f join cli_n c on c.tpv_code is null and c.primero = f.primero
   and c.created_at >= timestamptz '2026-10-22 00:00+02'
   and ( (f.clave is not null and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = f.clave)
      or ( split_part(f.completo, ' ', 2) <> ''
           and left(split_part(c.completo, ' ', 2), 5) = left(split_part(f.completo, ' ', 2), 5)
           and (c.completo = f.completo or c.phone is null) ) )
)
select codigo, id from cand
where codigo in (select codigo from cand group by codigo having count(*) = 1)
  and id in (select id from cand group by id having count(*) = 1);

update clients c set tpv_code = e.codigo, updated_at = now()
from enlace_manual e where c.id = e.id and c.tpv_code is null;

-- 3b · Completar las que ya están (nunca se pisa un dato que ya tenga).
update clients c set
  phone = coalesce(nullif(c.phone, ''), t.telefono),
  email = coalesce(nullif(c.email, ''), t.email),
  tax_id = coalesce(nullif(c.tax_id, ''), t.dni),
  address = coalesce(nullif(c.address, ''), t.direccion),
  tpv_alta = coalesce(c.tpv_alta, t.alta),
  birthday = coalesce(c.birthday, t.cumple),
  tpv_last_visit = coalesce(c.tpv_last_visit, t.ultima),
  notes = case when t.recomendada is not null and coalesce(c.notes, '') not like '%Recomendada por: ' || t.recomendada || '%'
               then concat_ws(' · ', nullif(c.notes, ''), 'Recomendada por: ' || t.recomendada) else c.notes end
from tpv_n t
where c.salon_slug = 'peluchic' and c.tpv_code is not null and ltrim(c.tpv_code, '0') = t.cod;

-- 3c · Crear las que faltan. El teléfono se guarda siempre; `phone_key` solo
--      si nadie lo tiene (la primera de la familia por código), si no, es familiar.
insert into clients (salon_slug, name, phone, phone_key, email, notes, tpv_code, birthday, address, tax_id, tpv_alta, tpv_last_visit)
select 'peluchic', t.nombre, t.telefono, null, t.email,
  concat_ws(' · ', 'Importada de TPV 123 (código ' || t.codigo || ')',
    case when t.recomendada is not null then 'Recomendada por: ' || t.recomendada end),
  t.codigo, t.cumple, t.direccion, t.dni, t.alta, t.ultima
from tpv_n t
where not exists (select 1 from clients c where c.salon_slug = 'peluchic' and c.tpv_code is not null and ltrim(c.tpv_code, '0') = t.cod);

with libres as (
  select distinct on (t.clave) c.id, t.clave
  from tpv_n t join clients c on c.salon_slug = 'peluchic' and ltrim(c.tpv_code, '0') = t.cod
  where t.clave is not null and c.phone_key is null
    and not exists (select 1 from clients o where o.salon_slug = 'peluchic' and o.phone_key = t.clave)
  order by t.clave, t.codigo
)
update clients c set phone_key = l.clave from libres l where c.id = l.id;

update clients c set notes = concat_ws(' · ', nullif(c.notes, ''), 'Comparte teléfono con ' || ti.name)
from clients ti
where c.salon_slug = 'peluchic' and ti.salon_slug = 'peluchic' and c.phone_key is null and c.phone is not null
  and ti.phone_key = right(regexp_replace(c.phone, '\D', '', 'g'), 9) and ti.id <> c.id
  and coalesce(c.notes, '') not like '%Comparte teléfono con%';

-- 4 · Titulares renombradas por una cita del panel ---------------------------
--      (su código dice otro nombre y el que tiene ahora es el de otra persona
--      que comparte su teléfono): vuelven a su nombre del Excel.
create temp table renombradas on commit drop as
select c.id, c.name as nombre_actual, t.nombre as nombre_excel
from cli_n c join tpv_n t on c.tpv_code is not null and t.cod = c.cod
where c.primero <> t.primero
  and exists (select 1 from tpv_n o where o.clave = t.clave and o.clave is not null and o.cod <> t.cod and o.primero = c.primero);
update clients c set name = r.nombre_excel, updated_at = now() from renombradas r where c.id = r.id;

--      Cada cita va a la persona cuyo primer nombre lleva la cita, si es una
--      familiar con el mismo teléfono (y solo una).
with citas as (
  select a.id as cita, f.id as familiar
  from appointments a
  join clients ti on ti.id = a.client_id and ti.salon_slug = 'peluchic' and ti.phone_key is not null
  join clients f on f.salon_slug = 'peluchic' and f.phone_key is null and f.id <> ti.id
       and right(regexp_replace(coalesce(f.phone, ''), '\D', '', 'g'), 9) = ti.phone_key
  where a.salon_slug = 'peluchic'
    and lower(translate(split_part(trim(a.client_name), ' ', 1), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
        <> lower(translate(split_part(trim(ti.name), ' ', 1), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
    and lower(translate(split_part(trim(a.client_name), ' ', 1), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
        = lower(translate(split_part(trim(f.name), ' ', 1), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
)
update appointments a set client_id = c.familiar
from citas c where a.id = c.cita and c.cita in (select cita from citas group by cita having count(*) = 1);

-- 5 · Fusión de duplicadas inequívocas ----------------------------------------
create temp table fusion on commit drop as
with tel as (
  select completo, count(distinct phone_key) as tels from cli_n group by completo
), g as (
  select c.id, c.completo, c.tpv_code, c.created_at, c.phone_key,
         count(*) over (partition by c.completo) as n,
         t.tels,
         count(c.tpv_code) over (partition by c.completo) as con_codigo
  from cli_n c join tel t using (completo)
)
select s.id as sobra, q.id as queda
from g s join g q on q.completo = s.completo and q.tpv_code is not null and s.tpv_code is null and s.id <> q.id
where s.n = 2 and s.con_codigo = 1 and s.tels <= 1
  and s.created_at >= timestamptz '2026-10-22 00:00+02'
  and (s.phone_key is null or s.phone_key = q.phone_key)
  and not exists (select 1 from clients x where x.id = s.id and x.phone is not null and x.phone_key is null
                  and right(regexp_replace(x.phone, '\D', '', 'g'), 9) <> coalesce(q.phone_key, ''));

update clients c set
  email = coalesce(nullif(c.email, ''), o.email),
  notes = nullif(concat_ws(' · ', nullif(c.notes, ''), nullif(o.notes, '')), '')
from fusion f join clients o on o.id = f.sobra where c.id = f.queda;
update clients o set phone = null, phone_key = null from fusion f where o.id = f.sobra;
update appointments a set client_id = f.queda from fusion f where a.client_id = f.sobra;
update payments p set client_id = f.queda from fusion f where p.client_id = f.sobra;
do $$ begin
  if exists (select 1 from appointments a join fusion f on a.client_id = f.sobra) then
    raise exception 'Quedan citas en fichas que se iban a borrar: no se aplica nada';
  end if;
end $$;
delete from clients c using fusion f where c.id = f.sobra and c.salon_slug = 'peluchic';

-- 6 · Reseñas de Google (4,5 comprobado el 25-oct en Google Maps; 81 reseñas
--     anotadas el 22-oct: Google no enseña el número sin iniciar sesión).
update salons set profile = profile
  || jsonb_build_object('rating', 4.5, 'reviewCount', 81)
  || jsonb_build_object('enlaces', coalesce(profile->'enlaces', '{}'::jsonb)
       || jsonb_build_object('resenas', 'https://www.google.com/maps/search/?api=1&query=PeluChic&query_place_id=ChIJc_dY3q0uQg0ReeAzc1Y3irs'))
where slug = 'peluchic';

-- 7 · Pruebas de Tomás (sus cobros, si los hubiera, también) -----------------
delete from payments p where p.salon_slug = 'peluchic' and (
  p.client_name ilike 'PRUEBA SISHOW BORRAR%'
  or p.appointment_id in (select local_id from appointments where salon_slug = 'peluchic' and client_name ilike 'PRUEBA SISHOW BORRAR%'));
delete from appointments where salon_slug = 'peluchic' and client_name ilike 'PRUEBA SISHOW BORRAR%';
delete from clients c where c.salon_slug = 'peluchic' and c.name ilike 'PRUEBA SISHOW BORRAR%'
  and not exists (select 1 from appointments a where a.client_id = c.id);

-- 8 · Comprobaciones (si fallan, ERROR y no se aplica nada) -------------------
do $$
declare faltan int; citas_antes int; citas_despues int;
begin
  select count(*) into faltan from tpv_n t
   where not exists (select 1 from clients c where c.salon_slug = 'peluchic' and c.tpv_code is not null and ltrim(c.tpv_code, '0') = t.cod);
  if faltan > 0 then raise exception 'Faltan % clientas del Excel: no se aplica nada', faltan; end if;
  select count(*) into citas_antes from respaldo.appointments_20261026
   where client_name is null or client_name not ilike 'PRUEBA SISHOW BORRAR%';
  select count(*) into citas_despues from appointments where salon_slug = 'peluchic';
  if citas_despues < citas_antes then raise exception 'Se perderían citas (% → %): no se aplica nada', citas_antes, citas_despues; end if;
end $$;

-- DESPUÉS
select 'despues' as momento, count(*) as clientas,
       count(*) filter (where tpv_code is not null) as con_codigo,
       count(*) filter (where phone_key is null and phone is not null) as familiares,
       (select count(*) from appointments where salon_slug = 'peluchic') as citas
from clients where salon_slug = 'peluchic';

-- DUDOSAS (no se han tocado: revisarlas a mano en el panel)
select 'mismo nombre, varias fichas' as duda, c.name, count(*) as fichas
from cli_n c group by c.name, c.completo having count(*) > 1
union all
select 'alta a mano sin código', c.name, 1 from cli_n c where c.tpv_code is null
union all
select 'renombrada y devuelta a su nombre: ' || r.nombre_actual, r.nombre_excel, 1 from renombradas r
order by 1, 2;

commit;

-- MARCHA ATRÁS — SOLO justo después de pegar este SQL, antes de que entren
-- reservas nuevas: deja las clientas, citas y cobros de PeluChic como estaban
-- en la primera ejecución y BORRARÍA lo que se haya creado después. Si ya hay
-- actividad posterior, no la uses: pide ayuda (las copias siguen en `respaldo`).
-- begin;
-- delete from payments where salon_slug = 'peluchic';
-- insert into payments select * from respaldo.payments_20261026;
-- delete from appointments where salon_slug = 'peluchic';
-- delete from clients where salon_slug = 'peluchic';
-- insert into clients select * from respaldo.clients_20261026;
-- insert into appointments select * from respaldo.appointments_20261026;
-- commit;
-- (El único sobre el teléfono no se vuelve a poner: con familiares que comparten
--  número ya no se podría. Las reseñas se quitan con:
--  update salons set profile = profile || '{"rating":0,"reviewCount":0}' where slug='peluchic';)
