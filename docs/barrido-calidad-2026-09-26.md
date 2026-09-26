# Barrido de calidad del backend — 26/09/2026

Rama `codex/peluchic-backend`, partiendo de `1b3d6fd` (lo que está en producción).
Sin push. No se ha escrito nada en Supabase ni en Vercel. No se ha tocado
`src/components/**` ni `src/routes/app.*`.

Tras cada commit: `tsc --noEmit` limpio, `TZ=UTC bun test` en verde y `bun run build` en verde.
Al final: **1.324 pruebas pasan, 1 omitida, 0 fallan** (antes del barrido: 1.300).

## Commits

| Commit | Qué |
|---|---|
| `ad7aff6` | Señal: fechas e importes corrompidos ya no revientan el ciclo (fuzz de 500 citas adversarias) |
| `99713b4` | Robustez: resolutores del asistente, caja y pagos con salón vacío e ids huérfanos |
| `bb46d0d` | Sincronización: reintentos automáticos con espera creciente y cola por cita |
| `f4d2fc0` | Lecturas por páginas: la agenda, los pagos y el CSV ya no se cortan en 1000 filas |
| `b7de720` | Rendimiento: campañas y resumen de periodo sin O(n²), memo por versión de la lista |
| `cbdaad4` | API: 405 para métodos no declarados, foto de un sitio inexistente es 404 y sin 500 por red |
| `ba8d8d2` | Deshacer: el mensaje de corrección no dice «Invalid Date» ni «Hola , perdona» |

## 1. Robustez de datos

Los dos primeros commits recogen el trabajo que el reinicio de la máquina dejó sin commit.
Se revisó, se volvió a ejecutar y se conservó entero:

- **Señal** (`senal.ts`): una cita con `start`, `depositRequestedAt` o `depositDueAt` ilegibles
  hacía que `vencimientoSenal`, `pedirSenal`, `darMasTiempo` y `senalDeReservaNueva` lanzaran
  `RangeError: Invalid Date`. Un importe `NaN` se colaba en el parche que luego se guarda.
  El fuzz de 500 citas adversarias (13 transiciones encadenadas cada una) **falla sin el
  arreglo y pasa con él**: se comprobó quitando el arreglo.
- **Asistente**: todos los resolutores, sobre un salón recién dado de alta (0 citas y 0 clientas) y
  sobre la demo PeluChic con una profesional, un servicio y una clienta borrados más un servicio
  `libre:<nombre>`. Ninguno lanza una excepción ni devuelve «NaN», «undefined» o «Invalid Date».
  Este commit no necesitó ningún arreglo.
- **Caja y pagos**: salón vacío, profesional borrada, señal mayor que el precio y cita borrada con
  pagos. Tampoco necesitó arreglo.
- **Deshacer** (`ba8d8d2`): el mensaje de WhatsApp que corrige un aviso ya enviado decía «del
  Invalid Date» si la cita tenía la fecha rota, y «Hola , perdona» si el nombre era `""`.
- **Lecturas de más de 1000 filas** (`f4d2fc0`): PostgREST devuelve como mucho 1000 filas por
  petición y **no avisa**. Hasta ahora `listSalonData` no paginaba, y el refresco del panel
  *sustituye* la agenda por lo que llega. Un salón con más de 1000 citas perdía el resto de la
  pantalla cada minuto. Pasaba lo mismo con `listarPagos` y con el CSV de la gestoría.
  Ahora las tres lecturas van por páginas con un orden estable (`api/paginar.ts`, con pruebas
  de 3.300 filas, exactamente 1000, 0 y un error a mitad). Además, los nombres de clienta del CSV se
  piden a tandas de 100 ids, para no pasar del largo máximo de URL.
  *No se ha podido comprobar cuántas citas tiene hoy el salón real más grande*: la lectura de
  la base de producción no estaba autorizada en esta sesión.

## 2. Rendimiento

