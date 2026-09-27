# Prueba real de Google Calendar y del recordatorio por correo — 27-sep-2026

> Para quien haga hoy la prueba con cuentas de verdad. Complementa
> `docs/pruebas-calendario-para-tomas.md` (el paso a paso de Google Cloud) y
> `docs/contrato-calendarios.md` (el diseño). Salón de pruebas: `pruebas-sishow`.

## 0. Antes de nada: qué tiene que estar desplegado

Todo lo de este documento marcado **(lote 17)** está en la rama
`codex/peluchic-backend` y **no** en producción (`main` = `c3390f8`) hasta que
se fusione y se despliegue:

- `SITE_URL` para el aviso push de Google (17.4).
- `?salon=`, `?cita=` y `?dry=1` en `/api/recordatorios` (17.5).
- Confirmar, mover, cancelar o eliminar una cita desde el panel llega a
  Google (17.6). Sin esto, en producción solo llega la cita **nueva**: lo que
  se le haga después se queda en siShow.

> ⚠️ **No llames a `/api/recordatorios?salon=…` ni `?dry=1` contra un
> despliegue sin el lote 17.** El código viejo ignora esos parámetros y
> **envía de verdad los recordatorios de mañana de TODOS los salones
> reales.** Comprobación rápida de que el despliegue ya lo tiene:
> `…/api/recordatorios?dry=0` con el token debe responder **400**
> («parámetro dry no válido»); si responde 200, no lo tiene.

## 1. Google Cloud: callback y scopes

**Ruta del callback (exacta):** `/api/calendario-externo/google/callback`

URIs de redireccionamiento autorizadas que hay que dar de alta en el cliente
OAuth (tipo «Aplicación web»), sin barra final:

| Dominio | URI |
|---|---|
| Web oficial | `https://sishow.es/api/calendario-externo/google/callback` |
| Producción actual | `https://prueba28juliokt.vercel.app/api/calendario-externo/google/callback` |
| Local (opcional) | `http://localhost:8083/api/calendario-externo/google/callback` |

Se pueden registrar las tres a la vez; la que se usa la decide
`GOOGLE_CALENDAR_REDIRECT_URI` (una sola). **No** hace falta registrar los
subdominios de salón (`peluchic.sishow.es`): el panel se usa desde el dominio
de la redirect URI.

**Scopes** (`src/lib/calendario-externo/google-oauth.ts`, `SCOPES_GOOGLE`), los
tres, con `access_type=offline` y `prompt=consent`:

1. `https://www.googleapis.com/auth/calendar.events` (sensible)
2. `https://www.googleapis.com/auth/calendar.freebusy`
3. `https://www.googleapis.com/auth/userinfo.email`

API que hay que habilitar en el proyecto: **Google Calendar API**. Si la app
está en modo «Prueba», las cuentas que conecten tienen que estar en
«Usuarios de prueba».

**La URL de vuelta.** El callback responde `302` con
`Location: /app/settings?s=<slug>&calendario=ok` (o `calendario=error&motivo=…`),
**relativa**: el navegador vuelve al mismo dominio del callback. Comprobado:

- Tests (`src/lib/api/google-callback.test.ts`): desde `https://sishow.es/…`
  vuelve a `https://sishow.es/app/settings…` y desde
  `https://prueba28juliokt.vercel.app/…` a
  `https://prueba28juliokt.vercel.app/app/settings…`; y la URL de
  autorización lleva la `redirect_uri` exacta y los tres scopes.
- En producción hoy: `GET https://prueba28juliokt.vercel.app/api/calendario-externo/google/callback`
  (sin parámetros) → `302` a
  `https://prueba28juliokt.vercel.app/app/settings?calendario=error&motivo=Falta+código+o+estado…`.

Como la sesión del panel vive por dominio, **empieza la conexión desde el panel
del mismo dominio que `GOOGLE_CALENDAR_REDIRECT_URI`**. Si empiezas en
vercel.app y la redirect URI es sishow.es, la conexión se guarda igual (el
`state` firmado lleva salón, profesional y usuario), pero vuelves a un
sishow.es donde quizá no has iniciado sesión.

## 2. Variables de entorno (solo nombres)

En Vercel, proyecto `prueba28juliokt`, entorno **Production**. Estado leído por
la API de Vercel el 27-sep (solo nombres, sin valores):

