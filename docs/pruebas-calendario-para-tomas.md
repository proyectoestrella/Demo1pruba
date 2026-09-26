# Calendarios externos — lo que necesito que hagas tú, Tomás

Esto lo puedo hacer todo yo salvo tres cosas que exigen tu cuenta de Google y tu cuenta de Apple: nadie
más puede crear el proyecto de Google Cloud en tu nombre ni generar una contraseña de aplicación de tu
iCloud. Va en tres partes: (1) Google, (2) Apple, (3) qué probamos juntos después.

Aviso honesto: lo de Google Cloud Console cambia de sitio y de nombre de botón cada pocos meses. Te
digo dónde busqué yo la última vez que lo miré, pero si un nombre exacto no coincide, es casi seguro que
Google ha movido el menú, no que te hayas equivocado — busca por el concepto ("credenciales", "pantalla
de consentimiento") y encontrarás el sitio.

## 1. Google Cloud — 15-20 minutos

### 1.1. Crear el proyecto

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) con la cuenta de Google de
   siShow (no tu cuenta personal, salvo que sean la misma).
2. Arriba a la izquierda, junto al logo de "Google Cloud", hay un selector de proyecto. Pulsa
   "Proyecto nuevo" (o "New Project").
3. Nombre: algo reconocible, por ejemplo `siShow` o `siShow Calendarios`. No hace falta organización.
4. Espera a que lo cree (unos segundos) y selecciónalo en el mismo desplegable de arriba.

### 1.2. Habilitar la API de Calendar

1. Menú de la izquierda (el icono de las tres rayas) → "APIs y servicios" → "Biblioteca" (o busca
   arriba "Google Calendar API").
2. Busca **"Google Calendar API"** y entra en su ficha.
3. Pulsa **"Habilitar"** (Enable). Tarda unos segundos.

### 1.3. Pantalla de consentimiento OAuth

1. "APIs y servicios" → **"Pantalla de consentimiento de OAuth"** (OAuth consent screen).
2. Tipo de usuario: **"Externo"** (External) — no tenemos Google Workspace, así que "Interno" no
   aparecerá o no sirve.
3. Rellena lo mínimo obligatorio: nombre de la app ("siShow"), correo de soporte (el tuyo o el de
   siShow), correo de contacto del desarrollador (el mismo).
4. **Ámbitos (Scopes)**: añade estos dos, buscándolos por su nombre:
   - `.../auth/calendar.events` — "Ver, editar, compartir y borrar permanentemente todos los eventos
     de calendario a los que puedas acceder mediante Calendar" — este es un **ámbito sensible**, Google
     lo marcará como tal.
   - `.../auth/userinfo.email` — tu dirección de correo electrónico principal de Google (no sensible).

   (Opcional, no imprescindible para v1: `.../auth/calendar.freebusy` — el código lo pide pero no lo usa
   en el flujo por defecto; puedes añadirlo o dejarlo, no cambia nada si falta.)
5. **Usuarios de prueba**: mientras la app esté en modo "Prueba" (Testing), aquí es donde añades los
   correos de Google que vayan a probar la conexión (el tuyo, el de cada estilista que pruebe). Sin
   esto, esas cuentas verán un error al intentar entrar.
6. Guarda.

### 1.4. Publicarla "En producción" SIN verificar

Esto es la parte rara pero es lo que toca para arrancar sin esperar la revisión de Google (que puede
tardar semanas y pide vídeo de demostración, política de privacidad pública, etc.):

1. En la misma pantalla de consentimiento, busca el botón **"Publicar app"** (Publish app) y pulsa.
   Te preguntará si quieres pasar de "Prueba" (Testing) a "En producción" (In production). Confirma.
