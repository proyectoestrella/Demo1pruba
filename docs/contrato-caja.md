# Contrato de caja (pagos reales) para FRONTEND

Rama `codex/peluchic-backend`, lote 11. La lógica pura vive en `src/lib/pagos.ts`
(con pruebas en `pagos.test.ts` y `cierre-caja.test.ts`); el importador de TPV 123
en `src/lib/importar-pagos-tpv.ts`; el servidor en `src/lib/api/pagos.functions.ts`.

**Principio (mismo que la señal, contrato v4.1):** siShow **nunca** recibe, guarda
ni mueve dinero. Esto es el cuaderno del mostrador en digital: lo que la dueña o
su encargada han anotado que ha entrado. **Nunca es un ticket ni una factura**
(fuera de Verifactu a propósito) — ver §6, textos obligatorios.

## 0. Página nueva y permisos

Se añade la página `"caja"` a `PaginaId` (`docs/contrato-accesos.md`, ruta
sugerida `/app/caja`) y cuatro acciones nuevas a `AccionId`:

| Acción | Alcance | Quién |
|---|---|---|
| `dinero.crear` | todo | gerente, subencargado |
| `dinero.cerrar` | todo | gerente, subencargado |
| `dinero.exportar` | todo | gerente, subencargado |
| `dinero.importar` | todo | gerente, subencargado |

**Decisión explícita (instrucción del lote):** recepción y estilista **no**
tienen ninguna de las cuatro, ni ven la página `caja`. La estilista sigue
viendo lo suyo donde ya lo veía (`dinero.ver-propio`, que ya existía y no
cambia): sus propias citas cobradas, no un cajón de caja con crear/cerrar.
Si en algún momento hace falta un cajón de "lo mío" para la estilista, es una
pantalla distinta (o un filtro de solo lectura sobre `listarPagos`), no acceso
a `caja`.

## 1. Tipos (`src/lib/pagos.ts`, reexportados desde `mock/types.ts`)

```ts
type MetodoPago = "efectivo" | "tarjeta" | "bizum";
type ConceptoPago = "servicio" | "producto" | "propina" | "senal" | "ajuste";
type OrigenPago = "sishow" | "tpv123";

interface Pago {
  id: string;              // uuid; lo genera quien lo crea (navegador o importador)
  appointmentId?: string;  // local_id de la cita, si viene de una
  clientId?: string;
  clientName?: string;     // para pintar sin cruzar con clients (útil tras importar)
  importeEur: number;
  metodo: MetodoPago;
  concepto: ConceptoPago;
  cobradoPor?: string;     // employeeId de quien lo cobró
  nota?: string;
  origen: OrigenPago;
  refExterna?: string;     // evita duplicar (señal aplicada, reimportar TPV 123)
  fecha: string;           // ISO, cuándo se cobró (no cuándo se tecleó)
  createdAt: string;       // ISO
}
```

No hay `updatedAt` ni edición de un pago: se borra y se vuelve a crear
(`borrarPago` + `registrarPago`). Un pago no se "corrige", se anota un
`concepto: "ajuste"` o se borra.

## 2. Funciones puras (`src/lib/pagos.ts`)

| Función | Qué hace |
|---|---|
| `totalPagos(pagos)` | Suma, redondeada a céntimo |
| `pagosPorMetodo(pagos)` | `{ efectivo, tarjeta, bizum }`, las tres siempre presentes |
| `agruparPagosPorCita(pagos)` | `Map<appointmentId, importeEur>`, para el fallback de citas/Analítica (§5) |
| `cobradoDeCita(appointmentId, pagosPorCita, fallbackEur)` | Lo real si hay pagos de esa cita; si no, `fallbackEur` (comportamiento actual) |
| `refSenalAplicada(appointmentId)` | `senal:<id>`, la `refExterna` estable del pago que crea la señal al aplicarse |
| `pagoDeSenalAplicada(cita, ahora?)` | El pago (sin `id`/`createdAt`) que corresponde a `depositAppliedEur`; `null` si no hay nada que apuntar. Lo llama el SERVIDOR al cobrar (síncrono con `aplicarSenal` de `senal.ts`), nunca el navegador |
| `esperadoDelDia(pagos, dia?)` | `{ fecha, porMetodo, total }` de los pagos de ese día — el "esperado" del cierre |
| `calcularDescuadre(contado, esperado)` | `{ contado, esperado, descuadre }`; `descuadre = contado - esperado` |

## 3. Señal aplicada → pago automático (idempotente)

Cuando el servidor aplica la señal al cobrar (`aplicarSenal` en `senal.ts`,
ya existente), crea además un pago con `concepto: "senal"`,
`refExterna: refSenalAplicada(appointmentId)`. La unicidad `(salon, origen,
ref_externa)` en `payments` hace que aplicar/desaplicar/reaplicar la señal
**nunca duplique**: al desaplicar se borra ese pago (mismo ref, mismo
resultado si se reaplica). Esto es enteramente interno: no hay acción de
panel nueva por esto, es un efecto de `markPaid`/`cita.cobrar` que ya existía.