| Variable | Para qué | Hoy |
|---|---|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | Cliente OAuth | **falta** |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Cliente OAuth | **falta** |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Una de las URIs del §1, exacta | **falta** |
| `CALENDARIO_CLAVE_CIFRADO` | Cifra los tokens guardados y firma el `state` | está (Production y Preview) |
| `CRON_SECRET` | Candado de `/api/recordatorios` y `/api/calendario-externo/cron` | está (sensible: Vercel no deja leerla) |
| `SITE_URL` **(lote 17)** | Dirección pública del aviso push: `https://sishow.es`, o `https://prueba28juliokt.vercel.app` mientras sishow.es no resuelva | **falta** |
| `RESEND_API_KEY` | Envío del recordatorio | **falta** |
| `REMINDER_FROM_EMAIL` | Remitente: `siShow <recordatorios@sishow.es>` (sin comillas alrededor) | **falta** |
| `APPLE_CALDAV_BASE_URL` | Opcional, solo Apple | — |

Notas:

- **Tras cambiar variables hay que redesplegar**; no se aplican al despliegue
  que ya está sirviendo.
- `CRON_SECRET` está marcada como sensible: nadie puede leer su valor. Si quien
  prueba no lo tiene, se pone uno nuevo en Vercel (y se guarda en
  `~/.config/sishow/credenciales.env`) y se redespliega; el cron de Vercel usa
  la misma variable, así que cambiarla no rompe nada.
- **Por qué `SITE_URL`.** Antes la dirección del aviso se construía con
  `VERCEL_URL`, la URL única de cada despliegue, que está detrás de la
  protección SSO de Vercel (`ssoProtection: all_except_custom_domains`):
  Google recibía un 302 al login. Ahora el orden es `SITE_URL` →
  `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL`
  (`src/lib/config.server.ts`, `urlPublicaDelSitio`). El alias
  `prueba28juliokt.vercel.app` no está protegido (responde 200) y sirve de
  `SITE_URL` provisional. Un canal ya creado conserva su dirección hasta que se
  renueva (cuando le quedan menos de 6 h); para estrenar la nueva, desconecta y
  vuelve a conectar.
- `REMINDER_FROM_EMAIL` se pasa tal cual a Resend (`from`). Acepta
  `siShow <recordatorios@sishow.es>`; si al pegarlo se cuelan comillas
  envolviendo todo el valor, se quitan (`remitenteDeCorreo`, con test).
  Resend exige el dominio `sishow.es` **verificado** en su panel (registros
  TXT de DKIM y MX/TXT en `send.sishow.es`, que se ponen en IONOS); sin eso,
  cada envío sale en `fallidos` con el error de Resend.

## 3. Activar el flag del salón

Los calendarios externos van detrás de `profile.calendariosExternosActivo`
(jsonb de `salons`), apagado por defecto: sin él, el panel no enseña la
sección y el servidor rechaza conectar.

En el SQL Editor de Supabase:

```sql
update salons
set profile = jsonb_set(profile, '{calendariosExternosActivo}', 'true'::jsonb, true),
    updated_at = now()
where slug = 'pruebas-sishow';

select slug, profile->'calendariosExternosActivo' as flag
from salons where slug = 'pruebas-sishow';   -- debe salir true
```

Alternativa sin SQL (una gerente del salón, desde el panel):
`patchSalonProfile({ data: { slug: "pruebas-sishow", patch: { calendariosExternosActivo: true } } })`
— el servidor fusiona el parche con el perfil guardado. Después, **recarga el
panel**. Para apagarlo: el mismo `jsonb_set` con `'false'::jsonb`.

Ojo: «restaurar una versión» de Mi página sustituye el perfil entero; si la
versión es anterior al flag, lo apaga.

## 4. Conectar el Google de una profesional

1. Entra en el panel del salón (`/app?s=pruebas-sishow`) desde el mismo dominio
   que la redirect URI, como **gerente o subencargada** (pueden conectar el de
   cualquiera) o como la **estilista** vinculada (solo el suyo). Recepción no
   puede.
2. **Ajustes › Calendarios**: cada profesional tiene su fila con
   «Conectar Google» y «Conectar Apple (iPhone)».
3. «Conectar Google» → consentimiento de Google (si la app está publicada sin
   verificar: «Avanzado» → «Ir a siShow»). Acepta los permisos.
4. Vuelves a `/app/settings?s=pruebas-sishow&calendario=ok` con el aviso de
   éxito y la cuenta visible en la fila.
