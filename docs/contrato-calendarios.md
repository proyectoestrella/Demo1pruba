# Contrato de calendarios externos para FRONTEND

Lote 13. Lo implementa BACKEND en `src/lib/calendario-externo/`, `src/lib/api/calendario-externo.functions.ts`
y las rutas `src/routes/api.calendario-externo.*`. Aquí va lo que FRONTEND puede usar: tipos, funciones de
servidor, estados y qué enseñar en cada pantalla.

Todo esto vive detrás de un flag por salón (`profile.calendariosExternosActivo`, en el jsonb de `salons.profile`,
por defecto `false`/ausente). Mientras esté apagado, ninguna pantalla nueva debe aparecer.

## 1. Tipos

```ts
type ProveedorCalendario = "google" | "apple";

type EstadoConexion =
  | "activa"        // conectado y sincronizando
  | "error"         // conectado pero el último intento falló (ver `ultimoError`)
  | "desconectada";  // el usuario la desconectó, o nunca se conectó (no hay fila: null)

interface ConexionCalendario {
  id: string;
  proveedor: ProveedorCalendario;
  /** null = conexión de todo el salón (calendario compartido); si no, la profesional dueña. */
  employeeId: string | null;
  estado: EstadoConexion;
  /** Solo Google: la cuenta conectada, para pintarla ("noelia@gmail.com"). Apple no la trae. */
  cuenta: string | null;
  /** El nombre del calendario tal y como lo da el proveedor ("Noelia", "Trabajo", "Casa"). */
  calendarioNombre: string | null;
  /** Cuándo terminó con éxito la última sincronización (push o polling). null si aún no ha sincronizado nunca. */
  ultimaSincronizacion: string | null;
  ultimoError: string | null;
  ultimoErrorEn: string | null;
  /**
   * Los dos interruptores de v1, los dos por defecto `true` (conectar hace
   * las dos cosas salvo que se apague explícitamente una):
   */
  /** Si está apagado, lo ocupado en el externo NO cuenta al calcular huecos ni se importa. */
  bloquearHuecos: boolean;
  /** Si está apagado, las citas de siShow no se escriben en el calendario externo. */
  escribirCitas: boolean;
  creada: string;
  actualizada: string;
}

/** Un hueco ocupado por un calendario externo — lo que devuelve `listarOcupadoExterno`. Sin título ni detalle. */
interface OcupadoExterno {
  employeeId: string | null;
  inicio: string;
  fin: string;
  proveedor: ProveedorCalendario;
}
```

## 2. Funciones de servidor (`src/lib/api/calendario-externo.functions.ts`)

Todas llevan `.middleware([conSesion])` y exigen sesión de miembro del salón (nunca demo: una demo de venta
no tiene calendario real que conectar).

```ts
/** Lista las conexiones del salón (todas, para quien vea `ajustes.accesos`... en realidad para
 *  cualquiera que vea "Ajustes › Calendarios"; el recorte de qué botones se ven es de permisos, no de datos). */
listarConexionesCalendario({ slug }): Promise<ConexionCalendario[]>

/** Arranca el flujo OAuth de Google. Devuelve la URL a la que redirigir (no hace el redirect el propio
 *  servidor porque esto es una función invocada por fetch del panel, no una navegación). */
iniciarConexionGoogle({ slug, employeeId }: { slug: string; employeeId?: string | null }): Promise<{ url: string }>

/** Conecta Apple/iCloud. `appPassword` es la "contraseña de aplicación" de 16 caracteres
 *  (formato xxxx-xxxx-xxxx-xxxx) que Tomás/la estilista genera en appleid.apple.com — NUNCA su
 *  contraseña normal de Apple ID (no la aceptamos: ver docs/pruebas-calendario-para-tomas.md). */
conectarApple({ slug, employeeId, appleId, appPassword }: {
  slug: string; employeeId?: string | null; appleId: string; appPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }>

/** Desconecta una conexión (borra la fila y su credencial cifrada; no borra los eventos ya creados
 *  en el calendario externo, para no dejar al usuario sin lo que ya tenía apuntado). */
desconectarCalendario({ slug, conexionId }: { slug: string; conexionId: string }): Promise<{ ok: true }>

/** Cambia los dos interruptores de una conexión ya creada. Ninguno es obligatorio: manda solo el que cambia. */
ajustarConexionCalendario({ slug, conexionId, bloquearHuecos, escribirCitas }: {
  slug: string; conexionId: string; bloquearHuecos?: boolean; escribirCitas?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }>

/**
 * Lo ocupado por calendarios externos en una ventana de fechas — para pintarlo en la agenda/rejilla
 * igual que ya se pinta un bloqueo manual, pero SIN título ni detalle (nunca se manda el resumen del
 * evento externo a esta función; eso solo lo ve el servidor).
 * Mismo recorte por rol que las citas: sin `cita.ver-todas`, la respuesta viene ya filtrada a lo de
 * la estilista que llama (nunca hay que filtrar en el cliente por seguridad, solo por comodidad).
 */
listarOcupadoExterno({ slug, desde, hasta }: { slug: string; desde: string; hasta: string }): Promise<OcupadoExterno[]>
```