Medidor: `TZ=UTC bun src/lib/rendimiento.bench.ts`, sobre la demo PeluChic (3.344 citas,
595 clientas y 3 profesionales). Da la mediana de 5 a 15 vueltas. «En frío» significa una lista nueva en
cada vuelta, que es lo que pasa tras un refresco.

| Cálculo | Antes | Después |
|---|---:|---:|
| `buildCampanas` | 60–82 ms | 12 ms |
| `resumenDePeriodo` hoy / semana / mes (en frío) | 8–13 ms cada uno | 2,5–2,9 ms |
| `resumenDePeriodo` (misma lista, memo) | 11–13 ms | 0,02–0,4 ms |
| JSON de la respuesta del servidor (ida y vuelta) | 4,5–5 ms | igual |
| `recortarDatosPanel` (dueña / profesional) | 0 / 0,2 ms | igual |
| `liberarSenalesVencidas` (revisión de 3.344 citas) | 0,1 ms | igual |
| `solapaConAgenda` (un hueco) | 0,28 ms | igual (O(n) y no está en ningún bucle) |

Qué se cambió:
- **Campañas**: tres campañas recorrían todas las citas por cada clienta, 595 × 3.344 en cada una.
  Ahora hay un índice por clienta, calculado una vez por lista. Los huecos flojos se cuentan en una
  sola pasada en lugar de 14.
- **Fechas**: `toLocaleDateString` construye un `Intl.DateTimeFormat` en cada llamada, unos 30 µs,
  y era **la mayor parte** del coste de campañas: 20 ms en 595 fechas. `copy.ts` y `campanas.ts`
  usan ahora formateadores creados una sola vez. Se comprobó que la salida es idéntica en 2.000 fechas.
- **Periodos**: los 10 rangos de un resumen (el actual, el previo y los 8 cubos de la minigráfica) usan un
  índice ordenado por fecha con búsqueda binaria. La prueba de equivalencia contra la cuenta
  ingenua usa una lista desordenada y una cita con la fecha rota.
- **Memo por versión**: el índice se guarda en un `WeakMap` cuya clave es el propio array. La store
  sustituye el array en cada cambio, así que su identidad hace de versión de los datos.

**Refresco periódico** (la parte de datos, en frío): unos 25 ms entre JSON, recorte, señales,
campañas y tres resúmenes, frente a unos 100 ms antes. Cumple el objetivo de < 50 ms.
**Arranque del panel < 300 ms: no medido.** Depende del render de React (componentes de FRONTEND),
que este medidor no cubre. Solo está medida la parte de datos.

## 3. Sincronización (`salon-sync.ts`)

- **Reintentos automáticos**: 1 s, 3 s y 9 s antes de enseñar el aviso con el botón. Un corte de
  un segundo ya no llega al dueño.
- **No se reintentan** los rechazos del servidor (solape, bloqueo), porque repetir no los arregla.
  Tampoco se reintenta la ficha **sin teléfono**, que es un `insert` y crearía fichas dobles.
- **No se duplica nada**: todo lo que se reintenta es idempotente en el servidor. Las citas y la
  lista de espera hacen upsert por id local, y los pagos y el historial usan `ignoreDuplicates`
  por id. La prueba comprueba que un pago reintentado viaja siempre con el mismo id.
- **Orden**: los cambios de una misma cita suben en cola. Antes, un primer parche que fallaba y se
  reintentaba podía llegar *detrás* del segundo y pisarlo con el valor viejo.
- **Deshacer**: no se ve afectado. El deshacer es local y sube como un parche más, por la misma cola.

Pruebas nuevas en `salon-sync.test.ts`: fallo pasajero sin aviso, red caída (tres esperas y un
único aviso), solape sin reintento, pago con el mismo id, ficha sin teléfono sin reintento y orden
de dos parches.

## 4. Producción

**Logs de Vercel**: la API solo ofrece `runtime-logs` en directo, sin histórico. Se dejó
escuchando el despliegue de producción (`1b3d6fd`) durante el fuzz y **no devolvió ninguna
línea**. Los errores 500 de días anteriores no se han podido revisar por esta vía.

