/**
 * Lote 17 · Enrutado por dominio.
 *
 * `sishow.es` es la web oficial y cada salón tiene su web de reservas en su
 * subdominio: `peluchic.sishow.es` sirve lo mismo que `/s/peluchic`. Este
 * módulo decide QUÉ es un host y CÓMO se traduce una ruta pública a la ruta
 * interna del router (y al revés). No importa nada del navegador ni del
 * servidor: lo usan el router (en SSR y en cliente), el middleware de `www`
 * y el script de alta de subdominios. Ver docs/dominios-sishow.md.
 */

export type TipoHost = { tipo: "oficial" } | { tipo: "salon"; slug: string } | { tipo: "otro" };

export const DOMINIO_POR_DEFECTO = "sishow.es";

/**
 * Subdominios que nunca son un salón. Un salón con uno de estos slugs sigue
 * teniendo su web en `/s/<slug>`, pero no en su subdominio.
 */
export const SUBDOMINIOS_RESERVADOS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "api",
  "admin",
  "demo",
  "demos",
  "mail",
  "correo",
  "email",
  "smtp",
  "imap",
  "pop",
  "mx",
  "webmail",
  "blog",
  "send",
  "status",
  "estado",
  "panel",
  "login",
  "cuenta",
  "ayuda",
  "soporte",
  "help",
  "docs",
  "static",
  "assets",
  "cdn",
  "img",
  "media",
  "files",
  "dev",
  "staging",
  "preview",
  "test",
  "pruebas",
  "ftp",
  "ns1",
  "ns2",
  "autoconfig",
  "autodiscover",
]);

/** Un slug de salón válido como etiqueta DNS: minúsculas, dígitos y guiones, sin guion en los bordes. */
const ETIQUETA_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Dominio raíz de siShow. Se lee de `VITE_SISHOW_DOMINIO` porque el mismo
 * código corre en el servidor y en el navegador: Vite sustituye la variable
 * en los dos paquetes al compilar, así que nunca pueden discrepar (si el
 * servidor reescribiera y el cliente no, la hidratación se rompería). Sin
 * variable, `sishow.es`.
 */
export function dominioRaiz(): string {
  let valor: string | undefined;
  try {
    // Literal exacto: Vite solo sustituye `import.meta.env.VITE_…` escrito así.
    valor = import.meta.env.VITE_SISHOW_DOMINIO as string | undefined;
  } catch {
    valor = undefined;
  }
  const limpio = normalizarHostname(valor ?? "");
  return limpio || DOMINIO_POR_DEFECTO;
}

/** Minúsculas, sin espacios, sin puerto y sin el punto final de un FQDN. */
export function normalizarHostname(host: string): string {
  let h = host.trim().toLowerCase();
  if (!h) return "";
  // IPv6 entre corchetes: no es un dominio de siShow, se devuelve tal cual.
  if (h.startsWith("[")) return h;
  const dosPuntos = h.indexOf(":");
  if (dosPuntos !== -1) h = h.slice(0, dosPuntos);
  while (h.endsWith(".")) h = h.slice(0, -1);
  return h;
}

/**
 * Qué es este host.
 *
 * - `sishow.es` y `www.sishow.es` → la web oficial (el `www` además se
 *   redirige a la raíz, ver `redireccionWww`).
 * - `<slug>.sishow.es` → la web del salón `<slug>`, salvo subdominios
 *   reservados o con más de un nivel (`a.b.sishow.es`), que son «otro».
 * - En local, `localhost` hace de raíz: `peluchic.localhost:8083` → salón.
 * - Cualquier otro (vercel.app, IPs, dominios ajenos) → «otro»: sin cambios.
 */
export function resolverHost(hostname: string, dominio: string = dominioRaiz()): TipoHost {
  const h = normalizarHostname(hostname);
  const raiz = normalizarHostname(dominio) || DOMINIO_POR_DEFECTO;
  if (!h) return { tipo: "otro" };

  for (const base of [raiz, "localhost"]) {
    if (h === base) return { tipo: "oficial" };
    if (!h.endsWith(`.${base}`)) continue;
    const sub = h.slice(0, -(base.length + 1));
    if (sub === "www" && base === raiz) return { tipo: "oficial" };
    if (sub.includes(".")) return { tipo: "otro" };
    if (SUBDOMINIOS_RESERVADOS.has(sub)) return { tipo: "otro" };
    if (!ETIQUETA_SLUG.test(sub)) return { tipo: "otro" };
    return { tipo: "salon", slug: sub };
  }
  return { tipo: "otro" };
}

