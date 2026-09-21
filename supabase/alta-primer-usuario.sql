-- ===========================================================================
-- Alta del PRIMER usuario del panel: Adam, de THE BEST SHAVE & BARBER
--
-- Esto NO se ejecuta solo, ni lo ejecuta la aplicación, ni forma parte de
-- `scripts/migrate.ts`. Es un acto deliberado: se pega a mano en el SQL Editor
-- del panel de Supabase, una vez, cuando se quiere dar acceso a alguien.
--
-- ANTES de ejecutarlo hacen falta dos cosas:
--
--   1. Que `supabase/schema.sql` esté aplicado, es decir, que la tabla
--      `salon_members` exista.
--   2. Que Adam EXISTA como usuario de Supabase Auth. Y aquí está el detalle
--      importante: un usuario no existe hasta que ha pinchado el enlace mágico
--      que le llega al correo (o hasta que se le crea a mano desde
--      Authentication > Users > Add user > "Send invite"). Hasta entonces no
--      hay `user_id` que apuntar.
--
--      El camino corto y sin sorpresas:
--        a) Adam abre /login, escribe su correo y pide el enlace.
--        b) Pincha el enlace que le llega. Ya existe en `auth.users`.
--        c) Se ejecuta esto, y a partir de ese momento entra a su panel.
--      Entre (b) y (c) Adam tiene sesión pero NO tiene acceso: verá que no
--      puede entrar. Es lo correcto, y son dos minutos.
--
-- FALTA UN DATO, y no me lo voy a inventar: EL CORREO DE ADAM NO CONSTA en
-- ningún sitio del repositorio ni de la auditoría. Lo único que hay de él es
-- un teléfono. Hay que preguntárselo y escribirlo abajo, en el hueco marcado.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASO 1 — Rellena el correo aquí. Es el ÚNICO sitio que hay que tocar.
--          Tiene que ser EXACTAMENTE el mismo correo con el que Adam pide el
--          enlace mágico (Supabase lo guarda en minúsculas).
-- ---------------------------------------------------------------------------

-- ↓↓↓ SUSTITUYE ESTO ↓↓↓
--     '<correo de Adam>'   →   'loquesea@sudominio.com'

insert into salon_members (user_id, salon_slug, rol)
select u.id, 'the-best-shave-barber', 'dueno'
from auth.users u
where lower(u.email) = lower('<correo de Adam>')
on conflict (user_id, salon_slug) do nothing;

-- ---------------------------------------------------------------------------
-- PASO 2 — Comprueba que ha funcionado. Tiene que devolver UNA fila.
--
-- Si devuelve CERO filas, es que el usuario todavía no existe en `auth.users`:
-- o Adam no ha pinchado aún su enlace, o el correo está escrito distinto.
-- El `insert` de arriba no falla en ese caso, simplemente no inserta nada —
-- por eso este paso no es opcional.
-- ---------------------------------------------------------------------------

select m.salon_slug, m.rol, u.email, m.creado
from salon_members m
join auth.users u on u.id = m.user_id
where m.salon_slug = 'the-best-shave-barber';

-- ---------------------------------------------------------------------------
-- Para dar de alta a otra persona en otro salón, se copia el PASO 1 cambiando
-- el correo y el slug. Para quitarle el acceso a alguien:
--
--   delete from salon_members
--   where salon_slug = 'the-best-shave-barber'
--     and user_id = (select id from auth.users where lower(email) = lower('...'));
--
-- Quitar la fila le cierra el panel al instante siguiente que cargue datos:
-- la pertenencia se comprueba en cada llamada, no se guarda en su navegador.
-- ---------------------------------------------------------------------------
