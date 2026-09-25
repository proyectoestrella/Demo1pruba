# Accesos y roles: auditoría y diseño (lote 8)

Rama `codex/peluchic-backend`, 25/09/2026. Es un documento de diseño y todavía no hay código de producto. El contrato para FRONTEND está en `docs/contrato-accesos.md`.

## 1. Lo que hay hoy

| Pieza | Dónde | Cómo funciona |
|---|---|---|
| Entrada | `src/lib/sesion.ts` | Enlace mágico de Supabase (`signInWithOtp`), sin contraseñas. «Salir» borra la sesión y el almacén local del salón (`trimly-salon-store`) |
| Sobre de la petición | `src/lib/api/sesion.middleware.ts` (`conSesion`) | Añade `Authorization: Bearer <token>` si hay sesión. No es la seguridad: es el sobre |
| Decisión | `src/lib/api/autorizacion.ts` (lógica pura) y `.server.ts` (cableado) | `resolverAcceso(slug)` devuelve `demo`, `miembro` o `ajeno`. Primero mira si el slug tiene fila en `salons`: si no la tiene, es una demo y se entra sin pedir nada. Si la tiene, hace falta un token válido y una fila en `salon_members` |
| Guardas | `exigirMando`, `vistaEfectiva` | Unas 15 funciones de `salons.functions.ts` y las de calendario exigen mando. `listSalonData` recorta a vista pública a quien es ajeno |
| Tabla | `salon_members (user_id, salon_slug, rol, creado)` | La clave primaria es `(user_id, salon_slug)`. `rol` vale `'dueno'` por defecto; `'encargado'` está previsto, pero **el servidor trata igual a todos los miembros** |
| Alta | `supabase/alta-primer-usuario.sql` | A mano en el SQL Editor. La persona pide primero el enlace, con lo que ya existe en `auth.users`, y después se inserta su fila. No hay invitaciones |
| RLS | `schema.sql` / `pendiente.sql` | Activado y sin políticas en todas las tablas. Solo el servidor, con service role, lee y escribe. La clave anónima no ve nada |
| Salón de un usuario | `use-real-salon.ts` | El slug llega por la URL (`?s=` / ruta) y el servidor comprueba la pertenencia en cada llamada. No existe «mis salones»: quien pertenezca a dos salones entra con la URL de cada uno |
| Equipo | `profile.team` (texto «Nombre~Especialidad»), `teamIds`, `teamHours` | Las profesionales son datos del perfil, no usuarios. `employee_id` es un id de texto estable (`teamIds`) |
| Demo por enlace | `?d=` sin fila en `salons` | Sin login y con barra libre. Todo vive en el navegador. **No se toca** |

**Qué distingue hoy al dueño de un miembro: nada.** Cualquier fila en `salon_members` da mando completo: dinero, ajustes, web y borrar.

## 2. Roles

| Rol | Quién | Resumen |
|---|---|---|
| `gerente` | María | Todo. Único rol que gestiona accesos, plan y borrados definitivos |
| `estilista` | Cada empleada, vinculada a su `employee_id` | Su agenda y las fichas de sus clientas. Sin dinero global, sin horarios ajenos, sin web |
| `subencargado` (previsto) | Encargada de confianza | Todo salvo dinero global, plan, accesos y borrar |
| `recepcion` (previsto) | Recepción | Agenda de todas y clientas. Sin dinero |

El `dueno` actual pasa a `gerente` en la migración. No existe un «superusuario de siShow» en la tabla: el soporte entra, si hace falta, con su propia fila temporal, que queda en el historial.

## 3. Tabla `salon_members` (nueva forma)

