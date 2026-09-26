# Lote 15 · BACKEND · 26/09/2026

Base: `main` 715e4a4 (fast-forward). Un commit por punto, cada uno con tsc, `TZ=UTC bun test` y `bun run build` en verde.

## 1. «La cita ya ha pasado o está cancelada: no se puede pedir señal» (commit 67c147b)

**Reproducción.** Con la demo PeluChic (`buildSeed("peluqueria", …)`) y `prepararPeticionSenal`:
todas las citas futuras `pending`/`confirmed` (175) se pueden pedir; fallan solo las ya empezadas
(en curso) y cualquier cita pasada, atendida, cancelada o pendiente antigua.

**Causa raíz.** No era la zona horaria (`start` se compara como instante absoluto, sin zona; la
hora sale del dispositivo, igual que en todo el panel) ni `pending` frente a `confirmed` (ambas
valen). Era un desacuerdo pantalla/dominio:

- `SenalCita` enseña «Pedir señal igualmente / por WhatsApp» mirando SOLO el estado de la
  señal (`no_aplica` / `por_pedir`), nunca el estado ni la hora de la cita. En la ficha de una
  cita de Citas —donde la mayoría de la demo son citas pasadas o atendidas— y en el aviso de
  solicitudes pendientes (una `pending` cuya hora ya pasó) el botón sale y el dominio lo rechaza.
- Una cita de hoy ya empezada pero no terminada daba el mismo texto «ya ha pasado», que es
  falso y hace creer que la cita es válida.
- `markDepositRequested` se tragaba el error: si la cita empezaba entre abrir WhatsApp y pulsar
  «Sí, enviado», no quedaba pedida y no se avisaba.

**Arreglo en dominio (`src/lib/senal.ts`).** Una única regla:
`motivoCitaCerrada(cita, ahora)` → `cancelada | no_vino | atendida | en_curso | pasada | sin_fecha | null`,
`puedePedirSenal(cita, ahora)` y `mensajeCitaCerrada(motivo)`. `pedirSenal` y `darMasTiempo` la
usan; `prepararPeticionSenal` devuelve además `motivo` y `mensaje` exacto; el texto genérico ya
no dice «ya ha pasado» a una cita en curso; `markDepositRequested` devuelve el código de error.
Tests en `src/lib/senal-cita-cerrada.test.ts`: cita en 10 min (plazo topado a la hora de la
cita), mañana `pending`, en curso, terminada hoy, cancelada, atendida, no vino, duración 0,
fecha ilegible, `start` con desfase `+02:00`, y barrido de la demo PeluChic.

**Para FRONTEND (`SenalCita.tsx`, y el `handlePedirFianza` de `AppointmentDetailSheet.tsx`, que
ya no se usa):** pintar el botón de pedir solo si `puedePedirSenal(cita, new Date())`; si no, en su
lugar una línea con `mensajeCitaCerrada(motivoCitaCerrada(cita)!)`. Al fallar, usar
`preparada.mensaje` en el toast. Mostrar el error que ahora devuelve `markDepositRequested`.

## 2. Horas visibles del calendario (commit d134a83)

Revisado: tipo en `SalonProfile.calendario`, `preferenciasDe`, guardado desde
`CamposPreferenciasCalendario`, lectura en `CalendarioArena`/`RejillaCalendario`.

- La rejilla pinta el día entero (`desde = 0`) y usa `desde/hasta` solo para el scroll inicial;
  `horasDeRejilla` solo ensancha; `citasFueraDeHoras` solo cuenta; `huecosDe` usa el horario de
  la profesional. **Ningún helper recorta datos por las horas visibles.**
- Fallo encontrado: `null` en `desde` se leía como las 00:00 (`Number(null) === 0`). Ahora
  `null`, vacío o no numérico valen el valor por defecto (vista semana, lunes, 8-21).
- Límites: horas enteras, `desde` 0-22, `hasta` 2-24, `hasta > desde` con dos horas mínimo.
- Nuevo `parcheCalendario(actual, cambio)` y `updateSalonProfile` fusiona y sanea `calendario`
  antes de guardarlo y subirlo: el servidor fusiona el perfil a un nivel, así que un parche
  parcial (`{ desde }`) borraba la vista y el primer día.