2. Con un ámbito sensible (`calendar.events`) y la app sin verificar, Google **no bloquea el uso**,
   pero cada persona que se conecte verá una pantalla de aviso tipo *"Google no ha verificado esta
   app"* con un enlace pequeño **"Avanzado"** → **"Ir a siShow (no seguro)"** para poder continuar. Es
   normal, no es un error nuestro ni tuyo: pasa con cualquier app en este estado. Cuéntaselo a quien
   vaya a conectar su calendario para que no se asuste.
3. **Límite de 100 usuarios**: mientras no esté verificada, como mucho 100 cuentas de Google distintas
   pueden dar su consentimiento a esta app en total. Para el número de salones y estilistas que vamos a
   tener al principio sobra de largo. Si algún día nos acercamos a ese número, se pide la verificación
   de Google (ahí sí hace falta vídeo, política de privacidad, y puede tardar).

### 1.5. Crear las credenciales (el "OAuth client")

1. "APIs y servicios" → **"Credenciales"** (Credentials).
2. **"+ Crear credenciales"** → **"ID de cliente de OAuth"** (OAuth client ID).
3. Tipo de aplicación: **"Aplicación web"** (Web application).
4. Nombre: "siShow producción" (o el que quieras, es solo una etiqueta para ti).
5. **"URIs de redireccionamiento autorizados"** (Authorized redirect URIs) — aquí van EXACTAMENTE
   (sin barra final, con `https://` en producción):
   - Producción: `https://<tu-dominio-de-producción>/api/calendario-externo/google/callback`
   - Local (para que yo pueda probarlo en mi máquina antes de desplegar):
     `http://localhost:3000/api/calendario-externo/google/callback`
     (si tu `vite dev` usa otro puerto, dímelo y lo cambiamos — o añade tú esa segunda URI con el
     puerto que uses)
6. Pulsa **"Crear"**. Te enseña un **Client ID** y un **Client Secret**. Cópialos ahora — el secreto
   no se vuelve a enseñar entero después (aunque siempre puedes generar uno nuevo desde la misma
   pantalla si lo pierdes).

### 1.6. Pasarme las credenciales

**Nunca me las pegues en el chat ni las subas a ningún fichero del repositorio.** Ponlas tú mismo:

En tu máquina, en `~/.config/sishow/credenciales.env` (el mismo fichero que ya usa el proyecto para
otras claves), añade estas tres líneas con los nombres EXACTOS:

```
GOOGLE_CALENDAR_CLIENT_ID=<el Client ID que te ha dado Google>
GOOGLE_CALENDAR_CLIENT_SECRET=<el Client Secret>
GOOGLE_CALENDAR_REDIRECT_URI=https://<tu-dominio-de-producción>/api/calendario-externo/google/callback
```

Y en Vercel (Project Settings → Environment Variables), las mismas tres, con el mismo valor, en
**Production** (y si quieres probar el flujo completo en un preview de Vercel, también ahí — pero
entonces la redirect URI de ese preview tendría que estar TAMBIÉN dada de alta en el paso 1.5, porque
Google solo redirige a URIs exactas que conozca; si no, dímelo y lo resolvemos cuando llegue el caso).

Además, genera y añade esta (no la genero yo por ti a propósito: que la tengas tú desde el principio):

```
CALENDARIO_CLAVE_CIFRADO=<32 bytes al azar, en base64>
```

Se genera así en una terminal:

```
openssl rand -base64 32
```

Es la clave con la que se cifran en la base de datos el refresh token de Google y la contraseña de
aplicación de Apple de cada conexión. Sin ella no se puede ni cifrar ni descifrar nada — trátala como
una contraseña maestra. Ponla también en Vercel (Production), igual que las de Google.

Por último, el polling de calendarios reutiliza `CRON_SECRET`, la misma variable del recordatorio. Si todavía no la tienes puesta, genera un valor al azar igual que arriba y ponlo como `CRON_SECRET`.