## 4. Servidor (`src/lib/api/pagos.functions.ts`)

Todas exigen sesión de miembro (no hay Caja en una demo: se apunta y se
pierde al recargar, sin servidor detrás — ver §7).

| Función | Guarda | Qué hace |
|---|---|---|
| `listarPagos({ slug, desde, hasta })` | `dinero.ver-global` o `dinero.ver-propio` | Con `ver-global`, todos; con solo `ver-propio`, los de `cobradoPor === miEmployeeId` |
| `registrarPago({ slug, pago })` | `dinero.crear` | Alta manual (upsert por `id`, idempotente) |
| `borrarPago({ slug, id })` | `dinero.crear` | Borra un pago manual mal apuntado |
| `cerrarCaja({ slug, fecha, efectivoContado, nota? })` | `dinero.cerrar` | Calcula `esperado` desde `payments` de ese día, guarda en `cash_closings` (único por salón+fecha); re-cerrar actualiza y conserva el cierre anterior en la propia fila (`anterior` jsonb) como auditoría |
| `listarCierresCaja({ slug, desde, hasta })` | `dinero.cerrar` | Historial de cierres del rango |
| `generarCsvGestoria({ slug, desde, hasta })` | `dinero.exportar` | Devuelve el CSV ya formado (§6); no se genera en el navegador porque cruza todo el rango en servidor |
| `importarPagosTpvServidor({ slug, pagos })` | `dinero.importar` | Sube en bloque lo que ya vino de `importarPagosTpv` (§8): upsert por `(salon, origen='tpv123', refExterna)`, ignora duplicados |

## 5. Store (`src/lib/store.ts` + `src/lib/salon-sync.ts`)

`payments: Pago[]` es un array más de la store (como `appointments`), **se
persiste** (para que una demo conserve lo apuntado igual que conserva sus
citas) pero **no se rellena en la carga inicial** de un salón real —a
diferencia de `appointments`/`clients`/`waitlist`—: se pide aparte, igual que
el historial (`listarCambios`). Motivo: no todas las pantallas necesitan la
caja, y puede crecer mucho.

| Acción | Qué hace |
|---|---|
| `cargarPagos(desde, hasta)` | En un salón real, sustituye `payments` por lo que devuelva `listarPagos` para ese rango. En una demo, no hace nada (usa lo que ya haya local) |
| `registrarPago(datos)` | Añade al array local y sube (`pushPago`). `datos` es `Pago` sin `id`/`createdAt`/`origen` (siempre `"sishow"`) |
| `borrarPago(id)` | Quita del array local y sube el borrado. **Es la única acción reversible de caja** (ver §5b): un alta no se deshace por historial, se borra; un borrado sí se deshace (recupera el pago) |
| `cerrarCaja(fecha, efectivoContado, nota?)` | Llama al servidor, no toca `payments` local. Devuelve el cierre (o `null` en demo: no hay servidor que calcule el esperado) |

### 5b. Deshacer

Se añade `"pago"` a `EntidadCambio` y `"pago.borrar"` a `TipoCambio`
(`src/lib/cambios.ts`), con el mismo patrón que `servicio.borrar`: `borrarPago`
va en `ACCIONES_REGISTRADAS`, y deshacerlo reinserta el pago borrado (mismo
`id`) y lo vuelve a subir. `registrarPago` (un alta) **no** se registra en el
historial —igual que `addAppointment`/`addService` tampoco lo hacen—: la
manera de "deshacer" un alta es borrarla con `borrarPago`, que sí queda en el
historial y sí se puede deshacer. El permiso de `pago.borrar` es
`dinero.crear` (crear y borrar un apunte manual son el mismo nivel de
confianza).

## 6. CSV para gestoría y "cobrado real" (`src/lib/export-csv.ts`, `src/lib/periodos.ts`)

- `pagosToCsvGestoria(pagos, clientNameById?, cobradoPorLabel?)`: nueva
  función pura en `export-csv.ts`. El filtro por rango de fechas lo hace quien
  la llama (el servidor, en `generarCsvGestoria`, o el propio navegador si
  algún día hiciera falta client-side); esta función solo formatea. Separador
  `;`, **coma decimal española** (`20,00` no `20.00`) y BOM UTF-8, como el
  resto de exportaciones — pero con coma decimal a propósito porque este CSV
  lo abre una gestoría, no el propio panel. Columnas: Fecha, Hora, Concepto,
  Método, Importe (€), Cliente, Cobrado por, Nota, Origen.
