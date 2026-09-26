# Contrato de la señal (fianza) para FRONTEND

Rama `codex/peluchic-backend`. La lógica vive en `src/lib/senal.ts`, en funciones puras con pruebas en `senal.test.ts` y `senal-ciclo.test.ts`. Las acciones del panel están en `src/lib/store.ts`.

Este documento dice qué llamar y qué esperar. **Los textos visibles de las pantallas los decide FRONTEND**; los que devuelve `senal.ts` son los que hay hoy y se pueden sustituir.

**Principios** (visita a PeluChic, 23/09, y contrato v4.1):
- siShow **nunca** recibe, guarda ni mueve dinero. La clienta hace el Bizum al salón y la dueña confirma que ha llegado.
- No hay recargos ni penalizaciones añadidas. La clienta solo pierde la señal si no viene o cancela tarde.
- Hay **una sola** señal por salón: la de su perfil. Sin configurar, no hay señal y la web no habla de depósitos.

---

## 1. Configuración (perfil del salón, `SalonProfile`)

| Campo | Tipo | Por defecto | Qué es |
|---|---|---|---|
| `depositEnabled` | boolean | `false` | Interruptor general |
| `depositMode` | `"fijo" \| "porcentaje"` | `"fijo"` | Cómo se calcula el importe |
| `depositAmountEur` | number | 10 | Importe si es fijo |
| `depositPercent` | number 1-100 | 20 | Porcentaje del servicio si es porcentaje |
| `depositAppliesTo` | `"todas" \| "nuevas" \| "duracion" \| "servicios"` | `"todas"` | A qué reservas se pide |
| `depositMinMinutes` | number | 60 | Con `duracion`: a partir de cuántos minutos |
| `depositServiceIds` | string[] | `[]` | Con `servicios`: ids de la carta que la llevan |
| `depositDeadlineHours` | 1, 2, 3 o 4 | 4 | Horas para hacer el Bizum; se aceptan también 12 y 24 por compatibilidad, que la regla trata como 4 |
| `depositBizumPhone` | string | — | Número del Bizum del salón |
| `depositAuto` | boolean | `false` | La reserva por la web ya nace «pedida» y enseña el Bizum. Si es `false`, la pide la dueña por WhatsApp |
| `depositAutoRelease` | boolean | **`true`** (lote 12, commit `34c7ed7`) | Una señal vencida libera el hueco sola. Solo `false` explícito la apaga y deja que avise y decida la dueña |
| `depositCancelHours` | number | **24** (lote 12, commit `34c7ed7`) | Hasta cuántas horas antes cancelar devuelve la señal. Ya no depende de `noShowNoticeHours`/`noShowFeeEur` |
| `depositTemplate` | string | vacía = texto de siempre | Plantilla del WhatsApp (§5) |

`reglaSenal(perfil)` devuelve la regla con todos los valores por defecto resueltos (`ReglaSenal`). Usadla siempre en lugar de leer los campos sueltos.

## 2. Estados de la señal de una cita

`estadoSenal(cita, ahora?)` devuelve `EstadoSenal`:

| Estado | Se guarda | Qué significa | Qué puede hacer la dueña |
|---|---|---|---|
| `no_aplica` | — | La cita no lleva señal | Pedirla igualmente (usa el importe de la regla) |
| `por_pedir` | sí | Lleva señal y aún no se ha pedido | Pedir |
| `pedida` | sí | Se envió el WhatsApp; corre el plazo | Reenviar, dar más tiempo, marcar recibida |
| `vencida` | **no** (se calcula) | Pedida y pasó el plazo sin recibirla | Marcar recibida (llegó tarde), dar más tiempo, volver a pedir, liberar el hueco |
| `recibida` | sí | La dueña vio el dinero | Deshacer; al cobrar pasa a `aplicada` sola |
| `aplicada` | sí | Descontada al cobrar | — (desmarcar el cobro la devuelve a `recibida`) |
| `devuelta` | sí | Hay que devolverla o ya se devolvió (ver `depositRefundedAt`) | Confirmar la devolución |
| `retenida` | sí | No vino o canceló tarde: el salón se la queda | — |
| `anulada` | sí | Se canceló sin haber recibido nada | — |

**Campos de la cita** (`Appointment`, columnas en `appointments`):

