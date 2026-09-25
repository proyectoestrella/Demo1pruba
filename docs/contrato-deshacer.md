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

## 2. Lo que expone BACKEND

| Pieza | Fichero | Uso |
|---|---|---|
| `registrarCambio(tipo, entidad, antes, despues, …)` | `src/lib/cambios.ts` | Puro. Calcula solo los campos que cambian y el `resumen` |
| `puedeDeshacer(cambio, estadoActual, permisos, cambiosPosteriores)` | idem | Puro. Devuelve `EstadoDeshacer` |
| `useSalonStore().cambios` / `deshacer(id)` | store | Lista local (200) y acción. En un salón real llama al servidor |
| `listarCambios({ slug, desde?, tipo?, autor?, clienta?, cursor? })` | `src/lib/api/cambios.functions.ts` | Historial paginado, ya filtrado por permiso |
| `deshacerCambio({ slug, cambioId })` | idem | `{ ok: true, cambio }` o `{ ok: false, motivo }` |
| `listarVersiones({ slug })` / `restaurarVersion({ slug, versionId })` | `src/lib/api/salons.functions.ts` | Versiones de Mi página |

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
