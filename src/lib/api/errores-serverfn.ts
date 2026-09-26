/**
 * Errores de entrada de las server functions (segunda pasada del barrido,
 * 26/09/2026).
 *
 * Lo que hacía TanStack Start hasta ahora:
 *  - `payload` que no es JSON → **500** con el mensaje del parser en inglés.
 *  - Datos que no pasan el `inputValidator` (zod) → **200** con el error
 *    dentro, y como mensaje el JSON crudo de zod en inglés.
 *  - Una página pedida con `Accept: application/json` → **500** «Only HTML
 *    requests are supported here».
 *
 * Ahora las tres son 4xx con un mensaje en español. El cliente de TanStack
 * deserializa el error mire o no el código de estado (serverFnFetcher), así
 * que quien hoy hace `.catch()` sigue recibiendo un `Error`, solo que con un
 * mensaje legible; ningún cliente del panel interpreta el texto de zod.
 *
 * El formato del cuerpo es el de seroval que ya usa TanStack: un nodo
 * `{"t":25,…,"c":"$TSR/Error"}` es un `Error` con su `message`.
 */

export const PREFIJO_SERVER_FN = "/_serverFn/";
const CABECERA_SERIALIZADO = "x-tss-serialized";

/**
 * seroval guarda cada cadena (nodo `t:1`) ya escapada como un literal de JS
 * (`\n`, `\"`, `\x3C`…) y ese texto va, además, dentro del JSON. Hay que
 * quitar esa capa para leer el mensaje de zod y ponerla al escribir el nuestro.
 */
function desescapar(s: string): string {
  const json = s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => `\\u00${h}`);
  try {
    return JSON.parse(`"${json}"`) as string;
  } catch {
    return s;
  }
}
function escapar(s: string): string {
  return JSON.stringify(s).slice(1, -1).replace(/</g, "\\x3C");
}

/** Un `Error` en el formato de TanStack, listo para que el cliente lo lance. */
export function respuestaDeError(mensaje: string, status: number): Response {
  return new Response(JSON.stringify(nodoError(mensaje)), {
    status,
    headers: { "Content-Type": "application/json", [CABECERA_SERIALIZADO]: "true", "Cache-Control": "no-store" },
  });
}

function nodoError(mensaje: string, i = 0) {
  return { t: 25, i, s: { message: { t: 1, s: escapar(mensaje) } }, c: "$TSR/Error" };
}

/** ¿Trae la petición un `payload` (GET) o un cuerpo JSON (POST) que no se puede leer? */
export async function payloadIlegible(request: Request): Promise<boolean> {
  try {
    if (request.method.toUpperCase() === "GET") {
      const p = new URL(request.url).searchParams.get("payload");
      if (p !== null) JSON.parse(p);
      return false;
    }
    const tipo = request.headers.get("content-type") ?? "";
    if (!tipo.includes("application/json")) return false;
    const cuerpo = await request.clone().text();
    if (cuerpo) JSON.parse(cuerpo);
    return false;
  } catch {
    return true;
  }
}

type Issue = { code?: string; path?: Array<string | number>; minimum?: number; maximum?: number; expected?: string; options?: unknown[] };

/** Si `mensaje` es la lista de problemas de zod, la frase en español; si no, `null`. */
export function mensajeDeValidacion(mensaje: string): string | null {
  let issues: unknown;
  try {
    issues = JSON.parse(mensaje);
  } catch {
    return null;
  }
  if (!Array.isArray(issues) || issues.length === 0) return null;
  if (!issues.every((x) => x && typeof x === "object" && "code" in x && "path" in x)) return null;
  const frases = (issues as Issue[]).slice(0, 3).map((x) => {
    const campo = x.path && x.path.length ? `«${x.path.join(".")}»` : "los datos";
    switch (x.code) {
      case "too_small":
        return typeof x.minimum === "number" && x.minimum <= 1 ? `${campo} no puede ir vacío` : `${campo} se queda corto`;
      case "too_big":
        return `${campo} es demasiado largo o grande`;
      case "invalid_type":
        return x.expected ? `${campo} falta o no tiene el formato esperado` : `${campo} no tiene el formato esperado`;
      case "invalid_enum_value":
        return `${campo} no es una de las opciones posibles`;
      default:
        return `${campo} no es válido`;
    }
  });
  const mas = issues.length > 3 ? ` (y ${issues.length - 3} más)` : "";
  return `Datos no válidos: ${frases.join("; ")}${mas}.`;
}

type Nodo = { t?: number; s?: { message?: { t?: number; s?: string } }; c?: string; p?: { k?: string[]; v?: unknown[] } };

/** El nodo `Error` de una respuesta: el de arriba, o el campo `error` de `{result, error, context}`. */
function nodoDeError(raiz: Nodo): Nodo | null {
  if (raiz.t === 25 && raiz.c === "$TSR/Error") return raiz;
  const k = raiz.p?.k;
  const i = k ? k.indexOf("error") : -1;
  const n = i >= 0 ? (raiz.p!.v![i] as Nodo | undefined) : undefined;
  return n && n.t === 25 && n.c === "$TSR/Error" ? n : null;
}

/**
 * Si la respuesta de una server function es un error de validación de zod,
 * la misma respuesta con 400 y el mensaje en español. Si no, la original.
 */
export async function reescribirErrorDeValidacion(r: Response): Promise<Response> {
  if (r.headers.get(CABECERA_SERIALIZADO) !== "true") return r;
  if (!(r.headers.get("content-type") ?? "").includes("application/json")) return r; // framed/stream: no se toca
  let raiz: Nodo;
  try {
    raiz = JSON.parse(await r.clone().text());
  } catch {
    return r;
  }
  const nodo = nodoDeError(raiz);
  const msg = nodo?.s?.message;
  if (!nodo || !msg || typeof msg.s !== "string") return r;
  const es = mensajeDeValidacion(desescapar(msg.s));
  if (!es) return r;
  msg.s = escapar(es);
  const headers = new Headers(r.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(raiz), { status: 400, headers });
}

/** ¿Pide JSON (o cualquier cosa que no sea HTML) a una ruta de página? */
export function pideNoHtml(request: Request): boolean {
  const partes = (request.headers.get("accept") || "*/*").split(",").map((p) => p.trim());
  return !partes.some((p) => p.startsWith("*/*") || p.startsWith("text/html"));
}

/**
 * Todo junto, para el middleware global de `start.ts`. `next` es el resto de
 * la cadena y devuelve la respuesta final.
 */
export async function vigilarEntrada(request: Request, next: () => Promise<Response | undefined>): Promise<Response | undefined> {
  const ruta = new URL(request.url).pathname;
  if (ruta.startsWith(PREFIJO_SERVER_FN)) {
    if (await payloadIlegible(request)) {
      return respuestaDeError("La petición no es válida: los datos enviados no se pueden leer.", 400);
    }
    const r = await next();
    return r ? reescribirErrorDeValidacion(r) : r;
  }
  // Las rutas `api/*` contestan lo suyo; las páginas solo saben dar HTML.
  if (!ruta.startsWith("/api/") && pideNoHtml(request)) {
    return new Response(JSON.stringify({ error: "Esta dirección solo sirve páginas (HTML)." }), {
      status: 406,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return next();
}
