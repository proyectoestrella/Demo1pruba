# Informe técnico del backend: ciclo del 25 y 26 de septiembre de 2026

Rama `codex/peluchic-backend`, desde la señal (lote 5) hasta el deshacer (lote 9b). La etiqueta de cierre es `backend-lote-9b` (c9877ef). Es la base del PDF técnico. Cada lote tiene su etiqueta `backend-lote-*` y su contrato en `docs/`.

**Estado global de la rama al cerrar el ciclo:**
- **tsc:** sin errores.
- **Tests:** `bun test` pasa 868 de 868, en `TZ=UTC` y en la zona local.
- **Build:** `vite build` correcto.
- **Remoto:** sin push de BACKEND. El orquestador tiene la rama respaldada en GitHub.
- **Base de datos:** nada aplicado en Supabase. Todo `supabase/pendiente.sql`, secciones 1 a 13, está **validado contra producción dentro de `begin … rollback`**. El volcado de esquema es idéntico antes y después, con la huella `60f6c04ca5691827`, y no queda nada aplicado.

## 1. Resumen por lote

| Lote | Etiqueta | Qué | Contrato |
|---|---|---|---|
| 5 | `backend-lote-5` | Ciclo de vida de la **señal** (Método A, Bizum): por pedir, pedida, vencida, recibida, aplicada, devuelta, retenida y anulada | `contrato-senal.md` |
| 5b | `backend-lote-5b` | **Servicios libres** (`libre:<nombre>`) con su nombre en la ficha, el CSV y las estadísticas | — |
| 6 | `backend-lote-6` | **Preguntas de reserva** personalizables por salón y por servicio | `contrato-preguntas.md` |
| 7 · 7b · 7c | `backend-lote-7`, `-7b`, `-7c` | **Motor del asistente** sin IA: 120 intenciones, entidades, resolutores y responder | `contrato-asistente.md` |
| 7d | `backend-lote-7d` | Informe final del asistente | `asistente-informe-final.md` |
| 7e · 7f | `backend-lote-7e`, `-7f` | Fallos del panel: comparar periodos con el cálculo de Analítica, «libras» fuera del dominio y solicitudes con la hora pasada | — |
| 8 | `backend-lote-8` | **Accesos y roles**: gerente, subencargado, recepción y estilista, con invitaciones, permisos y recorte de datos | `contrato-accesos.md`, `diseno-accesos-y-roles.md` |
| 9 · 9b | `backend-lote-9`, `-9b` | **Deshacer e historial**: registro por campo, inversos, versiones del perfil y auditoría | `contrato-deshacer.md`, `diseno-deshacer.md` |

## 2. Lote 5: señal

- **Qué hace.** Ofrece la regla del salón: importe fijo o porcentaje, a quién se aplica, plazo, Bizum y cuándo se devuelve. El ciclo de cada cita avanza con transiciones puras (`src/lib/senal.ts`), cada una devuelve un parche, y el vencimiento se calcula a partir del plazo.
- **Esquema.** Es la sección 10 de `pendiente.sql`:
  - Columnas `deposit_status`, `deposit_method`, `deposit_received_eur`, `deposit_applied_*`, `deposit_refunded_*`, `deposit_retained_at` y `deposit_note`.
  - Comprobaciones de estado y de método.
  - Migración de las filas antiguas.
- **Tests.** `senal.test.ts` y `senal-ciclo.test.ts`.
- **Límites.** El pago no se verifica: la dueña marca la señal como recibida cuando la ve en su banco. No hay pasarela de pago, y es a propósito.

## 3. Lote 6: preguntas de reserva

- **Qué hace.** Cada salón tiene su lista de preguntas: texto, sí/no, opción o número, obligatorias, activas, por servicio y con detalle si la respuesta es «sí». Si el salón no tiene lista propia, se hacen las tres de siempre. Las respuestas se guardan por id en `bookingAnswers`.
- **Esquema.** Van en `salons.profile` (jsonb) y `appointments.booking_answers` (sección 9), así que no hace falta una tabla nueva.
- **Tests.** `preguntas-reserva.test.ts` y `booking-answers.test.ts`.