El callback de Google (`/api/calendario-externo/google/callback`) es una ruta normal (navegación del
navegador tras el consentimiento), no una función de servidor: FRONTEND no la llama directamente, solo
navega a la `url` que devuelve `iniciarConexionGoogle`. Al terminar, esa ruta redirige de vuelta a
`/app/settings?s=<slug>&calendario=ok` o `/app/settings?s=<slug>&calendario=error&motivo=...` (el `s=`
es el mismo parámetro que ya resuelve el salón en el resto de `/app`, ver `src/routes/app.tsx`) — la
pantalla lee esos parámetros para el aviso de éxito/error, no hace falta volver a pedir estado.

## 3. Permisos (añadidos a `src/lib/permisos.ts`, docs/contrato-accesos.md)

Nueva acción: `calendario-externo.gestionar`, alcance por rol:

| gerente | subencargado | recepción | estilista |
|---|---|---|---|
| todo | todo | — | **propio** |

Con alcance «propio», una estilista puede conectar/desconectar SU PROPIA conexión (`employeeId` igual al
suyo), pero no ve ni toca la de otra profesional ni la del salón entero (`employeeId: null`, gestión
exclusiva de gerente/subencargado). Recepción no ve nada de esto.

**Importante (actualizado 26/09, a petición vuestra): esta acción NO cuelga de la página `ajustes`.**
Una estilista no ve `ajustes` (`vePagina(p, "ajustes")` es `false` para ella, y eso no cambia), pero SÍ
tiene el permiso de la acción `calendario-externo.gestionar` sobre su propia conexión — son dos cosas
independientes en este módulo (página vs. acción), a propósito: la pantalla donde vive esto para la
estilista es la suya propia (§4), no Ajustes. No hace falta añadir nada a `PAGINAS` para esto.

## 4. Dónde vive cada pantalla

**Gerente/subencargado — Ajustes › Calendarios.** Una fila por conexión posible: "Calendario del salón"
(`employeeId: null`) y una fila por profesional. Aquí es donde se gestiona lo de CUALQUIER profesional
(no solo la propia).

Cada fila, si no hay conexión:

```
[icono Google] [icono Apple]   Conectar Google · Conectar Apple
```

Si hay conexión activa:

```
● Conectado a Google (noelia@gmail.com)          [Desconectar]
```

con `●` verde. En estado `error`:

```
● Google — hubo un problema (texto de ultimoError)   [Reconectar] [Desconectar]
```

con `●` ámbar/rojo. "Reconectar" es simplemente volver a lanzar `iniciarConexionGoogle` /
`conectarApple`: no hay una función distinta para reparar.

**Conectar Google**: botón que llama a `iniciarConexionGoogle` y navega (`window.location.href = url`)
a la URL devuelta. Nada de formulario propio: todo el consentimiento pasa por Google.

