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

## 3. Cómo se comprobó (27-sep-2026)

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
