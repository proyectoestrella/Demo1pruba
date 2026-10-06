-- Plantilla idempotente y deliberadamente bloqueada para el perfil real de
-- PeluChic. Completar solo después de que María confirme los campos en la
-- reunión. No lee credenciales, no toca citas ni clientas y no sobreescribe un
-- perfil previo.
-- Aplicar manualmente desde Supabase SQL Editor, nunca desde el navegador.

do $alta$
declare
  perfil jsonb := $perfil$
  {
    "id": "peluchic",
    "slug": "peluchic",
    "name": "PeluChic",
    "plan": "reservas",
    "tagline": "__PENDIENTE_TIPO_Y_LEMA__",
    "about": "__PENDIENTE_TEXTO_DE_LA_WEB__",
    "address": "__PENDIENTE_DIRECCION_PUBLICA__",
    "phone": "__PENDIENTE_TELEFONO_PUBLICO__",
    "whatsapp": "__PENDIENTE_WHATSAPP_O_VACIO_CONFIRMADO__",
    "instagram": "__PENDIENTE_USUARIO_INSTAGRAM_O_VACIO_CONFIRMADO__",
    "enlaces": {
      "resenas": "__PENDIENTE_ENLACE_DIRECTO_A_RESEÑAS_GOOGLE__",
      "web": "__PENDIENTE_WEB_PUBLICA_O_VACIO_CONFIRMADO__",
      "instagram": "__PENDIENTE_ENLACE_INSTAGRAM_O_VACIO_CONFIRMADO__",
      "facebook": "__PENDIENTE_ENLACE_FACEBOOK_O_VACIO_CONFIRMADO__"
    },
    "openingHours": [
      "__PENDIENTE_LUNES__",
      "__PENDIENTE_MARTES__",
      "__PENDIENTE_MIERCOLES__",
      "__PENDIENTE_JUEVES__",
      "__PENDIENTE_VIERNES__",
      "__PENDIENTE_SABADO__",
      "__PENDIENTE_DOMINGO__"
    ],
    "timeZone": "Europe/Madrid",
    "rating": 0,
    "reviewCount": 0,
    "specialties": [],
    "logoUrl": "/demo/peluchic-logo.png",
    "logotipoClaroUrl": "/demo/peluchic-logotipo-blanco.png",
    "logotipoOscuroUrl": "/demo/peluchic-logotipo-oscuro.png",
    "team": [
      "__PENDIENTE_NOMBRE_01__~__PENDIENTE_ESPECIALIDAD_01__",
      "__PENDIENTE_NOMBRE_02__~__PENDIENTE_ESPECIALIDAD_02__",
      "__PENDIENTE_NOMBRE_03__~__PENDIENTE_ESPECIALIDAD_03__"
    ],
    "teamIds": ["peluchic-profesional-01", "peluchic-profesional-02", "peluchic-profesional-03"],
    "teamHours": [
      ["__PENDIENTE_LUNES_01__", "__PENDIENTE_MARTES_01__", "__PENDIENTE_MIERCOLES_01__", "__PENDIENTE_JUEVES_01__", "__PENDIENTE_VIERNES_01__", "__PENDIENTE_SABADO_01__", "__PENDIENTE_DOMINGO_01__"],
      ["__PENDIENTE_LUNES_02__", "__PENDIENTE_MARTES_02__", "__PENDIENTE_MIERCOLES_02__", "__PENDIENTE_JUEVES_02__", "__PENDIENTE_VIERNES_02__", "__PENDIENTE_SABADO_02__", "__PENDIENTE_DOMINGO_02__"],
      ["__PENDIENTE_LUNES_03__", "__PENDIENTE_MARTES_03__", "__PENDIENTE_MIERCOLES_03__", "__PENDIENTE_JUEVES_03__", "__PENDIENTE_VIERNES_03__", "__PENDIENTE_SABADO_03__", "__PENDIENTE_DOMINGO_03__"]
    ],
    "menu": ["__PENDIENTE_SERVICIO_01__~30~0~__PENDIENTE_CATEGORIA_01__"],
    "preguntasReserva": [],
    "duracionFlexible": null,
    "ocultarPrecioReserva": true,
    "depositEnabled": false,
    "noShowFeeEur": 0
  }
  $perfil$::jsonb;
  filas_insertadas integer;