## 4. Lotes 7 a 7f: motor del asistente

- **Qué hace.**
  - **Recorrido de una pregunta.** Normaliza el texto, reconoce entidades (fecha, profesional, servicio, clienta) y las enmascara. Después compara por parecido ponderado con IDF, aplica pistas y exige anclas de vocabulario del salón. Con eso decide la intención, llama a su resolutor puro y arma la respuesta.
  - **Formas de respuesta.** Hay cuatro: respuesta, elegir, no-se y escalar. El escalado da primero los pasos y la guía, y después el contacto.
  - **Otras reglas.** Recuerda el contexto de la última pregunta («¿y mañana?») y nunca responde datos de salud.
- **Datos.** Llegan por la interfaz inyectada `FuentesAsistente`, así que el motor no importa nada de la pantalla. Comparar periodos usa el mismo cálculo que Analítica (`resumenPeriodo`, lote 7e).
- **Medición.** Hay tres métricas: acierto, inofensivo (pregunta o dice «no lo sé») y dañino (responde con otro dato).

| Corpus | Acierto | Inofensivo | Dañino | Negocio |
|---|---|---|---|---|
| Desarrollo, 430 frases | 98,8 % | 0,9 % | 0,2 % | 98,6 % |
| **Ciego 4, 250 frases, medido una sola vez** | **90,0 %** | **5,6 %** | **4,4 %** | **91,1 %** |

- **Cifra honesta.** Es la del ciego 4, aceptada como techo. En ningún corpus aparecen datos de otra clienta. Con el catálogo precalentado, cada pregunta tarda menos de 20 ms.
- **Tests.** `src/lib/asistente/*.test.ts`: corpus, responder, resolutores, reloj, guía, entidades, parecido e intenciones.
- **Límites.** Entiende por vocabulario, no por sentido. Algunas palabras tienen dos sentidos. Cuando duda entre dos intenciones vecinas, pregunta a propósito. El detalle está en `asistente-informe-final.md`.

## 5. Lote 8: accesos y roles

- **Qué hace.**
  - **Roles.** Hay cuatro, con una matriz declarativa (`src/lib/permisos.ts`) acordada fila a fila con FRONTEND. El alcance de cada permiso es «propio» o «todo».
  - **Guardas en el servidor.** Cada escritura se traduce a acciones y se exigen sobre la profesional actual de la cita, leída de la base de datos, y sobre la nueva si se mueve.
  - **Recorte de datos.** A la estilista le llegan las citas ajenas como bloque ocupado, sin clienta ni precio, y solo sus clientas.
  - **Invitaciones.** Salen por correo desde el servidor con service role y caducan a los 7 días. Solo las acepta el mismo correo invitado.
  - **Plan.** Fuera de «Todo incluido», como mucho dos tipos de rol.
  - **Última gerente.** No puede darse de baja.
- **Compatibilidad.** Sin las columnas nuevas, todo miembro actual es gerente, como hasta ahora, y nadie se queda fuera. La demo por enlace no cambia.
- **Esquema.** Es la sección 11: columnas nuevas en `salon_members` (employee_id, display_name, email, invited_by, estado, actualizado) y la tabla `salon_invitaciones`. En producción, `salon_members` está vacía.
- **Tests.** `permisos.test.ts`, `api/autorizacion.test.ts`, `api/guardas.test.ts`, `api/recorte.test.ts`, `api/accesos.test.ts` y guardias.
- **Límites.** El perfil del salón es público, porque es la web de reservas: ocultar la landing o los horarios a una estilista es cosa de la pantalla. Las pantallas de Accesos y `/aceptar` son de FRONTEND.

## 6. Lotes 9 y 9b: deshacer e historial