- Nota de permisos: cambiar `calendario` exige `salon.editar` (cae en el caso general de
  `accionesDeParchePerfil`). Una recepcionista no puede guardar su vista preferida; si se quiere,
  es una decisión de producto.

## 3. Coste de la capa de datos al entrar en cada ruta (commit 11b80c0)

Banco: `bun run src/lib/rendimiento-rutas.bench.ts` (demo PeluChic, 3.344 citas, 595 clientas,
`TZ=Europe/Madrid`). Mediana de llamadas repetidas con los mismos datos, en ms:

| Función | Antes | Después | Memoizado (mismos datos) |
|---|---:|---:|---:|
| analítica · trendsForPeriod(mes) | 24,7 | 4,4 | 0,00 |
| analítica · revenueByDay | 19,7 | 1,1 | 0,00 |
| analítica · ocupacionPorProfesional | 8,6 | 0,4 | 0,01 |
| campañas · buildCampanas | 7,8 | 5,2 | 0,01 |
| analítica · aiInsights | 4,1 | 2,1 | 0,00 |
| analítica · barrasDelPeriodo(mes) | 3,2 | 3,0 | — |
| analítica · nuevasYRecurrentes | 1,5 | 0,3 | — |
| hoy · todayKpis | 0,7 | 0,07 | — |
| hoy · citasDelDia / caja · cierreDelDia | ≈1 / 0,7 | igual | — |
| clientas · fichaDeClienta | 0,07 | 0,04 | — |
| asistente · crear + precalentar | 24,3 (94 la 1.ª vez) | 15,6 (94 la 1.ª vez) | — |

Qué se cambió: `instante-cita.ts` (instante y día de cada cita en caché por objeto, sin volver a
parsear `start`), `revenueByDay` y `ocupacionPorProfesional` en una sola pasada, prefiltro de la
ventana en las tendencias, y `memo-datos.ts` + `selectores-rutas.ts` (memo por identidad de los
arrays de la store, `Date` por minuto, arrays cortos —equipo, carta— por contenido porque
`mock/salon.ts` los muta en sitio). Tests de equivalencia en `src/lib/rendimiento-rutas.test.ts`.

Trabajo al importar: `mock/seed.ts` construye la semilla por defecto al importarse (≈9 ms); el
import completo de la store cuesta ≈70 ms, casi todo dependencias. No se ha cambiado: exportar
la semilla perezosa cambia el contrato de `clients`/`seedAppointments`.

Conclusión: la capa de datos suma unos 30-50 ms por entrada a Analítica y menos de 10 ms en el
resto; no explica sola un retraso «absurdo». Lo probable está en la pantalla (recalcular en cada
render, selectores que devuelven arrays nuevos, precalentar el asistente de forma síncrona al
montar).

**Para FRONTEND, qué usar:**

- En Analítica: `trendsForPeriodMemo`, `revenueByDayMemo`, `aiInsightsMemo`,
  `barrasDelPeriodoMemo`, `ocupacionPorProfesionalMemo`, `serviciosDelRangoMemo`,
  `nuevasYRecurrentesMemo`, `serviceMixMemo`, `weeklyOccupancyMemo`.
- En Hoy / Caja: `citasDelDiaMemo`, `todayKpisMemo`, `cierreDelDiaMemo`.
- En Campañas: `buildCampanasMemo`; en la ficha: `fichaDeClientaMemo`.
- Pasar `useSalonStore((s) => s.appointments)` tal cual: nunca un `filter`, `map` o spread
  dentro del selector de zustand (devuelve un array nuevo en cada render: re-render y fallo de
  caché).
- `AssistantPanel`: lanzar `asistente.precalentar()` en `requestIdleCallback` (o
  `setTimeout(…, 0)`), no síncrono en el `useEffect` del montaje: cuesta 16-94 ms y bloquea el
  primer pintado.

## 4. Peticiones de FRONTEND

No apareció `peticiones-backend.md` en la carpeta de capturas l16 durante el trabajo.
