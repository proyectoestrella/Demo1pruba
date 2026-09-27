# Dominios de siShow: `sishow.es` y un subdominio por salón

> Lote 17 · 27-sep-2026. Código: `src/lib/host.ts`, `src/router.tsx`, `src/start.ts`.

| URL | Qué sirve |
|---|---|
| `https://sishow.es/…` | La web oficial y todo lo demás, exactamente igual que en `prueba28juliokt.vercel.app` |
| `https://www.sishow.es/…` | Redirección **308** a `https://sishow.es/…` (misma ruta y búsqueda) |
| `https://peluchic.sishow.es/` | La web de reservas de PeluChic (lo mismo que `/s/peluchic`) |
| `https://peluchic.sishow.es/book`, `/confirmation`, `/dosier`, `/privacidad` | Las subpáginas del salón (`/s/peluchic/book`…) |
| `https://peluchic.sishow.es/s/peluchic/book?d=…` | **307** a `/book?d=…` (los enlaces viejos siguen valiendo) |
| `https://peluchic.sishow.es/app`, `/login`, `/api/…`, `/aceptar`, `/_serverFn/…` | Lo mismo que en cualquier otro dominio: no se reescriben |
| `prueba28juliokt.vercel.app`, `localhost`, IPs | Sin ningún cambio |

## 1. Cómo funciona el enrutado por dominio

### Qué es cada host — `resolverHost(hostname)`

`src/lib/host.ts` devuelve `{ tipo: "oficial" }`, `{ tipo: "salon", slug }` u
`{ tipo: "otro" }`:

- `sishow.es` y `www.sishow.es` → oficial.
- `<slug>.sishow.es` → salón, si `<slug>` es una etiqueta DNS válida
  (`a-z`, `0-9`, guiones, sin guion en los bordes, hasta 63 caracteres) y no
  está en `SUBDOMINIOS_RESERVADOS` (`www`, `app`, `api`, `admin`, `demo`,
  `mail`, `correo`, `blog`, `send`, `status`…). Dos niveles
  (`a.peluchic.sishow.es`) → otro.
- Mayúsculas, puerto y punto final se ignoran (`PeluChic.SiShow.es:443` = `peluchic.sishow.es`).
- En local, `localhost` hace de raíz: `peluchic.localhost:8083` → salón.
- Cualquier otro host (vercel.app, IPs, dominios ajenos) → otro.

**Dominio raíz configurable** con `VITE_SISHOW_DOMINIO` (por defecto
`sishow.es`). Lleva el prefijo `VITE_` a propósito: el mismo código decide en
el servidor (SSR) y en el navegador (hidratación), y Vite sustituye esa
variable en los dos paquetes al compilar. Con una variable solo de servidor
(`SISHOW_DOMINIO`) el servidor podría reescribir y el navegador no, y la
página se rompería al hidratar. No hace falta definirla en Vercel.

### Opción elegida: reescritura de URL del router (`rewrite`)

TanStack Router 1.168 (`@tanstack/router-core/src/rewrite.ts` y
`router.ts`) admite `rewrite: { input, output }` en `createRouter`:

- `input` traduce la URL pública a la interna **antes** de buscar la ruta. Se
  aplica al parsear cada ubicación, en el servidor (historial en memoria con
  el `origin` de la petición) y en el navegador (`window.origin`), y también
  en `handleServerRoutes` de TanStack Start para las rutas de servidor.
- `output` traduce la interna a la pública al construir **cualquier** enlace
  (`<Link>`, `navigate`, `redirect()` de servidor, redirecciones de server
  functions: todas pasan por `buildLocation` → `publicHref`).

En `peluchic.sishow.es`:

- Entrada: `/` → `/s/peluchic`; `/book` → `/s/peluchic/book` (lo mismo para
  `confirmation`, `dosier` y `privacidad`).
- Salida: `/s/peluchic` → `/`; `/s/peluchic/book?d=…` → `/book?d=…`.
- `?d=`, `&service=…` y el ancla pasan intactos (solo se toca `pathname`).
- Es una **lista blanca** (`SUBRUTAS_SALON`): solo la portada y esas cuatro
  subrutas se reescriben. `/app`, `/api`, `/aceptar`, `/demo`, `/assets`,
  `/_serverFn`, `/login`, `/dashboard`, `/rutero`, `/manifest.webmanifest`…
  nunca. `host.test.ts` comprueba que la lista coincide con los ficheros
  `src/routes/s.$salonSlug.<subruta>.tsx` y que ninguna choca con una ruta de
  primer nivel. Si alguien añade una subruta y no la apunta, no se rompe
  nada: sus enlaces salen como `/s/peluchic/<subruta>`, que también funciona
  en el subdominio.