- **Qué hace.**
  - **Registro por campo.** Cada acción reversible guarda solo los campos que cambia, con su antes y su después (`src/lib/cambios.ts`). Las acciones de la store registran solas.
    - Citas: cancelar o rechazar, confirmar, asistencia, cobro, mover, editar y señal.
    - Clientas: recargos y bloqueo.
    - Servicios: editar y borrar, que vuelve con el mismo id.
    - Perfil: cada campo por separado. Incluye la landing, los horarios, el equipo, las preguntas, la señal, las plantillas y los ajustes.
  - **Cuándo se puede deshacer.** Solo si el estado actual sigue siendo el que dejó el cambio. Si no, la respuesta es uno de estos motivos: `CAMBIADO`, `POSTERIORES`, `SOLAPE`, `PERMISO`, `CADUCADO` (90 días) o `DESHECHO`.
  - **Permisos.** Se aplican por rol y alcance. Deshacer lo de otra persona exige `historial.deshacer-ajeno`.
  - **Aviso a la clienta.** Si ya recibió un WhatsApp, se avisa antes de deshacer. `abrirWhatsAppDeCita` marca la cita como avisada al abrir el mensaje.
  - **Servidor.** El historial se guarda de forma idempotente, con la autora sacada del token.
  - **Versiones.** Mi página guarda una versión en cada publicación y otra ligera al empezar una tanda de ajustes. Hay «Restaurar esta versión».
  - **Auditoría.** `appointments.ultimo_deshacer_en` registra cuándo se deshizo algo en una cita.
- **Esquema.** Sección 12: tablas `cambios` y `perfil_versiones`, con RLS y sin políticas. Sección 13: columna `appointments.ultimo_deshacer_en`.
- **Tests.** `cambios.test.ts`, `deshacer.store.test.ts` y `api/cambios.functions.guardia.test.ts`.
- **Límites.**
  - Si se deshace el alta de una clave del perfil que antes no existía, el parche al servidor no la borra.
  - Las pantallas del aviso de 10 s, el historial y las versiones son de FRONTEND.

## 7. Esquema: estado de `supabase/pendiente.sql`

Las secciones son idempotentes y se aplican en orden en un solo bloque.

| Sección | Contenido | Estado |
|---|---|---|
| 1-8 | Lista de espera, caja y fianza, color por visita, bloqueo por plantón, calendario suscribible, fichas sin teléfono, RLS y `salon_members`, índices, leads de las demos | Validadas con rollback, sin aplicar |
| 9 | Lote 3: columnas propias (respuestas de reserva, plazo de la señal, origen, `updated_at` y disparador…) | Validada con rollback, sin aplicar |
| 10 | Ciclo de vida de la señal | Validada con rollback, sin aplicar |
| 11 | Accesos y roles | Validada con rollback, sin aplicar |
| 12 | Historial de cambios y versiones del perfil | Validada con rollback, sin aplicar |
| 13 | `ultimo_deshacer_en` | Validada con rollback, sin aplicar |

Validador versionado en `scripts/validar-sql/`. Usa las credenciales solo del entorno y compara un volcado de esquema antes y después.

## 8. Qué falta aplicar, en orden

1. **Supabase, SQL.** Pegar `supabase/pendiente.sql` entero en el SQL Editor y ejecutarlo. Después, repetir la comprobación del validador: deben aparecer las columnas y tablas nuevas.
2. **Supabase, Auth.** Añadir la URL `/aceptar` del dominio de producción a Authentication › URL Configuration › Redirect URLs, porque la invitación vuelve a esa ruta. Revisar que la plantilla del correo de invitación esté en español.
3. **Primera gerente.** Dar de alta a la gerente del primer salón real con `supabase/alta-primer-usuario.sql`, que ya inserta el rol `'gerente'`. Con la comprobación de la sección 11, `'dueno'` ya no se admite. A partir de ahí, el resto de accesos se invitan desde Ajustes › Accesos.
4. **Vercel.** No hay variables nuevas en este ciclo. Las funciones de invitación usan la service role ya configurada. Desplegar la rama fusionada.
5. **Prueba en producción.** Invitar a una estilista, aceptar la invitación, comprobar que solo ve lo suyo, cancelar una cita y deshacerla, y restaurar una versión de Mi página.

## 9. Contratos para FRONTEND

`contrato-senal.md`, `contrato-preguntas.md`, `contrato-asistente.md`, `contrato-accesos.md` y `contrato-deshacer.md`. La fusión con `codex/arena-frontend` se ensaya en la rama desechable `codex/ensayo-fusion-2`, en un informe aparte.
