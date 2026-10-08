# Puesta en marcha de PeluChic · guía para Tomás

Los ficheros SQL están preparados y probados en un Postgres de prueba en memoria, pero **no se han ejecutado contra Supabase real**. Se pegan en el *SQL Editor* de Supabase (menú izquierdo, icono `SQL`), se pulsa **Run** y se mira el resultado.

Los ficheros `supabase/seed-peluchic.sql` y `supabase/update-peluchic.sql` los genera un script a partir de la demo (`bun scripts/generar-sql-peluchic.ts`). **No se editan a mano**: lo que ves en la demo es exactamente lo que se carga. Todos los scripts van dentro de una transacción: o se aplica todo o no se aplica nada.

**Si te sale un error rojo:** escribe `rollback;` en el editor, pulsa Run, y vuelve a pegar y ejecutar el script. No se habrá guardado nada a medias.

## Paso 0 · Comprobar que Supabase está al día

Pega esto y pulsa Run (solo lee):

```sql
select
  to_regclass('public.perfil_versiones') is not null as tabla_versiones,
  exists (select 1 from information_schema.columns where table_name='appointments' and column_name='privacy_notice_acknowledged_at') as aviso_privacidad,
  exists (select 1 from information_schema.columns where table_name='salon_members' and column_name='employee_id') as miembro_profesional;
```

Deben salir las tres columnas en `true`. Si alguna sale `false`, abre `supabase/pendiente.sql`, pégalo entero en el editor y ejecútalo (es repetible sin riesgo), y vuelve a lanzar la comprobación. Los scripts de carga también lo comprueban y se paran con un mensaje claro si falta algo.

## Paso 1 · ¿Existe ya el salón?

```sql
select slug, updated_at from salons where slug = 'peluchic';
```

- **No sale ninguna fila:** el salón no existe. Ve al paso 2 con `seed`.
- **Sale una fila:** ya existe. **No uses seed.** Ve al paso 2 con `update`.

## Paso 2 · Cargar el perfil

**Si no existía → `supabase/seed-peluchic.sql`.** Pega el fichero entero, Run. Al final muestra una fila con `servicios = 57` y `fianza_activa = false`.

**Si ya existía → `supabase/update-peluchic.sql`.** Antes de escribir guarda una copia del perfil anterior dentro de Supabase (tabla `perfil_versiones`). Ojo: **sustituye la configuración actual** (carta, equipo, horarios, preguntas, precios, textos) por la de la puesta en marcha. Úsalo solo antes de que María haya cambiado cosas desde el panel. Se puede ejecutar dos veces sin problema (la segunda no hace nada). Al final muestra 57 servicios y cuántas copias hay guardadas.

**Para deshacer el update:** `supabase/rollback-update-peluchic.sql` (restaura la copia guardada por el update; descarta lo que se haya cambiado después). No hay script para deshacer un `seed`: borrar un salón arrastra datos asociados (por ejemplo la suscripción del calendario), así que no hay botón automático; si hiciera falta, se decide a mano entre los dos.

## Paso 3 · Dar de alta a María

1. Configura la URL de retorno autorizada y pídele el enlace mágico al correo que ella confirme.
2. Espera a que **abra el enlace** (hasta entonces su cuenta no existe).
3. Abre `supabase/alta-primer-usuario-peluchic.sql`, cambia **solo** `__CORREO_CONFIRMADO_POR_MARIA__` por su correo (una única vez, en la línea marcada), pega y Run.
4. Debe salir una fila con `rol = gerente` y `employee_id = maria`. Si el correo no cambia o no existe ese usuario, el script se para con un mensaje claro.

No uses el correo de privacidad como correo de acceso sin que María lo confirme.

## Paso 4 · Comprobar la web pública

Abre la ruta `/s/peluchic` del dominio donde esté desplegado siShow, en una ventana privada. Mira:

- Aparecen las 7 categorías y los 57 servicios, con los precios literales (por ejemplo «24 € / 28 € / 31 €» en Peinar).
- Aparecen el equipo (María, Anca, Patricia), el horario (martes a viernes 10–20, sábado 9–14) y las fotos.
- **No** aparece ninguna nota ni número de reseñas (se ha dejado sin nota a propósito: ver «Pendientes»).
- Al reservar, las preguntas de pelo y color solo salen en servicios de peluquería, y no se pide fianza.

## Paso 5 · Importar clientas

Desde el panel real, abre el importador y carga el `.xlsx` de María. Usa primero la vista previa; confirma duplicados y columnas; importa solo con su visto bueno. No añadas el archivo ni datos de clientas a este repositorio.

## Activar la fianza (cuando los socios lo decidan)

Una línea; pégala y Run. Deja 5 €/hora, 4 h y liberación manual como están:

```sql
update salons set profile = jsonb_set(profile, '{depositEnabled}', 'true'), updated_at = now() where slug = 'peluchic';
```

(Para volver a apagarla, lo mismo con `'false'`.) Cuando haya teléfono Bizum, se añade igual con `depositBizumPhone`.

## Pendientes

- Nota y número de reseñas de Google: no se publican porque no se han podido verificar contra su ficha. Cuando alguien lo confirme, se ponen en el perfil.
- Teléfono Bizum para la fianza (no está guardado; la fianza está apagada).
- Correo de acceso de María para el enlace mágico.
- Ortografía definitiva de «Anca».
- Hora y alcance de la comida de los viernes (no está cargada; María la crea desde `Bloquear tiempo › repetir cada semana`).
- Decisión de socios/adenda para activar la fianza.
- Días especiales de 2027 posteriores al 1 de enero.
- Confirmar con María la asignación de servicios por profesional durante la formación.