**Conectar Apple**: un formulario con dos campos — "Apple ID" (el email) y "Contraseña de aplicación"
(input tipo password, con una nota corta: *"No tu contraseña de Apple normal — genera una específica
para siShow en appleid.apple.com"* y un enlace a esa nota más larga en `docs/pruebas-calendario-para-tomas.md`
si hace falta, o donde vosotros lo mostréis). Al enviar, llama a `conectarApple`. Si devuelve
`{ok:false}`, enseña `error` tal cual (son mensajes ya pensados para la estilista, en español llano:
p. ej. "No hemos podido entrar con esos datos. Revisa el Apple ID y que la contraseña sea la de
aplicación, no la normal.").

**Los dos interruptores** (`bloquearHuecos`, `escribirCitas`), en cada fila con conexión, como dos
switches con etiqueta corta: *"Bloquear mis huecos con este calendario"* / *"Apuntar mis citas en este
calendario"*. Cambian con `ajustarConexionCalendario`; no hace falta guardar los dos a la vez, uno
solo también vale.

**Estilista — «Mi calendario», en su bloque de usuario (NO en Ajustes).** Mismo componente de fila que
arriba (conectar Google/Apple, estado, desconectar, los dos interruptores), pero limitado a SU PROPIA
conexión (`employeeId` = la suya): `listarConexionesCalendario` devuelve las de todo el salón, así que
aquí se filtra en pantalla a la suya antes de pintar (el servidor igualmente le rechazaría cualquier
acción sobre otra, pero no hace falta llegar a probarlo: mostrar solo lo suyo es más claro). Dónde
exactamente cuelga «Mi calendario» dentro de su bloque de usuario lo decide FRONTEND: no hemos asumido
un menú ni una ruta concreta.

## 5. Qué se ve cuando un hueco está ocupado por el calendario externo

**La reserva pública no necesita ningún cambio.** `syncAppointment` ya trata un hueco ocupado en un
calendario externo conectado (con `bloquearHuecos` activo) exactamente como un hueco ocupado por otra
cita de siShow: lo rechaza con el mismo motivo de siempre (`ERROR_HUECO_OCUPADO`, no hay uno nuevo). El
panel (`permitirSolape`) puede seguir solapando a propósito; eso no ha cambiado.

**El panel (calendario/agenda), si queréis pintarlo, sí es un cambio nuevo — opcional para v1:**
`listarOcupadoExterno({ slug, desde, hasta })` (§2) devuelve los huecos ocupados por lo externo en esa
ventana, SIN título ni detalle (solo `employeeId`, `inicio`, `fin`, `proveedor`), recortado por rol
exactamente igual que las citas (una estilista sin `cita.ver-todas` solo recibe lo suyo). Con eso podéis
pintar una franja gris en `RejillaCalendario`/`CalendarioArena` igual que un hueco ya ocupado, con un
texto genérico tipo "Ocupado (Google)" en vez del nombre de la clienta — nunca se manda el resumen real
del evento externo a esta función, así que no hay nada más que enseñar aunque quisierais.

## 6. Textos de error de `conectarApple` (los exactos que devuelve el servidor)

- `"No hemos podido entrar con esos datos. Revisa el Apple ID y que la contraseña sea la de aplicación, no la normal."`
  (credenciales rechazadas por iCloud, HTTP 401/403)
- `"No hemos encontrado un calendario en esa cuenta de iCloud."` (discovery sin calendarios)
- `"iCloud no ha respondido. Inténtalo de nuevo en un momento."` (fallo de red o 5xx)

## 7. Por qué no usamos la librería `tsdav`

Se evaluó y se descarta para v1: envuelve sus propias llamadas HTTP con una capa que dificulta
inyectar un servidor simulado en los tests (la convención de este repo — ver `email.server.ts`,
`proveedorDeCorreo(fetchImpl)` — es poder pasar un `fetch` inyectado). Un cliente CalDAV propio de
~200 líneas sobre `fetch` (PROPFIND/REPORT con XML mínimo, PUT/DELETE con ETag) es más fácil de
probar con fixtures XML controladas y no añade una dependencia con su propio ciclo de vida de
actualizaciones. Si en el futuro hace falta soporte de más proveedores CalDAV con más particularidades,
se puede reconsiderar.

## 8. Variables de entorno nuevas (solo los NOMBRES; los valores los pone Tomás, nunca en el repo)

- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`
- `CALENDARIO_CLAVE_CIFRADO` (32 bytes en base64 — clave AES-256-GCM para cifrar credenciales en reposo)
- `CRON_SECRET` (ya existía para recordatorios; se reutiliza para el polling de calendarios)
- `APPLE_CALDAV_BASE_URL` (opcional; por defecto `https://caldav.icloud.com`, solo para tests/otros CalDAV)

Checklist completo para que Tomás las genere: `docs/pruebas-calendario-para-tomas.md`.