- `citasToCsv(...)` y `resumenMensualToCsv(...)` ganan un **quinto/tercer
  parámetro opcional** `pagosPorCita?: Map<string, number>`
  (`agruparPagosPorCita(pagos)`). Si se pasa, la columna de precio/facturación
  usa `cobradoDeCita(a.id, pagosPorCita, a.priceEur)`; si no se pasa (como
  hasta ahora), sigue exactamente igual que hoy. **FRONTEND decide si pasa
  este mapa** — para un salón sin pagos apuntados (todavía no usa Caja), no
  pasarlo es lo correcto y no cambia nada.
- `metricasDePeriodo(appts, rango, equipo, primeras?, pagosPorCita?)` en
  `periodos.ts`: mismo quinto parámetro opcional, mismo fallback. `caja`
  usa `cobradoDeCita(a.id, pagosPorCita, a.priceEur)` en vez de `a.priceEur`
  a secas cuando se pasa el mapa. `resumenDePeriodo(...)` (la puerta de
  entrada de Analítica) también acepta y reenvía este mismo parámetro
  opcional al final de su firma.

**Import obligatorio de textos, en cualquier pantalla que hable de dinero:**
"siShow no emite tickets ni facturas (fuera de Verifactu): esto es un
registro interno para cuadrar la caja." — no hace falta literal, pero la idea
tiene que estar en algún sitio de Ajustes › Caja o en la propia pantalla, al
menos una vez.

## 7. Qué NO hace (a propósito)

- No hay pasarela de pago, ni Bizum real, ni TPV: todo lo que hay aquí es lo
  que una persona ha tecleado o importado.
- Una demo de venta no persiste en servidor: `cargarPagos` es un no-op y
  `registrarPago`/`borrarPago` solo tocan `localStorage` del navegador (igual
  que el resto de la demo).
- No hay edición de un pago ya creado: se borra y se vuelve a crear.
- El "esperado" de `cerrarCaja` sale de `payments`, no de `appointments`. El
  viejo `cierreDelDia` de `src/lib/caja.ts` (basado en `paidAt`/
  `paymentMethod` de la cita) **sigue existiendo tal cual** para quien no
  use Caja: no se ha tocado ni se ha migrado nada a la fuerza.

## 8. Importador de TPV 123 (`src/lib/importar-pagos-tpv.ts`)

`importarPagosTpv(tabla, clientas, opciones?)` reutiliza el mismo parser que
`importar-clientas.ts` (`leerCsv`/`leerXlsx`/`leerTabla`, agrupación por
clienta+fecha, `encontrarNombre` difuso) sobre el "Histórico X Clientes"
(columnas Factura, Fecha, Venta/Concepto, Empleado, Precio — más Código
Cliente/Cliente si están). A diferencia de `importarVisitas` (que agrupa
varias líneas de una visita en una sola cita), aquí **cada línea es un
pago**: la `refExterna` es el número de Factura, y si la misma factura tiene
varias líneas, `Factura#2`, `Factura#3`… (así no se pierde ninguna línea ni
se duplica nada al reimportar el mismo export: el mismo fichero produce
siempre las mismas `refExterna`).

```ts
interface ResultadoImportarPagosTpv {
  pagos: PagoImportadoTpv[]; // { fila, refExterna, fecha, importeEur, clienteId?, clienteNombre, cobradoPor?, concepto: "servicio", nota? }
  casadas: number;   // encontraron clienta (por tpv_code o nombre normalizado)
  noCasadas: number; // no se pudo casar; el pago se sube igual, con clienteNombre y sin clientId
  errores: number;
  lineas: number;
}
```

FRONTEND: mismo flujo que "Importar clientas" (`ImportarClientasDialog.tsx`)
— parsear con `leerTabla`, mostrar la vista previa con el informe
casadas/no casadas/errores, y al confirmar, llamar a
`importarPagosTpvServidor({ slug, pagos })`. Reimportar el mismo Excel no
duplica (unicidad por `refExterna`); reimportar un Excel **distinto** con
las mismas facturas tampoco debería pasar en la práctica (TPV 123 no repite
números de factura entre exportaciones).

## 9. SQL nuevo (sin aplicar; ver `supabase/pendiente.sql` secciones 14-16)

- **14.** Tabla `payments`, con el índice único parcial `(salon_slug, origen,
  ref_externa) where ref_externa is not null`.
- **15.** Tabla `cash_closings`, única por `(salon_slug, fecha)`, con columna
  `anterior jsonb` para la auditoría de un re-cierre.
- **16.** `cambios.entidad` admite también `'pago'` (antes: cita, clienta,
  servicio, perfil).

Otra sesión está aplicando en firme las secciones 1-13 en producción mientras
se escribía esto: las tres secciones nuevas se han validado con rollback
antes y después de esa aplicación (ver el informe de cierre del lote).
