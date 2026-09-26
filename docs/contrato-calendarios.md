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
  ultimoError: string | null;
  ultimoErrorEn: string | null;
  creada: string;
  actualizada: string;
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
```

El callback de Google (`/api/calendario-externo/google/callback`) es una ruta normal (navegación del
navegador tras el consentimiento), no una función de servidor: FRONTEND no la llama directamente, solo
navega a la `url` que devuelve `iniciarConexionGoogle`. Al terminar, esa ruta redirige de vuelta a
`/app/settings?calendario=ok` o `/app/settings?calendario=error&motivo=...` — la pantalla lee esos
parámetros para el aviso de éxito/error, no hace falta volver a pedir estado.

## 3. Permisos (añadidos a `src/lib/permisos.ts`, docs/contrato-accesos.md)

Nueva acción: `calendario-externo.gestionar`, alcance por rol:

| gerente | subencargado | recepción | estilista |
|---|---|---|---|
| todo | todo | — | **propio** |

Con alcance «propio», una estilista puede conectar/desconectar SU PROPIA conexión (`employeeId` igual al
suyo), pero no ve ni toca la de otra profesional ni la del salón entero (`employeeId: null`, gestión
exclusiva de gerente/subencargado). Recepción no ve la pantalla.

Página: se cuelga de `ajustes` (no hace falta una `PaginaId` nueva; es una sección dentro de Ajustes,
igual que ya se hace con otras). Si FRONTEND prefiere una página propia, decidlo y avisad — no la hemos
añadido a `PAGINAS` para no adelantarnos a vuestro diseño de navegación.

## 4. Pantalla: Ajustes › Calendarios

Una fila por conexión posible: hoy son dos casos por salón — "Calendario del salón" (`employeeId: null`,
solo gerente/subencargado) y, si el salón tiene profesionales, una fila por profesional visible para
quien tenga `calendario-externo.gestionar` sobre ella.

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

## 5. Qué se ve cuando un hueco está ocupado por el calendario externo

La reserva pública (`syncAppointment` / la pantalla de reserva) ya trata un hueco ocupado en un
calendario externo conectado exactamente como un hueco ocupado por otra cita de siShow: la reserva
pública lo rechaza (motivo `ERROR_HUECO_OCUPADO`, el mismo código de siempre — no hay uno nuevo).
El panel (`permitirSolape`) puede seguir solapando a propósito si el salón decide meter una cita ahí
igualmente; eso no ha cambiado y tampoco distingue el motivo del solape.

Es decir: **FRONTEND no necesita ningún cambio** para esto. Se enumera aquí solo para que quede
documentado que el criterio de "ocupado" ahora incluye lo externo, por si alguna pantalla vuestra
enseña el motivo de un hueco rechazado.

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