```sql
alter table salon_members
  add column if not exists employee_id text,          -- obligatorio si role = 'estilista'
  add column if not exists display_name text,         -- «Noelia»: para el saludo
  add column if not exists email text,                -- el correo invitado (antes de existir en auth.users)
  add column if not exists invited_by uuid references auth.users (id),
  add column if not exists estado text not null default 'activa',   -- invitada | activa | baja
  add column if not exists actualizado timestamptz not null default now();
-- `rol` se conserva como columna; valores: gerente | subencargado | recepcion | estilista
update salon_members set rol = 'gerente' where rol in ('dueno', 'encargado');
create unique index if not exists salon_members_empleada on salon_members (salon_slug, employee_id)
  where employee_id is not null and estado <> 'baja';
```

- **Invitada sin usuario.** Una invitada que aún no ha abierto el enlace no tiene `user_id`. Por eso la invitación vive en una tabla aparte, `salon_invitaciones (id, salon_slug, email, rol, employee_id, display_name, invited_by, creada, caduca, aceptada_en)`. `salon_members` solo recibe la fila cuando existe el usuario. Así la clave primaria actual no cambia.
- **Baja.** Poner `estado = 'baja'` cierra el acceso en la llamada siguiente, porque se comprueba siempre. La fila no se borra, para conservar la autoría del historial de cambios (lote 9).
- **Dónde va.** Todo en `supabase/pendiente.sql`, sin aplicar hasta que se autorice.

## 4. Invitación por correo

1. **Invitar.** En Ajustes › Accesos, la gerente escribe correo, nombre y rol y, si es estilista, elige la profesional.
2. **Servidor.** La función `invitarMiembro` exige el permiso `accesos.gestionar` y crea la fila en `salon_invitaciones`. Después llama a `auth.admin.inviteUserByEmail(email, { redirectTo: /aceptar?inv=<id> })` con service role. **Nunca desde el navegador**, porque la service role no sale del servidor.
3. **Aceptar.** La invitada pincha el enlace y entra con sesión en `/aceptar`. `aceptarInvitacion(id)` comprueba que el correo de la sesión coincide con el de la invitación y que no ha caducado (7 días). Entonces inserta la fila en `salon_members` con `estado = 'activa'` y la invitación queda aceptada.
4. **Si ya tenía usuario** (miembro de otro salón), el mismo enlace mágico sirve: el paso 3 no cambia.
5. **Reenviar y revocar.** Se hacen desde la misma lista. Revocar marca la invitación como caducada.
6. **Plan.** Las invitaciones por encima del límite del plan se rechazan en el servidor (sección 8).

## 5. Matriz de permisos declarativa (`src/lib/permisos.ts`)

Es un único fichero puro, sin Supabase, que usan **el servidor** (guardas en funciones y recorte de datos) y **FRONTEND** (ocultar). Los ids son estables. Es la **lista única acordada con FRONTEND** y está en el contrato: páginas ligadas a rutas y acciones en la forma `verbo.objeto`, con alcance `propio | todo` por permiso.

El esquema de abajo explica **qué decide** la matriz. Los tipos exactos (acción → alcance `propio | todo`) están en el contrato, que manda.

```ts
type Rol = "gerente" | "subencargado" | "recepcion" | "estilista";
interface Permisos {
  paginas: Set<PaginaId>;          // "hoy", "calendario", "clientas", "caja", "analitica", "marketing", "web", "ajustes", "accesos", "historial", ...
  acciones: Set<AccionId>;         // "cita.crear", "cita.cancelar", "cita.mover", "cobro.marcar", "servicio.editar", "perfil.publicar", "accesos.gestionar", "borrar.definitivo", ...
  datos: {
    citas: "todas" | "propias";            // «propias» = employee_id del miembro
    verTodasOpcional: boolean;              // puede cambiar a «todas» en Hoy/Calendario
    dinero: "global" | "propio" | "nada";   // caja y analítica
    horariosEquipo: "todos" | "propio";
    clientas: "todas" | "de-sus-citas";
    notasClienta: boolean;
  };
}
export function permisosDe(rol: Rol): Permisos;
export function puede(p: Permisos, accion: AccionId): boolean;
```