- `/s/<slug>/…` no se reescribe al entrar, así que los enlaces antiguos
  siguen funcionando; y como la comprobación canónica de TanStack Router en
  el servidor compara la URL pedida con la que construiría, responde **307**
  a la forma corta (`/s/peluchic/book?d=…` → `/book?d=…`).

**El `rewrite` solo se instala en el subdominio de un salón**
(`src/router.tsx`: `createIsomorphicFn` lee el host de la petición en el
servidor con `getRequest()` y `window.location.hostname` en el navegador). Con
`rewrite` definido, TanStack Router cambia de camino al parsear ubicaciones
(el «fast path» se desactiva y compara la URL cruda con la re-serializada); en
`sishow.es`, `vercel.app` y `localhost` el router se crea sin `rewrite` y se
comporta bit a bit como antes.

### Por qué esta opción y no la redirección

La alternativa era redirigir `/` → `/s/<slug>` (307) en el subdominio. Es más
sencilla pero deja `peluchic.sishow.es/s/peluchic/book` en la barra, que es
justo lo que se quiere evitar. La reescritura del router:

1. está soportada y documentada en esta versión (es la misma maquinaria que
   usa `basepath`);
2. se aplica en SSR, en cliente y en redirecciones, así que los enlaces son
   coherentes sin tocar ni una línea de la landing;
3. se ha comprobado de extremo a extremo (ver §3), y
4. cuando no es un subdominio de salón, no existe: el riesgo sobre
   producción es nulo.

### `www` → raíz

`src/start.ts` añade `wwwMiddleware` a los `requestMiddleware` de TanStack
Start: si el host es `www.sishow.es`, responde **308** a
`https://sishow.es` + la misma ruta y búsqueda. Solo el dominio de
producción (`www.localhost` o un `vercel.app` no se tocan). Si en Vercel se
configura además «Redirect to sishow.es» al añadir `www.sishow.es`, Vercel lo
hace antes de llegar a la función; las dos cosas juntas no chocan.

## 2. Registros DNS (IONOS) y dominios en Vercel

El DNS de `sishow.es` está en IONOS. Registros:

| Nombre | Tipo | Valor | Para |
|---|---|---|---|
| `@` (raíz) | A | `76.76.21.21` | `sishow.es` |
| `www` | CNAME | `cname.vercel-dns.com.` | `www.sishow.es` (Vercel y el código lo redirigen a la raíz) |
| `*` | CNAME | `cname.vercel-dns.com.` | que cualquier `<slug>.sishow.es` resuelva a Vercel |

- Vercel también acepta el CNAME propio del proyecto que recomienda su API
  (`GET /v6/domains/<dominio>/config`, `recommendedCNAME` de rango 1; el
  27-sep era `89473fbe2128fab6.vercel-dns-017.com.`). Los dos funcionan;
  `scripts/alta-subdominio.ts` lo enseña.
- No borrar los registros MX/TXT de correo que ya tenga IONOS. Si se usa
  Resend para el recordatorio, sus registros (DKIM en `resend._domainkey`,
  MX y SPF en `send`) conviven con estos; por eso `send` está en
  `SUBDOMINIOS_RESERVADOS`.

**El comodín DNS no basta para Vercel.** Que `*.sishow.es` resuelva no hace
que Vercel sirva ese host: cada dominio tiene que estar **añadido al
proyecto** para que Vercel lo enrute y emita su certificado. Un dominio
comodín `*.sishow.es` en Vercel exige, según su documentación, usar los
nameservers de Vercel o delegar `_acme-challenge` (registros NS
`_acme-challenge` → `ns1.vercel-dns.com.` y `ns2.vercel-dns.com.` en IONOS)
para que pueda emitir el certificado comodín por DNS-01. Mientras no se haga
eso, se da de alta **cada salón uno a uno** (§3).

Estado el 27-sep (API de Vercel, proyecto `prueba28juliokt`): `sishow.es`,
`www.sishow.es` (con redirección 308 a `sishow.es` configurada en Vercel),
`peluchic.sishow.es` y `prueba28juliokt.vercel.app` añadidos y verificados;
ninguno resolvía todavía en DNS.

## 3. Dar de alta un salón en su subdominio

1. Comprueba que el slug sirve como subdominio: minúsculas, dígitos y guiones,
   sin guion al principio ni al final, hasta 63 caracteres, y no reservado
   (`www`, `app`, `api`, `admin`, `demo`, `mail`, `correo`, `blog`, `send`,
   `status`…; lista completa en `SUBDOMINIOS_RESERVADOS`). Si no sirve, su web
   sigue en `sishow.es/s/<slug>`.
2. Simula (solo lee; no cambia nada):

   ```bash
   set -a; source ~/.config/sishow/credenciales.env; set +a   # VERCEL_TOKEN
   bun scripts/alta-subdominio.ts <slug>
   ```

