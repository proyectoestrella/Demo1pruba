# Deshacer e historial de cambios: diseño (lote 9)

Rama `codex/peluchic-backend`, 25/09/2026. Es un documento de diseño y todavía no hay código de producto. El contrato para FRONTEND está en `docs/contrato-deshacer.md`. Los roles y permisos salen de `docs/diseno-accesos-y-roles.md`.

## 1. Lo que hay hoy

Ya existen dos deshaceres sueltos, cada uno a su manera, y el resto de acciones no tiene vuelta atrás:

- **Mi página** (`app.web.tsx`). Guarda en memoria el perfil anterior a la última publicación y «Deshacer» lo vuelve a publicar entero. Se pierde al recargar.
- **Decisiones de deuda** (`DecisionDeudaDialog`). Aviso de 9 s con «Deshacer» que restaura el estado de deuda anterior. También solo en memoria.
- **Cancelar una cita o borrar un servicio.** El diálogo dice «Esta acción no se puede deshacer».

Datos: las citas y las clientas viajan por **parche por campos** (`syncAppointmentPatch`, `camposCambiados`). El equipo, los horarios, la carta, las preguntas, la señal y los ajustes viven en `salons.profile`, un JSON, y viajan por `patchSalonProfile`.

## 2. Idea

Cada acción reversible deja **una fila en el registro de cambios** con el estado de antes y el de después **de los campos que cambió**, nada más. Deshacer es aplicar el «antes» como un parche nuevo, **solo si el estado actual sigue siendo el «después»**. Deshacer no borra nada: añade una fila más y marca la original como deshecha. Una sola pieza da el deshacer inmediato (aviso de 10 s) y el historial completo (Ajustes › Historial de cambios).

## 3. Registro de cambios

En la store (`cambios`, los últimos 200, persistidos) y en Supabase, tabla `cambios`, que va a `pendiente.sql` sin aplicar:

```sql
create table if not exists cambios (
  id uuid primary key,                 -- lo genera el cliente: idempotente al reintentar
  salon_slug text not null,
  tipo text not null,                  -- id estable del tipo de cambio (ver §4)
  entidad text not null,               -- 'cita' | 'clienta' | 'perfil' | 'servicio' | 'profesional' | ...
  id_entidad text not null,            -- id de la cita/clienta; para el perfil, la ruta ('menu', 'team.2', 'deposit')
  antes jsonb not null,                -- SOLO los campos que cambian, con su valor anterior
  despues jsonb not null,              -- los mismos campos, con el valor nuevo
  resumen text not null,               -- «Cancelada la cita de Lucía (mar 30, 10:00)»: lo que se lee en el historial
  autor uuid,                          -- user_id del miembro; null en demo
  autor_nombre text,                   -- display_name en el momento (sobrevive a una baja)
  fecha timestamptz not null default now(),
  deshecho_en timestamptz,
  deshecho_por uuid,
  deshace_a uuid references cambios (id),   -- si esta fila ES un deshacer, a cuál deshace
  aviso_enviado boolean not null default false  -- se mandó WhatsApp a la clienta por este cambio
);
create index if not exists cambios_salon_fecha on cambios (salon_slug, fecha desc);
alter table cambios enable row level security;   -- sin políticas: solo el servidor
```

- **Retención: 90 días.** El borrado lo hace el mismo servidor al escribir (`delete … where fecha < now() - interval '90 days'`), porque no hay cron. En la store se guardan los 200 últimos.
- **Demo por enlace.** Solo en la store, sin servidor. Funciona igual en pantalla.

## 4. Acciones reversibles y su inverso

| Tipo (`tipo`) | Entidad | Campos de «antes/después» | Inverso |
|---|---|---|---|
| `cita.cancelar` / `cita.rechazar` | cita | `status` (+ señal si se resolvió) | Vuelve al `status` anterior. Si la hora ya pasó, avisa |
| `cita.confirmar` | cita | `status`, `duration` fijada | Vuelve a `pending` y a la duración anterior |
| `cita.marcar-asistencia` | cita | `status` (vino/no vino/tarde), recargo de la clienta | Estado anterior. Si se aplicó recargo, se quita |
| `cita.cobrar` | cita | `paidAt`, `paymentMethod` | Vuelve a «sin cobrar» |
| `cita.mover` | cita | `start`, `employeeId`, `duration` | Hora y profesional anteriores **si el hueco sigue libre**. Si no, avisa del solape y no aplica |
| `cita.editar` | cita | los campos editados | Los anteriores |
| `senal.*` | cita | campos `deposit*` que cambió el paso (pedida, recibida, aplicada…) | Los del paso anterior. Encaja con `deshacerRecibida` y `reabrirSenal` de `senal.ts` |
| `recargo.*` | clienta | `penaltyEur`, `manualBlock`, nota de deuda | Los anteriores (sustituye al deshacer suelto de `DecisionDeudaDialog`) |
| `servicio.editar` / `servicio.borrar` | perfil (`menu`) | la entrada de la carta | La entrada anterior. Borrar un servicio pasa a ser reversible |
| `profesional.editar` / `horario.editar` | perfil (`team`, `teamHours`) | la ficha o el horario de ESA profesional | Los anteriores |
| `preguntas.editar` | perfil (`preguntasReserva`) | la lista | La anterior |
| `ajustes.editar` | perfil (clave concreta: señal, plantones, duración flexible…) | esa clave | La anterior |
| `perfil.publicar` | perfil completo | versión | «Restaurar esta versión» (§5) |

