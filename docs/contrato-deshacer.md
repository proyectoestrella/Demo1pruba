# Contrato de deshacer e historial para FRONTEND

Diseño en `docs/diseno-deshacer.md`. Lo implementa BACKEND en el lote 9.

## 1. Tipos

```ts
type TipoCambio =
  | "cita.cancelar" | "cita.rechazar" | "cita.confirmar" | "cita.marcar-asistencia" | "cita.cobrar"
  | "cita.mover" | "cita.editar"
  | "senal.pedir" | "senal.prorrogar" | "senal.recibir" | "senal.aplicar" | "senal.devolver" | "senal.retener"
  | "recargo.aplicar" | "recargo.perdonar" | "recargo.cobrar"
  | "servicio.editar" | "servicio.borrar" | "profesional.editar" | "horario.editar"
  | "preguntas.editar" | "ajustes.editar" | "perfil.publicar" | "perfil.restaurar";

interface Cambio {
  id: string;                    // uuid generado en el navegador
  tipo: TipoCambio;
  entidad: "cita" | "clienta" | "perfil";
  idEntidad: string;
  antes: Record<string, unknown>;    // solo los campos que cambian
  despues: Record<string, unknown>;
  resumen: string;                   // «Cancelada la cita de Lucía (mar 30, 10:00)»
  autor: string | null;              // userId; null en demo
  autorNombre: string | null;
  fecha: string;                     // ISO
  deshechoEn?: string;
  deshechoPor?: string;
  deshaceA?: string;                 // si este cambio ES un deshacer
  avisoEnviado: boolean;             // se mandó WhatsApp a la clienta por este cambio
}

type EstadoDeshacer =
  | { puede: true; aviso?: "CLIENTA_AVISADA" }
  | { puede: false; motivo: "CAMBIADO" | "POSTERIORES" | "SOLAPE" | "PERMISO" | "CADUCADO" | "DESHECHO" };
```

## 2. Lo que expone BACKEND (implementado en el lote 9)

| Pieza | Fichero | Uso |
|---|---|---|
| Tipos `Cambio`, `TipoCambio`, `EstadoDeshacer`, `MotivoNoDeshacer`; `textoMotivo(m)`, `textoClientaAvisada(nombre)`, `SEGUNDOS_AVISO` (10) | `src/lib/cambios.ts` | Puros. La entidad puede ser también `"servicio"`. Hay además el tipo `clienta.bloquear` |
| `useSalonStore().cambios` | `src/lib/store.ts` | Lo último primero, como mucho 200 y 90 días. **Se persiste** |
| **Registro automático** | `store.ts` + `registro-cambios.ts` | No hay que hacer nada: estas acciones ya dejan su cambio al llamarlas (ver la lista de abajo) |
| `estadoDeshacer(id)` | store | `EstadoDeshacer`, para pintar el botón o el motivo |
| `deshacerCambio(id)` | store | `{ ok: true, aviso? }` o `{ ok: false, motivo }`. Aplica el inverso por el mismo camino de sincronización y sube el deshacer |
| `abrirWhatsAppDeCita(citaId, url)` | store | **Abrir así todo WhatsApp por una cita.** Abre el enlace y marca como avisada la última modificación de esa cita en las últimas 24 h. Ya lo usan la ficha de la cita, el aviso de solicitudes y la hoja del día |
| `marcarAvisoEnviado(id)` | store | Marca a mano un cambio concreto (casos raros) |
| `listarCambios({ slug, antesDe?, tipo?, autor?, idEntidad?, limite? })` | `src/lib/api/cambios.functions.ts` | El historial de todos los aparatos (`historial.ver`). En una demo, la lista local `cambios` |
| `listarVersiones({ slug })`, `restaurarVersion({ slug, versionId })` | `src/lib/api/salons.functions.ts` | Versiones de Mi página (`web.restaurar-version`). `restaurarVersion` devuelve `{ ok, profile }`: hay que aplicarlo con `updateSalonProfile(profile)` |

**Acciones que registran solas:**
- `updateSalonProfile`, **un cambio por campo** (tipo `perfil.campo`, `idEntidad` = la clave). Cubre la landing, los horarios, el equipo, las preguntas, la señal, las plantillas, los colores, el logo y los ajustes. El permiso para deshacerlo es el de su parte: `accionesDeCambio`. Las cargas de un perfil (salón real, demo por enlace) no registran, porque van dentro de `conRegistroEnPausa`. Si cargas un perfil desde una pantalla nueva, envuélvelo igual.
- `updateAppointment`, `cancelAppointment` (cancelar o rechazar) y `markPaid`.
- Los pasos de la señal: `pedirSenal`, `recibirSenal`, `deshacerSenalRecibida`, `darMasTiempoSenal`, `confirmarDevolucionSenal`, `markDepositRequested`, `extendDepositDeadline` y `markDepositReceived`.
- `setManualBlock`, `applyPenalty`, `clearPenalty` y `setDeuda`.
- `updateService` y `deleteService`. Un servicio borrado vuelve con el mismo id.

No registran: las acciones automáticas (liberar señales vencidas, hidratar desde el servidor, demos, reinicio del perfil), lo que ocurre durante un deshacer ni las marcas internas de la lista de configuración.

**Versiones.**
- **Al publicar.** Cada publicación de Mi página guarda el estado publicado.
- **Al guardar ajustes por parche.** Se guarda una **versión ligera agrupada**: el perfil de ANTES, con la nota «Antes de cambiar ajustes», cuando empieza una tanda (la última versión tiene más de 30 minutos). Así queda un punto al que volver por tanda, sin expulsar publicaciones.

**Auditoría.** El parche de un deshacer de cita viaja con `origen: "deshacer"` y el servidor anota `appointments.ultimo_deshacer_en`. La columna `origen` no se toca: es la procedencia de la cita. El `DecisionDeudaDialog` puede quedarse con su aviso actual o usar el de `setDeuda`, que ya registra.

**El aviso de 10 s tras una acción** usa `useSalonStore.getState().cambios[0]` justo después de llamarla: su `resumen` y `deshacerCambio(cambios[0].id)`.

## 3. Reglas para la pantalla

- **Aviso tras cada acción reversible.** Dura 10 s y lleva «Deshacer». Usa `toast` con `action`, como el de deuda que ya hay.
- **Ajustes › Historial de cambios** (página `ajustes.historial`, permiso `historial.ver`):
  - Filas con fecha, autora y `resumen`.
  - Botón «Deshacer» si `puedeDeshacer(...).puede`. Si no puede, el motivo en palabras:
    - `CAMBIADO`: «Esto ha cambiado desde entonces».
    - `POSTERIORES`: «Deshaz antes los cambios posteriores».
    - `SOLAPE`: «El hueco ya está ocupado».
    - `PERMISO`: sin botón.
    - `DESHECHO`: etiqueta «Deshecho».
- **`CLIENTA_AVISADA`.** Antes de deshacer, pide confirmación: «Lucía ya recibió un WhatsApp con este cambio. Si lo deshaces, avísale de nuevo», y deja listo el botón del mensaje.
- **Mi página › Versiones anteriores.** Fecha, autora y «Restaurar esta versión», con el permiso `web.restaurar-version`.
- **Los diálogos que hoy dicen «Esta acción no se puede deshacer»** (cancelar una cita, borrar un servicio) pasan a decir que se puede deshacer desde el aviso o el historial.