3. Aplica:

   ```bash
   bun scripts/alta-subdominio.ts <slug> --aplicar
   ```

   Añade `<slug>.sishow.es` al proyecto (`POST /v10/projects/prueba28juliokt/domains`
   del equipo `estrellavercel-s-projects`), lo verifica si Vercel lo pide
   (`POST /v9/projects/…/domains/<dominio>/verify`) y lee su DNS
   (`GET /v6/domains/<dominio>/config`). Es idempotente. Salida: `0` listo,
   `1` error (slug inválido, token, dominio en otro proyecto…), `2` añadido
   pero pendiente (verificación o DNS/certificado).
4. Con el comodín `*` ya en IONOS no hay que tocar DNS. Sin comodín, crea un
   CNAME `<slug>` → `cname.vercel-dns.com.`.
5. Comprueba: `curl -sI https://<slug>.sishow.es/` → 200, y la portada del
   salón en el navegador.

No hace falta redesplegar: el enrutado lee el host en cada petición.

## 4. Límites conocidos

- **Plan Hobby de Vercel** (comprobado por API el 27-sep): como mucho **50
  dominios propios por proyecto**, es decir `sishow.es` + `www` + 48 salones.
  Además, las condiciones de Vercel reservan Hobby a uso no comercial; con
  clientes de pago toca Pro.
- **Sin certificado comodín** (§2), cada salón nuevo necesita su alta en
  Vercel; un subdominio sin alta da el error de Vercel, no la web.
- **Un slug inexistente** con alta en Vercel sirve lo mismo que
  `/s/<slug-inexistente>` hoy.
- **Inicio de sesión en `sishow.es`.** El enlace mágico del panel vuelve a
  `window.location.origin` + `/app`; Supabase Auth solo redirige a URLs de su
  lista (Authentication › URL Configuration). Hay que añadir
  `https://sishow.es/**` (y `https://*.sishow.es/**` si se entra al panel desde
  un subdominio), o el enlace llevará a la «Site URL» configurada.
- **La sesión del panel es por dominio**: quien entra en
  `prueba28juliokt.vercel.app` no está dentro en `sishow.es`, y al revés. Lo
  mismo con el callback de Google (ver `docs/pruebas-google-2026-09-27.md`).
- **Enlaces escritos a mano con `/s/<slug>`** en la landing (dosier, QR,
  «Primeros pasos») siguen funcionando en el subdominio (307 a la forma corta)
  y en `sishow.es`; no se han cambiado.
- **Subrutas nuevas del salón**: si se añade `s.$salonSlug.<algo>.tsx`, hay
  que apuntarla en `SUBRUTAS_SALON` para que salga corta; el test
  `host.test.ts` falla hasta que se haga. Mientras, funciona con la forma
  larga.
- **Vite en local** bloquea hosts ajenos: `peluchic.localhost` funciona sin
  más; para `curl -H 'Host: peluchic.sishow.es'` hace falta
  `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.sishow.es`.

## 5. Cómo se comprobó (27-sep-2026)

- `curl -H 'Host: peluchic.sishow.es'` contra el servidor de desarrollo **y**
  contra el paquete de producción (`.vercel/output/functions/__server.func`
  servido en local con el adaptador de nodo de `srvx`): `/`, `/book`,
  `/privacidad` y `/dosier` → 200 con los enlaces ya en forma corta
  (`/book?d=…`); `/s/peluchic/book?d=…` → 307 a `/book?d=…`; `/api/recordatorios`
  → 401 (la ruta de API, intacta); `www.sishow.es/precios?x=1` → 308 a
  `https://sishow.es/precios?x=1`.
- `sishow.es` y `localhost`: el HTML de `/`, `/s/peluchic?d=…`,
  `/s/peluchic/book`, `/login`, `/app`, `/aceptar` y `/dosier` es idéntico
  antes y después del cambio salvo las marcas de tiempo de hidratación.
- Navegador en `http://peluchic.localhost:<puerto>/?d=<demo PeluChic>`:
  portada → «Reservar cita» → servicio → estilista → hora → datos → «Confirmar
  reserva», y termina en `/confirmation?…&d=…` con «Solicitud recibida»; al
  recargar la confirmación se sirve igual; consola sin errores ni avisos de
  hidratación.

Para repetirlo en local:

```bash
# peluchic.localhost ya resuelve a 127.0.0.1 en Chrome y curl
node node_modules/.bin/vite dev --port 8083 --host 0.0.0.0
# abrir http://peluchic.localhost:8083/?d=<demo>

# con el Host real, el servidor de desarrollo de Vite bloquea hosts ajenos:
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.sishow.es node node_modules/.bin/vite dev --port 8083 --host 0.0.0.0
curl -sI -H 'Host: peluchic.sishow.es' http://localhost:8083/
```
