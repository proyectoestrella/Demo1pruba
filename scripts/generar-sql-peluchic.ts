/**
 * Genera supabase/seed-peluchic.sql y supabase/update-peluchic.sql a partir del
 * perfil de la demo (src/lib/demos/peluchic.ts): UNA sola fuente de verdad.
 *
 *   bun scripts/generar-sql-peluchic.ts
 *
 * No toca Supabase: solo escribe los dos ficheros. El test
 * src/lib/peluchic-sql.test.ts regenera en memoria y falla si los ficheros del
 * repo difieren (alguien tocó la demo sin volver a generar).
 *
 * EXCLUSIONES (lo que la demo tiene y producción NO lleva):
 *  - Nada de clientas, citas ni cobros inventados: viven fuera del perfil
 *    (la semilla de la demo los crea aparte) y no se serializan.
 *  - `plan`: se fuerza a "reservas" (la demo real va en "todo-incluido").
 *  - `rating` y `reviewCount`: la demo trae 4,5 / 81 «de su ficha de Google»,
 *    pero aquí no hay forma de verificar ese dato. Se publica 0 / 0, que la
 *    web pública trata como «sin nota» y oculta (ver lib/web-publica.ts). Se
 *    pueden poner a mano cuando alguien confirme la ficha.
 *  - `photoCount` y `galleryPhotos`: son las fotos de Google, que la demo ya
 *    no usa (manda `galeriaPropia`).
 *  - `nota` de cada día especial: texto interno de la demo («Festivo»…).
 *  - `depositBizumPhone`: no hay teléfono Bizum confirmado, no existe en el perfil.
 * Se mantienen los activos /demo/peluchic-* (portada, logos y galería): son
 * ficheros reales de public/ con sus fotos, no maquetas.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PELUCHIC } from "../src/lib/demos/peluchic";

export const SLUG = "peluchic";
const TAG = "$perfil$";

/** Perfil tal y como se guarda en `salons.profile` en producción. */
export function perfilProduccion(): Record<string, unknown> {
  const {
    plan: _plan,
    rating: _rating,
    reviewCount: _reviewCount,
    photoCount: _photoCount,
    galleryPhotos: _galleryPhotos,
    ...resto
  } = PELUCHIC as unknown as Record<string, unknown> & { diasEspeciales?: Array<Record<string, unknown>> };
  const diasEspeciales = (PELUCHIC.diasEspeciales ?? []).map((d) => {
    const { nota: _nota, ...sinNota } = d;
    return sinNota;
  });
  return { ...resto, plan: "reservas", rating: 0, reviewCount: 0, diasEspeciales };
}

/** JSON con una línea por clave del primer nivel y una por servicio (se lee y se revisa en un diff). */
function jsonLegible(obj: Record<string, unknown>): string {
  const lineas = Object.entries(obj).map(([k, v]) => {
    if (Array.isArray(v) && k === "menu") {
      return `  ${JSON.stringify(k)}:[\n${v.map((e) => "    " + JSON.stringify(e)).join(",\n")}\n  ]`;
    }
    return `  ${JSON.stringify(k)}:${JSON.stringify(v)}`;
  });
  const texto = `{\n${lineas.join(",\n")}\n}`;
  if (texto.includes(TAG)) throw new Error(`El perfil contiene ${TAG}`);
  return texto;
}

const COMPROBAR_PENDIENTE = `  -- 0. Comprobación de supabase/pendiente.sql: sin ello fallan el aviso de
  --    privacidad y el alta de María. Si falta algo, se aborta sin escribir nada.
  if to_regclass('public.salons') is null then
    raise exception 'Falta la tabla salons: aplica primero supabase/schema.sql.';
  end if;
  if to_regclass('public.perfil_versiones') is null then
    raise exception 'Falta la tabla perfil_versiones: aplica primero supabase/pendiente.sql.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='privacy_notice_acknowledged_at') then
    raise exception 'Falta appointments.privacy_notice_acknowledged_at: aplica primero supabase/pendiente.sql.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='salon_members' and column_name='employee_id') then
    raise exception 'Falta salon_members.employee_id: aplica primero supabase/pendiente.sql.';
  end if;`;