**El plan de Vercel.** El proyecto está en el plan gratuito (Hobby), que solo permite crons diarios. Un despliegue con un cron más frecuente falla. Por eso `vercel.json` lleva el cron de calendarios **una vez al día** (`30 5 * * *`, hora UTC). El efecto es este:
- **Google:** va en tiempo real por su webhook (`watch`); el cron diario solo es el respaldo.
- **Apple:** iCloud no tiene webhook, así que se sincroniza al abrir el panel (`sincronizarCalendarios`, como mucho cada 5 minutos por conexión) y, como mínimo, una vez al día. Para bajarlo a 5 minutos hace falta el plan Pro, con `*/5 * * * *` en `vercel.json`. Esa decisión es tuya.

## 2. Apple / iCloud — 5 minutos

Solo hace falta para probar la conexión de Apple. Cualquier cuenta de iCloud vale para probar (la tuya,
o una de pruebas si tienes una).

1. Entra en [appleid.apple.com](https://appleid.apple.com) e inicia sesión con el Apple ID que quieras
   usar para la prueba.
2. Busca la sección **"Accesos y seguridad"** (Sign-In and Security).
3. Busca **"Contraseñas específicas de apps"** (App-Specific Passwords) — a veces aparece como
   "Contraseñas de aplicación".
4. Pulsa **"Generar contraseña específica de app"** (Generate an app-specific password).
5. Ponle un nombre que la identifique, por ejemplo "siShow calendario".
6. Apple te enseña una contraseña con forma `xxxx-xxxx-xxxx-xxxx` (16 letras en 4 grupos separados por
   guiones). Cópiala — tampoco se vuelve a enseñar entera después; si la pierdes, generas otra.

**Importante para cuando prueben las estilistas**: esta contraseña específica de aplicación es
DISTINTA de la contraseña normal de su Apple ID. Si en el formulario de siShow meten su contraseña
normal, el servidor la rechaza con un mensaje que ya lo dice ("revisa que la contraseña sea la de
aplicación, no la normal") — no hace falta que se lo expliques tú antes, pero ayuda saberlo si alguien
se queda atascada.

No hace falta pasarme esta contraseña por ningún sitio: se prueba directamente en el formulario de
"Conectar Apple" del panel de siShow, y viaja cifrada desde ahí.

## 3. Qué probamos juntos después

Con las tres variables de Google puestas (y la clave de cifrado), y una contraseña de aplicación de
Apple a mano:

1. **Conectar Google desde un salón de prueba**: pulsar "Conectar Google" en Ajustes › Calendarios,
   pasar por la pantalla de "app no verificada" (avisada arriba), conceder permiso, y comprobar que
   vuelve al panel con el aviso de éxito y la cuenta conectada visible.
2. **Crear una cita en siShow y verla aparecer en Google Calendar** en menos de un minuto o dos (el
   canal de aviso instantáneo — si por lo que sea no aparece al momento, aparecerá en menos de 5
   minutos por el sondeo de respaldo).
3. **Mover o cancelar esa cita en siShow** y comprobar que se mueve o desaparece en Google también.
4. **Meter un evento directamente en Google Calendar** (una cita del médico, por ejemplo) y comprobar
   que en unos minutos ese hueco aparece bloqueado en la reserva pública de siShow.
5. **Conectar Apple** con la contraseña de aplicación, y repetir los pasos 2-4 con iCloud (el paso 4
   tarda hasta 5 minutos siempre, porque Apple no tiene aviso instantáneo).
6. **Desconectar** una de las dos y comprobar que deja de sincronizar, sin que las citas que ya estaban
   en el calendario externo desaparezcan solas.
7. **Los dos interruptores** (bloquear huecos / apuntar citas): apagar uno y comprobar que dicho efecto
   pasa exactamente lo que se ha documentado (deja de bloquear huecos, o deja de escribir citas nuevas).

Todo esto lo pruebo yo primero en local con servidores simulados (ya está hecho, son los tests
automáticos); esta lista es la comprobación con Google y Apple de verdad, que solo se puede hacer una
vez estén las credenciales puestas.
