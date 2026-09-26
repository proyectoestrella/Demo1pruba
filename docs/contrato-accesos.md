# Contrato de accesos y roles para FRONTEND

Diseño en `docs/diseno-accesos-y-roles.md`. Lo implementa BACKEND en el lote 8. Aquí va lo que FRONTEND puede usar y los ids estables.

## 1. Tipos

```ts
type Rol = "gerente" | "subencargado" | "recepcion" | "estilista";

interface Miembro {
  userId: string;
  rol: Rol;
  employeeId: string | null;   // la profesional vinculada (estilista)
  displayName: string | null;  // «Noelia»
  email: string;
  estado: "invitada" | "activa" | "baja";
}

/** Lista ÚNICA acordada con FRONTEND (ux-accesos-y-roles.md). Ids estables. */
type PaginaId =
  | "hoy"            // /app
  | "calendario"     // /app/calendar
  | "citas"          // /app/appointments
  | "lista-espera"   // /app/waitlist
  | "clientas"       // /app/clients
  | "hoja"           // /app/hoja
  | "equipo"         // /app/employees
  | "servicios"      // /app/services
  | "mi-pagina"      // /app/web
  | "ajustes"        // /app/settings
  | "ajustes.accesos"
  | "ajustes.historial"
  | "analitica"      // /app/insights
  | "marketing"      // /app/marketing
  | "asistente"      // panel del asistente
  | "demos";         // /app/demos (solo interno)

type AccionId =
  | "cita.ver-todas" | "cita.crear" | "cita.crear-para-otra" | "cita.editar" | "cita.mover" | "cita.cancelar"
  | "cita.confirmar-solicitud" | "cita.rechazar-solicitud" | "cita.marcar-asistencia" | "cita.cobrar" | "cita.recordar"
  | "clienta.ver" | "clienta.ver-todas" | "clienta.crear" | "clienta.editar" | "clienta.borrar" | "clienta.bloquear"
  | "clienta.importar" | "clienta.exportar"
  | "senal.gestionar" | "recargo.gestionar" | "lista-espera.gestionar"
  | "servicio.editar" | "equipo.editar" | "salon.editar" | "web.editar" | "web.publicar" | "web.restaurar-version"
  | "dinero.ver-propio" | "dinero.ver-global" | "analitica.ver" | "marketing.usar" | "exportar.excel"
  | "accesos.gestionar" | "historial.ver" | "historial.deshacer-ajeno" | "plan.gestionar" | "datos.borrar"
  | "calendario-externo.gestionar"; // lote 13, alcance "propio" para la estilista — ver docs/contrato-calendarios.md §3

/**
 * Alcance por permiso, no ids duplicados: una estilista tiene cita.* y
 * dinero.ver-propio con alcance "propio" (solo citas de su employeeId).
 */
type Alcance = "propio" | "todo";

interface Permisos {
  rol: Rol;
  paginas: ReadonlySet<PaginaId>;
  /** Acción → alcance. Ausente = no permitida. */
  acciones: ReadonlyMap<AccionId, Alcance>;
  /** Sin cita.ver-todas: las citas ajenas llegan como bloque ocupado (sin clienta ni precio). */
  notasClienta: boolean;
}
```

## 2. Lo que expone BACKEND (implementado en el lote 8)

| Pieza | Fichero | Uso |
|---|---|---|
| `permisosDe(rol)`, `puede(p, accion, { employeeId, miEmployeeId }?)`, `alcance(p, accion)`, `vePagina(p, pagina)`, `PERMISOS_DEMO` | `src/lib/permisos.ts` | Puras. Son las mismas que usa el servidor. La tabla acción × rol es la tuya, copiada fila a fila |
| `MiembroActual` `{ rol, employeeId, displayName }` | `src/lib/permisos.ts` | Lo devuelve `accesoAlPanel` |
| `useSalonStore().miembro` / `setMiembro` | `src/lib/store.ts` | La ruta `/app` lo rellena al cargar y **no se persiste**. Vale `null` en una demo |
| `useMiembroActual()`, `usePermisos()`, `saludo(nombre, hora)` | `src/lib/use-permisos.ts` | En una demo, o mientras se resuelve, los permisos son los de la gerente |
| `accesoAlPanel({ slug })` | `src/lib/api/salons.functions.ts` | `{ real, permitido, miembro }` |
| `listarMiembros({ slug })` | `src/lib/api/accesos.functions.ts` | `{ miembros, invitaciones (con caducada) }` |
| `invitarAlSalon({ slug, email, rol, employeeId?, displayName? })` | idem | `{ ok: true, dato: { invitacionId } }` o `{ ok: false, codigo, motivo }` |
| `aceptarInvitacionAlSalon({ slug, invitacionId })` | idem | Para la ruta `/aceptar?s=&inv=`, que es la vuelta del correo |
| `cambiarRolMiembro`, `darDeBajaMiembro`, `revocarInvitacionAlSalon`, `reenviarInvitacionAlSalon` | idem | Mismo tipo de resultado |

Los `codigo` de error son `PERMISO`, `PLAN`, `DATOS`, `ULTIMA_GERENTE`, `NO_EXISTE`, `CADUCADA`, `OTRO_CORREO` y `YA_MIEMBRO`. En todos, `motivo` ya viene redactado para mostrarlo tal cual. Una acción sin permiso lanza `PermisoDenegado` (código `PERMISO_DENEGADO`), con un texto para la persona. En una demo, las funciones de accesos lanzan un aviso: en las demos no hay cuentas.

**Datos que llegan a cada rol.** El servidor ya los recorta en `listSalonData`:
- Sin `cita.ver-todas`, las citas ajenas llegan con `bloqueOcupado: true`: inicio, duración y profesional, sin clienta, sin servicios y con el precio a 0. No se pintan, y solo sirven para calcular huecos y solapes.
- Sin `clienta.ver-todas`, llegan solo las clientas que tienen cita con ella.
- La lista de espera solo llega con `lista-espera.gestionar`.
- El perfil del salón es público (web de reservas). Ocultar la landing o los horarios de otras a una estilista se hace en la pantalla.

## 3. Reglas para la pantalla

- **Ocultar no es proteger.** El servidor ya recorta y rechaza. Ocultar evita botones que fallarían.
- **Páginas.** Si `!vePagina(p, pagina)`, la página no sale en el menú y la ruta muestra «No tienes acceso a esta sección», sin error técnico.
- **Deshacer.** Cada cual deshace lo suyo si tiene el permiso de la acción original. Deshacer lo de otra persona exige `historial.deshacer-ajeno`.
- **Botones.** Si `!puede(p, accion)`, no se pintan, en vez de pintarlos deshabilitados.
- **Saludo.** «Buenos días, {displayName}». Sin nombre, «Buenos días».
- **Estilista en Hoy y Calendario.** Por defecto, sus citas. Sin `cita.ver-todas`, las de las demás llegan del servidor solo como bloque ocupado (inicio, duración y profesional, sin clienta ni precio): se pintan en gris para no pisarse al dar cita. Con `cita.ver-todas`, un conmutador «Ver todas» las muestra completas.
- **Plan.** Si `invitarMiembro` responde `{ ok: false, codigo: "PLAN" }`, se muestra el mensaje de plan con la alternativa y ejemplo@sishow.com.
- **Demo por enlace.** No cambia: sin login y con todo visible, como gerente.
