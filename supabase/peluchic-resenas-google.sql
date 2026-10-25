-- PeluChic · nota y enlace de reseñas de Google en su web (25-oct-2026)
-- NO EJECUTADO. Lo pega Tomás en el SQL Editor del proyecto de siShow.
-- Cifras de su ficha de Google tal y como se anotaron el 22-oct (4,5 · 81
-- reseñas): compruébalas en Google Maps antes y cámbialas aquí si han variado.
-- Alternativa sin SQL: Mi página → Reseñas → nota y número → Publicar.

-- 1 · Antes (apunta lo que salga, es la marcha atrás):
select profile->'rating' as nota, profile->'reviewCount' as resenas, profile->'enlaces'->'resenas' as enlace
from salons where slug = 'peluchic';

-- 2 · Cambio:
update salons set profile = profile
  || jsonb_build_object('rating', 4.5, 'reviewCount', 81)
  || jsonb_build_object('enlaces', coalesce(profile->'enlaces', '{}'::jsonb)
       || jsonb_build_object('resenas', 'https://www.google.com/maps/search/?api=1&query=PeluChic&query_place_id=ChIJc_dY3q0uQg0ReeAzc1Y3irs'))
where slug = 'peluchic';

-- 3 · Comprobación (debe salir 4.5 · 81 · el enlace):
select profile->'rating', profile->'reviewCount', profile->'enlaces'->'resenas' from salons where slug = 'peluchic';

-- Marcha atrás: vuelve a poner los valores del paso 1, por ejemplo
-- update salons set profile = profile || '{"rating": 0, "reviewCount": 0}'::jsonb where slug = 'peluchic';