**Fuzz de `api/*` en producción** (solo GET, slugs inexistentes y tokens falsos):

| Entrada | Antes | Después (en la rama) |
|---|---|---|
| `api/calendario` sin token, token vacío, nulos o `../` | 404 «Calendario no disponible» | igual |
| `api/foto` sin `place` o con caracteres raros | 400 con mensaje | igual |
| `api/foto` con un ID que Google no conoce | **502** | 404 «Ese sitio no existe en Google» |
| `api/foto` con la red hacia Google caída | **500 sin cuerpo** (no se ha disparado en prod: leído en el código) | 502 con mensaje |
| `api/recordatorios`, `api/senales-vencidas` y `cron` sin token o con uno malo | 401 JSON | igual |
| Callback de Google sin código o con `error=` | 302 al panel con motivo | igual |
| **PUT, DELETE o PATCH** en cualquier `api/*` | **200 con el HTML de la portada** | 405 JSON con `Allow`; HEAD responde como el GET |

La columna «después» se comprobó en el servidor de desarrollo con peticiones reales.
`api/calendario`, además, ya no revienta el `.ics` si una cita no tiene servicio.

**Server functions** (`/_serverFn/<id>`, las 14 de tipo GET, con slug inexistente, vacío, `../`,
sin datos y con tipos cruzados): todas responden sin traza. El detalle está en los puntos flojos.

## 5. Puntos flojos que no se han arreglado

1. **Server functions con un `payload` que no es JSON → 500.** El mensaje es solo el del parser,
   sin traza. Las entradas que no pasan la validación vuelven con **200** y el error de zod
   serializado dentro, que es el protocolo de TanStack: el cliente lo lanza igual. *Propuesta*: un
   middleware global en la entrada del servidor que convierta el error de parseo en 400 y resuma
   los errores de zod en español.
2. **El botón «Reintentar» del aviso se salta la cola** (`src/lib/salon-sync.ts:75`). Si el dueño
   pulsa reintentar un parche viejo *después* de otro cambio ya guardado de la misma cita, el viejo
   pisa al nuevo. *Propuesta*: que el aviso reintente a través de `subir` con la misma clave, o
   descartarlo si hay un cambio posterior de esa cita.
3. **El refresco sustituye los arrays aunque no haya cambios** (`src/lib/store.ts:1095`). Cada 60 s se
   invalidan todos los memos (el cálculo en frío cuesta unos 25 ms) y React vuelve a pintar todo.
   *Propuesta*: conservar el array anterior si `updated_at`, o un hash barato, no cambian.
4. **Huecos flojos y capacidad usan la zona del navegador**, no la del salón
   (`src/lib/campanas.ts:211` y `src/lib/periodos.ts:304`). Una dueña de viaje, o un servidor en UTC,
   ven otra franja. *Propuesta*: `diaEnZona` y la hora en la zona del perfil, como ya hace la caja.
5. **`liberarSenalesVencidas` cancela de una en una** (`src/lib/store.ts:733`): un `set` y una subida por
   cita. Con muchas vencidas a la vez hay N renders. *Propuesta*: una sola transición en la store.
6. **`listarCambios` usa `limit` sin paginar** (`src/lib/api/cambios.functions.ts:106`). Está bien
   mientras el límite sea menor de 1000. Conviene fijar ese tope en el validador.
7. **Sin comprobar en producción**: el número real de citas del salón más grande (lectura de base
   no autorizada en esta sesión) y los logs 500 históricos de Vercel (la API solo da el directo).
8. **FRONTEND** (no tocado): `NewAppointmentDialog.tsx` llama a `solapaConAgenda` una vez por
   guardado, lo cual está bien. Si algún día se pinta una rejilla de huecos con ella, son unos 0,3 ms
   por hueco, unos 50 ms para 200 huecos, y convendría un índice por profesional.