| Campo | Qué guarda |
|---|---|
| `depositStatus` | estado guardado |
| `depositEur` | importe **debido** |
| `depositRequestedAt` | cuándo se pidió |
| `depositDueAt` | vencimiento; nunca después de la cita |
| `depositPeriodHours` | plazo acordado |
| `depositReceivedAt`, `depositReceivedEur`, `depositMethod` | recepción: fecha, importe y método (`bizum`, `efectivo`, `tarjeta`, `transferencia`) |
| `depositAppliedAt`, `depositAppliedEur` | aplicación al cobrar |
| `depositRefundedEur` | importe a devolver |
| `depositRefundedAt` | cuándo confirmó la dueña que devolvió |
| `depositRetainedAt` | cuándo quedó retenida |
| `depositNote` | nota libre |

`diferenciaSenal(cita)` → `{ pendienteEur, aDevolverEur }`. Es la diferencia tras un cambio de servicio: pendiente si debe más, a devolver si debe menos.

## 3. Acciones del panel (store)

Todas devuelven `null` si se aplicaron o un `CodigoErrorSenal` si no se podía, y entonces no cambian nada. Todas suben a Supabase como parche por campos.

| Acción | Cuándo llamarla |
|---|---|
| `pedirSenal(id)` | **Solo cuando la dueña confirma que envió el WhatsApp.** Antes: `prepararPeticionSenal` (§4) |
| `recibirSenal(id, { metodo, importeEur? })` | «Ha llegado». Sin importe usa el debido o, si no hay, el de la regla |
| `deshacerSenalRecibida(id)` | Se equivocó al marcarla |
| `darMasTiempoSenal(id)` | Otro plazo igual desde ahora, sin pasar de la cita |
| `confirmarDevolucionSenal(id)` | Ya devolvió el dinero |
| `cancelAppointment(id, { porSalon? })` | `porSalon: true` al **rechazar una solicitud** o **liberar el hueco**: la señal se devuelve siempre. Sin él, cancela la clienta y cuenta la antelación |
| `markPaid(id, metodo \| null)` | Al cobrar, la señal recibida se aplica sola; al desmarcar, vuelve a recibida |
| `updateAppointment(id, patch)` | Un cambio de `status` a `no-show` retiene la señal (o la anula si no llegó); volver de cancelada o plantón la reabre. Cambiar servicio, precio o duración reajusta lo debido. Cambiar la hora recorta el plazo |
| `liberarSenalesVencidas(ahora?)` | La llama el refresco del panel; solo actúa con `depositAutoRelease` |

Compatibilidad: `markDepositRequested`, `markDepositReceived(id, bool)` y `extendDepositDeadline(id)` siguen existiendo como envoltorios de las nuevas.

**Llegar tarde** (`status: "late"`) no toca la señal: se aplica al cobrar como siempre.

## 4. Botón «Pedir señal»: el flujo obligatorio

```
const preparada = prepararPeticionSenal(cita, reglaSenal(perfil), importeDeLaCita);
if (!preparada.ok) → mostrar mensajeErrorSenal(preparada.error); NO abrir WhatsApp
else → abrir WhatsApp con mensajeDeFianza({ …, importeEur: preparada.importeEur,
       deadlineISO: preparada.venceISO, plantilla: regla.plantilla })
     → preguntar «¿Has enviado el WhatsApp?» y SOLO si dice que sí: pedirSenal(id)
```

- Abrir WhatsApp **no** es enviar. Antes se marcaba «pedida» al abrirlo aunque se cerrara sin enviar. Hoy la pregunta es un aviso con la acción «Sí, enviado»; FRONTEND puede cambiar la forma, pero no el orden.
- `preparada.venceISO` es exactamente el vencimiento que quedará al confirmar. Nunca es posterior a la cita.

## 5. Textos

- **Web pública (reserva, resumen y confirmación):** `textoSenalPublico(regla, reserva, nombreSalon, eur)` es el **único** mensaje sobre la señal. Devuelve `null` si esa reserva no la lleva. Para la etiqueta de cada servicio de la carta: `servicioLlevaSenal(regla, servicio)` → «con señal». Con `regla.liberacionAutomatica` activa (el valor por defecto), el texto termina con «Si no llega a tiempo, la cita se anula y el hueco queda libre.»; con ella apagada, no se añade nada.
- **FAQ:** `respuestaFaqSenal(regla, eur)`. Termina con el mismo aviso de liberación cuando aplica.
- **Tarjeta de cancelación:** `resumenCancelacionSenal(regla, eur)`.
- **WhatsApp:** plantilla del perfil con los marcadores `{nombre}`, `{salon}`, `{importe}`, `{bizum}`, `{cuando}` y `{plazo}`. `rellenarPlantillaSenal(plantilla, datos)`; si está vacía, sale `PLANTILLA_SENAL_POR_DEFECTO`, que es el texto de siempre. Un marcador desconocido se deja a la vista. En Ajustes, `marcadoresQueFaltan(plantilla)` avisa si falta `{importe}` o `{bizum}`.
- **Errores:** `mensajeErrorSenal(código)` da un texto por defecto para la dueña.