Quedan fuera del deshacer, con una confirmación clara, las que no tienen inverso seguro: **borrar una clienta con historial**, **vaciar el salón**, **dar de baja un acceso** (se reinvita), **mensajes ya enviados** (un WhatsApp no se puede des-enviar).

## 5. Versiones del perfil (Mi página)

Cada «Publicar» guarda una versión en `perfil_versiones (id, salon_slug, perfil jsonb, publicado_por, autor_nombre, fecha, nota)`. Se guardan las 30 últimas o las de los últimos 90 días, lo que dé más. En Mi página › «Versiones anteriores», cada una lleva fecha, autora y «Restaurar esta versión». Restaurar publica esa versión como una nueva y queda en el historial como `perfil.restaurar`. El «Deshacer» de 10 s que ya existe en Mi página pasa a usar esto y sobrevive a recargar.

## 6. Reglas

1. **Aviso inmediato.** Tras cada acción reversible sale un aviso de 10 s con «Deshacer». Pulsarlo equivale a deshacer esa fila.
2. **Historial.** Está en Ajustes › Historial de cambios: lista por fecha con autora y resumen, filtros por tipo, por persona y por clienta, y «Deshacer» por fila.
3. **Comprobación de estado.** Solo se deshace si los campos de la entidad siguen valiendo lo que dice `despues`. Si alguien los cambió después, el botón dice «Ya no se puede deshacer: esto ha cambiado desde entonces» y ofrece ver el cambio posterior. Sin sobrescribir en silencio.
4. **Cadena.** Deshacer un cambio antiguo cuando hay otros posteriores sobre la **misma entidad** exige deshacer primero los posteriores. El historial lo indica.
5. **Clienta ya avisada.** Si `aviso_enviado` es cierto (se mandó el WhatsApp de confirmación, cambio o cancelación), antes de deshacer se advierte: «Lucía ya recibió un WhatsApp con este cambio. Si lo deshaces, avísale de nuevo», con el botón del mensaje nuevo listo.
6. **Permisos.** Cada cual deshace lo suyo si tiene el permiso de la acción original (con su alcance). Deshacer lo de otra persona exige `historial.deshacer-ajeno` (gerente). El servidor lo comprueba.
7. **Deshacer un deshacer.** Se puede (es «rehacer»): genera otra fila.
8. **Tiempo.** Después de 90 días la fila desaparece y no se puede deshacer.

## 7. Cómo viaja al servidor

- **Acción normal.** El parche por campos de siempre lleva además `cambio: { id, tipo, antes, despues, resumen }`. El servidor valida permiso y alcance, aplica el parche y escribe la fila de `cambios` en la misma llamada. Si la fila no se puede escribir, el cambio se aplica igual y se registra el fallo: nunca se pierde el dato por el historial.
- **Deshacer.** `deshacerCambio({ slug, cambioId })` en el servidor:
  1. Lee la fila y comprueba permiso.
  2. Lee el estado actual y comprueba que coincide con `despues` (regla 3).
  3. Aplica `antes` como parche con `origen: "deshacer"`, mueve la cita solo si no hay solape y registra la fila inversa.
  4. Marca `deshecho_en` y `deshecho_por`.
  5. Devuelve `{ ok, entidad nueva }` o `{ ok: false, motivo: "CAMBIADO" | "SOLAPE" | "PERMISO" | "CADUCADO" }`.
- **Idempotencia.** El `id` del cambio lo genera el navegador. Un reintento no duplica la fila ni aplica dos veces.
- **Sin conexión.** La acción y su fila se encolan juntas, con el mismo mecanismo de reintento que ya tiene la store.

## 8. Orden de implementación (lote 9)

1. `src/lib/cambios.ts`, puro: tipos, `registrarCambio` (a partir del antes y el después de una entidad, solo los campos que cambian), `puedeDeshacer` (estado actual, permisos, cadena), `inverso(cambio)` y `resumenDe(cambio)`. Con pruebas por tipo.
2. Store: `cambios`, `deshacer(id)`, integración en las acciones de la tabla §4, y el aviso de 10 s unificado.
3. Servidor: el campo `cambio` en los parches, `deshacerCambio` y `listarCambios` (paginado y filtrado por permiso), con pruebas de guarda.
4. Versiones del perfil: `perfil_versiones`, `listarVersiones`, `restaurarVersion`.
5. SQL en `pendiente.sql`, sin aplicar. Contrato para FRONTEND actualizado.