/** `true` si el slug puede tener subdominio propio (etiqueta DNS válida y no reservada). */
export function slugAdmiteSubdominio(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return ETIQUETA_SLUG.test(s) && !SUBDOMINIOS_RESERVADOS.has(s);
}

/** `<slug>.<dominio>` o `null` si el slug no admite subdominio. */
export function subdominioDeSalon(slug: string, dominio: string = dominioRaiz()): string | null {
  const s = slug.trim().toLowerCase();
  if (!slugAdmiteSubdominio(s)) return null;
  return `${s}.${normalizarHostname(dominio) || DOMINIO_POR_DEFECTO}`;
}

/**
 * `www.<dominio>` → la misma ruta en `https://<dominio>` (308). Devuelve la
 * URL de destino o `null` si no toca redirigir. Solo el dominio de
 * producción: `www.localhost` o `www.algo.vercel.app` no se tocan.
 */
export function redireccionWww(url: URL, dominio: string = dominioRaiz()): string | null {
  const raiz = normalizarHostname(dominio) || DOMINIO_POR_DEFECTO;
  if (normalizarHostname(url.hostname) !== `www.${raiz}`) return null;
  return `https://${raiz}${url.pathname}${url.search}${url.hash}`;
}

/**
 * Subrutas de la web de un salón que en su subdominio cuelgan de la raíz:
 * `peluchic.sishow.es/book` ≡ `/s/peluchic/book`. Es una LISTA BLANCA: lo que
 * no esté aquí (`/app`, `/api`, `/aceptar`, `/login`, `/assets`, `/_serverFn`…)
 * no se reescribe nunca. Tiene que coincidir con los ficheros
 * `src/routes/s.$salonSlug.<subruta>.tsx` (lo comprueba host.test.ts). Si se
 * añade una subruta y no se apunta aquí, no se rompe nada: sus enlaces
 * seguirán saliendo como `/s/<slug>/<subruta>`, que también funciona en el
 * subdominio.
 */
export const SUBRUTAS_SALON: readonly string[] = ["book", "confirmation", "dosier", "privacidad"];

function primerSegmento(pathname: string): string {
  const resto = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const fin = resto.indexOf("/");
  return fin === -1 ? resto : resto.slice(0, fin);
}

/**
 * Ruta pública del subdominio → ruta interna del router, o `null` si no se
 * toca. `/` → `/s/<slug>`, `/book` → `/s/<slug>/book`. `/s/...` se deja como
 * está (los enlaces viejos siguen funcionando en el subdominio).
 */
export function rutaInternaDeSalon(pathname: string, slug: string): string | null {
  if (pathname === "" || pathname === "/") return `/s/${slug}`;
  if (SUBRUTAS_SALON.includes(primerSegmento(pathname))) return `/s/${slug}${pathname}`;
  return null;
}

/**
 * Ruta interna → ruta pública en el subdominio de ESE salón, o `null` si no
 * se toca. `/s/<slug>` → `/`, `/s/<slug>/book` → `/book`. Las rutas de otro
 * salón o de fuera de la lista blanca salen como están.
 */
export function rutaPublicaDeSalon(pathname: string, slug: string): string | null {
  const base = `/s/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "/";
  if (!pathname.startsWith(`${base}/`)) return null;
  const resto = pathname.slice(base.length);
  if (!SUBRUTAS_SALON.includes(primerSegmento(resto))) return null;
  return resto;
}

/**
 * Par `rewrite` para `createRouter`: en el subdominio de un salón traduce la
 * URL pública a la interna al entrar (SSR y cliente) y la interna a la
 * pública al construir enlaces y redirecciones. En cualquier otro host no
 * toca nada (devuelve `undefined`).
 */
export function reescrituraPorDominio(dominio?: string) {
  const salonDe = (url: URL): string | null => {
    const h = resolverHost(url.hostname, dominio ?? dominioRaiz());
    return h.tipo === "salon" ? h.slug : null;
  };
  return {
    input: ({ url }: { url: URL }): URL | undefined => {
      const slug = salonDe(url);
      if (!slug) return undefined;
      const interna = rutaInternaDeSalon(url.pathname, slug);
      if (interna === null) return undefined;
      url.pathname = interna;
      return url;
    },
    output: ({ url }: { url: URL }): URL | undefined => {
      const slug = salonDe(url);
      if (!slug) return undefined;
      const publica = rutaPublicaDeSalon(url.pathname, slug);
      if (publica === null) return undefined;
      url.pathname = publica;
      return url;
    },
  };
}