## 5b. Recordatorio de última hora (lote 12)

`recordatorioSenal(cita, regla, salon, ahora?)` → `{ texto, enlace, minutosRestantes } | null`. Es el aviso «te quedan X min para el Bizum», para un botón de un toque desde Hoy/Avisos.

- `cita` necesita, además de los campos de siempre, `clientPhone` (el teléfono de la clienta, sin el que no hay a quién escribir).
- Devuelve `null` si la señal no está `pedida` (ya se recibió, no se ha pedido o ya venció) o si falta más de 1 hora para el vencimiento: no es un recordatorio de última hora, es ruido.
- `texto` ya lleva el nombre del salón, los minutos, el importe y el número de Bizum; `enlace` es el `wa.me` a `clientPhone` con ese texto precargado. **FRONTEND pone el botón**; esta función no abre nada.

## 6. Códigos de error

| Código | Cuándo |
|---|---|
| `SENAL_SIN_IMPORTE` | La cita no lleva señal con la regla actual y no hay importe |
| `SENAL_ESTADO_INVALIDO` | Esa acción no se puede hacer desde el estado actual (p. ej. pedir una ya recibida) |
| `SENAL_IMPORTE_INVALIDO` | Importe recibido o devuelto ≤ 0 o no numérico |
| `SENAL_CITA_CERRADA` | La cita ya pasó, está cancelada o fue un plantón |

## 7. Servidor

- La reserva pública **no** puede escribir nada de la señal. En un salón real, `syncAppointment` calcula la señal con la regla guardada del salón: `por_pedir`, o `pedida` con su plazo si es automática. Lo vigila una prueba de guardia.
- Esquema: 9 columnas nuevas en `appointments`, con CHECK de valores. Están en `supabase/pendiente.sql` y aún **no aplicadas**. Sin ellas, la cita se guarda sin la señal (nivel de esquema `NIVEL_SENAL`).
- No hay tabla `payments` todavía. El descuento al cobrar se deduce de `depositAppliedEur`, y la caja del día resta la señal: `cierreDelDia().senalesDescontadas`, con `total` y `porMetodo` ya netos.

## 8. Limitaciones conocidas

- Con el panel abierto, la liberación automática corre en cada refresco (cada minuto) — eso no ha cambiado. Con el panel cerrado, ya existe el cron de Vercel `/api/senales-vencidas` (lote 12, ver §9), pero **sin cron cada 15 minutos** (Vercel Hobby no lo permite, ver §9): entre una ejecución diaria y la siguiente, una cita vencida sigue ocupando el hueco hasta que alguien abre el panel o pasa el cron del día siguiente.
- Con `depositAppliesTo = "nuevas"`, la web pública no sabe si la clienta es nueva y avisa «si es tu primera visita». La dueña decide al pedirla.
- Bizum entre particulares no tiene API: nadie puede saber solo si ha llegado. «Recibida» siempre la marca la dueña.

## 9. Cron de liberación (lote 12)

`/api/senales-vencidas` (`src/routes/api.senales-vencidas.ts`, lógica en
`src/lib/api/senales-vencidas.server.ts`) recorre **todos** los salones
reales con señales `pedida` y aplica la misma lógica pura que el panel
(`revisarVencimiento` + `resolverCancelacion` de `senal.ts`): si
`liberacionAutomatica` está activa y la señal venció, cancela la cita y anula
la señal. Nada de correo ni de WhatsApp. Idempotente: una cita que ya no está
abierta, o cuya señal ya no está `pedida`, no se vuelve a tocar.

Protegido igual que `/api/recordatorios`: `Authorization: Bearer
<CRON_SECRET>` (o `?token=` para lanzarlo a mano); sin `CRON_SECRET` en el
entorno, no hace nada.

**Cadencia real: diaria, no cada 15 minutos.** Vercel **Hobby** no permite
cron jobs más frecuentes que una vez al día (el cron ya existente de
`/api/recordatorios` corre una vez al día, lo que sugiere que el proyecto
está en ese plan); `vercel.json` pide `0 7 * * *` (7:00, distinta hora que
los recordatorios de las 17:00) porque es lo máximo que el plan admite hoy.
Si el proyecto pasa a un plan de pago, esta cadencia se puede acortar sin
tocar el código, solo `vercel.json`.