begin
  if strpos(perfil::text, '__PENDIENTE_') > 0 then
    raise exception 'Plantilla PeluChic incompleta: sustituye todos los __PENDIENTE_* y vuelve a validar antes de aplicar.';
  end if;

  if perfil->>'slug' <> 'peluchic' or perfil->>'plan' <> 'reservas' then
    raise exception 'La plantilla debe mantener slug peluchic y plan Básico (reservas).';
  end if;
  if jsonb_typeof(perfil->'openingHours') is distinct from 'array'
     or jsonb_typeof(perfil->'team') is distinct from 'array'
     or jsonb_typeof(perfil->'teamHours') is distinct from 'array'
     or jsonb_typeof(perfil->'teamIds') is distinct from 'array'
     or jsonb_typeof(perfil->'menu') is distinct from 'array' then
    raise exception 'Horario, equipo, horarios individuales y carta deben ser listas.';
  end if;
  if jsonb_array_length(perfil->'openingHours') <> 7 then
    raise exception 'openingHours debe tener siete días, lunes a domingo.';
  end if;
  if jsonb_array_length(perfil->'team') not between 1 and 3
     or jsonb_array_length(perfil->'teamHours') <> jsonb_array_length(perfil->'team') then
    raise exception 'Básico admite de una a tres profesionales y debe haber un horario individual por persona.';
  end if;
  if jsonb_array_length(perfil->'teamIds') <> jsonb_array_length(perfil->'team') then
    raise exception 'Debe haber un identificador estable por cada profesional confirmada.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(perfil->'team') as profesional(valor)
    where nullif(btrim(split_part(profesional.valor, '~', 1)), '') is null
  ) then
    raise exception 'Cada entrada del equipo necesita un nombre confirmado.';
  end if;
  if jsonb_array_length(perfil->'menu') not between 1 and 60 then
    raise exception 'La carta debe llevar de uno a sesenta servicios confirmados.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(perfil->'menu') as servicio(valor)
    where nullif(btrim(split_part(servicio.valor, '~', 1)), '') is null
       or case
            when split_part(servicio.valor, '~', 2) ~ '^[0-9]+$'
              then split_part(servicio.valor, '~', 2)::integer not between 5 and 240
            else true
          end
       or case
            when replace(split_part(servicio.valor, '~', 3), ',', '.') ~ '^[0-9]+(\.[0-9]+)?$'
              then replace(split_part(servicio.valor, '~', 3), ',', '.')::numeric < 0
            else true
          end
       or nullif(btrim(split_part(servicio.valor, '~', 4)), '') is null
  ) then
    raise exception 'Cada servicio debe llevar nombre, duración de 5 a 240 minutos y precio no negativo.';
  end if;
  if jsonb_typeof(perfil->'duracionFlexible') is distinct from 'boolean' then
    raise exception 'Confirma si la duración publicada será flexible o fija y guarda true/false.';
  end if;
  if jsonb_typeof(perfil->'ocultarPrecioReserva') is distinct from 'boolean' then
    raise exception 'Confirma si los precios se muestran al reservar y guarda true/false.';
  end if;
  if coalesce(perfil#>>'{enlaces,resenas}', '') not like 'https://%' then
    raise exception 'Confirma y añade el enlace HTTPS directo para pedir una reseña en Google.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(perfil->'teamHours') as profesional(horario)
    where jsonb_typeof(profesional.horario) is distinct from 'array'
  ) then
    raise exception 'Cada profesional debe tener una lista de horarios por día.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(perfil->'teamHours') as profesional(horario)
    where jsonb_array_length(profesional.horario) <> 7
  ) then
    raise exception 'Cada profesional debe tener siete días de horario individual.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(perfil->'openingHours') as dia(valor)
    where nullif(btrim(dia.valor), '') is null
       or (btrim(dia.valor) <> 'Cerrado'
           and btrim(dia.valor) !~ '^([0-9]{1,2}:[0-5][0-9][[:space:]]*[–—-][[:space:]]*[0-9]{1,2}:[0-5][0-9])([[:space:]]*,[[:space:]]*[0-9]{1,2}:[0-5][0-9][[:space:]]*[–—-][[:space:]]*[0-9]{1,2}:[0-5][0-9])*$')
  ) or exists (
    select 1
    from jsonb_array_elements(perfil->'teamHours') as profesional(horario)
    cross join lateral jsonb_array_elements_text(profesional.horario) as dia(valor)
    where nullif(btrim(dia.valor), '') is null
       or (btrim(dia.valor) <> 'Cerrado'
           and btrim(dia.valor) !~ '^([0-9]{1,2}:[0-5][0-9][[:space:]]*[–—-][[:space:]]*[0-9]{1,2}:[0-5][0-9])([[:space:]]*,[[:space:]]*[0-9]{1,2}:[0-5][0-9][[:space:]]*[–—-][[:space:]]*[0-9]{1,2}:[0-5][0-9])*$')
  ) then
    raise exception 'Cada horario debe usar rangos HH:MM–HH:MM separados por comas o Cerrado.';
  end if;

  insert into salons (slug, profile, updated_at)
  values ('peluchic', perfil, now())
  on conflict (slug) do nothing;
  get diagnostics filas_insertadas = row_count;
  if filas_insertadas = 0 then
    raise exception 'Ya existe salons.slug=peluchic. No se modificó; guarda una copia y revisa el perfil antes de preparar un UPDATE.';
  end if;
end
$alta$;

-- Comprobación de salida: debe devolver una fila, plan reservas, 1-3 personas,
-- horarios con siete posiciones, carta confirmada y ningún marcador pendiente.
select slug,
       profile->>'plan' as plan,
       jsonb_array_length(profile->'team') as profesionales,
       jsonb_array_length(profile->'menu') as servicios,
       updated_at
from salons
where slug = 'peluchic';