export function generarSeed(): string {
  return `-- GENERADO por scripts/generar-sql-peluchic.ts desde src/lib/demos/peluchic.ts.
-- NO editar a mano: cambia la demo y vuelve a generar (bun scripts/generar-sql-peluchic.ts).
--
-- Alta inicial de PeluChic. Úsalo SOLO si el salón aún no existe: si ya existe,
-- aborta con un mensaje y no cambia nada (para eso está update-peluchic.sql).
-- Antes comprueba que se aplicó supabase/pendiente.sql.
-- La fianza por hora está activa: 5 €/h, 4 h de plazo, Bizum marcado a mano.
-- Todo va en una transacción: si algo falla, no se guarda nada. Si sale un
-- error, ejecuta \`rollback;\` y vuelve a pulsar Run.
begin;
do $alta$
declare
  perfil jsonb := ${TAG}
${jsonLegible(perfilProduccion())}
  ${TAG}::jsonb;
  insertadas integer;
begin
${COMPROBAR_PENDIENTE}
  if jsonb_array_length(perfil->'menu') not between 1 and 60 or jsonb_array_length(perfil->'team') <> 3 or jsonb_array_length(perfil->'openingHours') <> 7 then
    raise exception 'Perfil PeluChic inválido';
  end if;
  insert into salons (slug, profile, updated_at) values ('${SLUG}', perfil, now()) on conflict (slug) do nothing;
  get diagnostics insertadas = row_count;
  if insertadas <> 1 then
    raise exception 'Ya existe salons.slug=${SLUG}; usa update-peluchic.sql.';
  end if;
end
$alta$;
commit;
select slug, jsonb_array_length(profile->'menu') as servicios, profile->>'depositEnabled' as fianza_activa, updated_at from salons where slug='${SLUG}';
`;
}

export function generarUpdate(): string {
  return `-- GENERADO por scripts/generar-sql-peluchic.ts desde src/lib/demos/peluchic.ts.
-- NO editar a mano: cambia la demo y vuelve a generar (bun scripts/generar-sql-peluchic.ts).
--
-- Actualiza el perfil de un PeluChic que YA existe.
-- ATENCIÓN: PISA la configuración actual (carta, equipo, horarios, preguntas,
-- precios literales, días especiales, textos…) con la de la puesta en marcha.
-- Es para usarlo ANTES de que María toque nada: cualquier cambio que ella haya
-- hecho en esos campos desde el panel se pierde. Las claves que no están aquí
-- (plantillas de WhatsApp, colores, bloqueos…) se conservan.
-- Antes de escribir guarda el perfil anterior en perfil_versiones (nota
-- 'antes de update-peluchic.sql'); con rollback-update-peluchic.sql se recupera.
-- Idempotente: si el perfil ya es este, no escribe ni guarda otra copia.
-- No toca clientas, citas, pagos ni miembros. Una transacción: si sale un
-- error, ejecuta \`rollback;\` y vuelve a pulsar Run.
begin;
do $actualizar$
declare
  nuevo jsonb := ${TAG}
${jsonLegible(perfilProduccion())}
  ${TAG}::jsonb;
  previo jsonb;
  resultado jsonb;
begin
${COMPROBAR_PENDIENTE}
  select profile into previo from salons where slug = '${SLUG}' for update;
  if previo is null then
    raise exception 'No existe salons.slug=${SLUG}; usa seed-peluchic.sql.';
  end if;
  resultado := previo || nuevo;
  if resultado = previo then
    raise notice 'PeluChic ya tiene este perfil: no se cambia nada.';
    return;
  end if;
  insert into perfil_versiones (id, salon_slug, perfil, nota)
    values (gen_random_uuid(), '${SLUG}', previo, 'antes de update-peluchic.sql');
  update salons set profile = resultado, updated_at = now() where slug = '${SLUG}';
end
$actualizar$;
commit;
select slug, jsonb_array_length(profile->'menu') as servicios, profile->>'depositEnabled' as fianza_activa, updated_at,
  (select count(*) from perfil_versiones where salon_slug='${SLUG}' and nota='antes de update-peluchic.sql') as copias_guardadas
from salons where slug='${SLUG}';
`;
}

if (import.meta.main) {
  const dir = join(import.meta.dir, "..", "supabase");
  writeFileSync(join(dir, "seed-peluchic.sql"), generarSeed());
  writeFileSync(join(dir, "update-peluchic.sql"), generarUpdate());
  console.log("Generados supabase/seed-peluchic.sql y supabase/update-peluchic.sql");
}