| | gerente | subencargado | recepcion | estilista |
|---|---|---|---|---|
| Páginas | todas | todas salvo accesos y plan | Hoy, Calendario, Clientas, Lista de espera | Hoy, Calendario, Clientas |
| Citas | todas | todas | todas | **propias**, con la opción de ver todas en solo lectura |
| Dinero | global | propio de cada una (sin caja global) | nada | el suyo (lo cobrado en sus citas) |
| Horarios del equipo | todos | todos | todos (solo lectura) | solo el suyo |
| Web / landing | editar y publicar | editar, sin publicar | no | no |
| Servicios y precios | editar | editar | ver | ver |
| Accesos, plan, borrar definitivo | sí | no | no | no |
| Asistente | todo | todo salvo dinero global | sin dinero | sus datos |

**Servidor: la seguridad está en el recorte, no en ocultar botones.**
- **`resolverAcceso`.** Pasa a devolver `{ tipo: "miembro", userId, rol, employeeId, displayName }`.
- **`exigirPermiso(slug, accion)`.** Sustituye a `exigirMando` en cada función que escribe. Por ejemplo, `syncAppointmentPatch` de una estilista solo acepta citas con su `employee_id`.
- **`listSalonData`.** Recorta según `datos`:
  - A una estilista le llegan sus citas completas y, de las ajenas, solo el hueco ocupado (inicio, duración y profesional, sin clienta ni precio) para no pisarse al dar cita.
  - Recibe solo sus clientas y su horario.
  - No recibe la landing, ni el dinero de otras, ni las notas si `notasClienta` es falso.
- **Asistente.** Recibe fuentes ya recortadas: no puede responder lo que el servidor no ha mandado.
- **Demo.** Actúa como `gerente` completo. Sigue sin login.

## 6. Qué ve cada una

- **Saludo.** «Buenos días, Noelia» sale de `display_name` del miembro. En la demo sale el nombre de la gerente del perfil, o nada.
- **Hoy y Calendario de una estilista.** Por defecto, solo sus citas. Un conmutador «Ver todas», si `verTodasOpcional`, enseña las de las demás como bloques ocupados, sin clienta ni precio.
- **Estilista en Clientas.** Solo las que han tenido o tienen cita con ella.
- **Gerente y subencargado.** Como hoy. Además, el filtro por profesional recuerda la última elección.

## 7. Casos límite

- **Profesional sin cuenta.** No pasa nada: el equipo sigue siendo del perfil. Vincular una cuenta es opcional.
- **Cambiar el rol de alguien.** Tiene efecto en la llamada siguiente. Su navegador vuelve a pedir los datos y recibe el recorte nuevo.
- **La última gerente no puede darse de baja** ni bajarse de rol. El servidor lo impide.
- **Borrar una profesional con cuenta.** El servidor pide antes dar de baja el acceso.

## 8. Plan

`profile.plan` sigue el mismo criterio del asistente: `reservas`, `reservas-asistente` o `todo-incluido`.
- **Reservas y Reservas + Asistente:** como mucho **2 roles distintos** en uso, normalmente gerente y estilista.
- **Todo incluido:** los cuatro roles.

El servidor lo comprueba al invitar. La pantalla muestra el bloqueo con el mensaje de plan del asistente: la alternativa de hoy y ejemplo@sishow.com.

## 9. Orden de implementación (lote 8)

1. `permisos.ts` y sus pruebas (matriz completa, `puede`, recortes).
2. `resolverAcceso` con rol y empleada, y `exigirPermiso`. Pruebas de guarda: una estilista no llega a otra profesional, ni al dinero global, ni a la landing.
3. Recorte de `listSalonData` por rol, con pruebas.
4. Invitaciones: `salon_invitaciones`, `invitarMiembro`, `aceptarInvitacion`, `listarMiembros`, `cambiarRol`, `darDeBaja`, con las dependencias inyectadas para probar sin Supabase.
5. SQL en `pendiente.sql`, sin aplicar.
6. Selectores para FRONTEND (`usePermisos`, `miembroActual`) y contrato actualizado.