5. Comprobación en base de datos:

   ```sql
   select id, employee_id, proveedor, estado, cuenta,
          canal_watch_id is not null as con_aviso, canal_caduca,
          ultima_sincronizacion, ultimo_error
   from calendario_conexiones where salon_slug = 'pruebas-sishow';
   ```

   `estado = 'activa'`. `con_aviso = true` si `SITE_URL` (o el dominio de
   producción) estaba puesto y Google aceptó el canal; si es `false`, funciona
   igual pero lo entrante llega por el cron o al abrir el panel.

Si Google dice que no ha dado «permiso permanente» (sin `refresh_token`): quita
el acceso de siShow en <https://myaccount.google.com/permissions> y repite.

## 5. Provocar la sincronización a mano

**siShow → Google (saliente), inmediato.** Crear una cita de esa profesional
en el panel o reservar desde la web pública (`syncAppointment`), y confirmarla,
moverla, cambiarla de profesional, cancelarla o eliminarla desde el panel
(`syncAppointmentPatch` / `deleteAppointment`, lote 17.6): todos llaman a
`procesarCitaParaConexiones` antes de responder. Cancelar o eliminar borra el
evento. Marcar cobros o señal no toca Google.

**Google → siShow (entrante).** Tres vías:

- Aviso push: al cambiar algo en ese Google Calendar, Google llama a
  `POST <SITE_URL>/api/calendario-externo/google/webhook` y se sincroniza esa
  conexión.
- Abrir el panel: `sincronizarCalendarios` pone al día las conexiones del salón
  con 5 minutos o más sin sincronizar.
- El cron, a mano (todas las conexiones activas de todos los salones; hoy solo
  hay las de prueba):

  ```bash
  set -a; source ~/.config/sishow/credenciales.env; set +a   # CRON_SECRET
  curl -s -H "Authorization: Bearer $CRON_SECRET" \
    https://prueba28juliokt.vercel.app/api/calendario-externo/cron
  # → {"procesadas":N,"errores":0}
  ```

  (Con `?token=$CRON_SECRET` en vez de la cabecera también vale.)

Resultado esperado: un evento puesto a mano en Google (p. ej. «Médico») bloquea
ese hueco en la reserva pública de ese salón y profesional; siShow guarda solo
el intervalo, nunca el título.

## 6. Provocar el recordatorio por correo (lote 17)

El recordatorio sale para las citas **de mañana** (hora de Madrid),
**confirmadas**, cuya clienta tiene **correo**, y sin `reminder_sent_at`. Los
filtros nuevos solo estrechan; no saltan ninguna de esas condiciones.

| Parámetro | Efecto |
|---|---|
| `?salon=<slug>` | Solo las citas de ese salón |
| `?cita=<id>` | Solo esa cita (`appointments.id`, el uuid; no el `local_id`) |
| `?dry=1` | No envía ni marca: devuelve `simulacion` con id, salón, hora y correo enmascarado |
| (nada) | Lo de siempre: todos los salones (es lo que llama el cron a las 17:00 UTC) |

Un valor mal formado responde **400**; sin token, **401**.

1. En `pruebas-sishow`, crea y **confirma** una cita para mañana (lunes
   28-sep) de una clienta con correo en su ficha (usa el tuyo).
2. Simula:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     "https://prueba28juliokt.vercel.app/api/recordatorios?salon=pruebas-sishow&dry=1"
   # → {"proveedor":"resend","candidatas":1,...,"simulacion":[{"id":"<uuid>","salon":"pruebas-sishow","inicio":"…","para":"t***@…"}]}
   ```

3. Envía solo esa:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     "https://prueba28juliokt.vercel.app/api/recordatorios?salon=pruebas-sishow&cita=<uuid>"
   # → {"proveedor":"resend","candidatas":1,"enviados":1,"fallidos":[]}
   ```

4. Para repetir la prueba con la misma cita:

   ```sql
   update appointments set reminder_sent_at = null
   where id = '<uuid>' and salon_slug = 'pruebas-sishow';
   ```

Respuestas que no son error del código: `"motivo":"sin-proveedor"` (faltan
`RESEND_API_KEY` o `REMINDER_FROM_EMAIL`), `candidatas: 0` (la cita no es de
mañana, no está confirmada, la clienta no tiene correo o ya se recordó), y un
`fallidos` con `Resend 403` (dominio sin verificar en Resend).
