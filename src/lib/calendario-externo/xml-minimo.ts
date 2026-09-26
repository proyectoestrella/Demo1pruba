/**
 * El trocito de XML que hace falta para hablar CalDAV/WebDAV (PROPFIND,
 * REPORT `multistatus`), sin añadir un parser XML completo como dependencia.
 *
 * Deliberadamente tolerante con el prefijo de espacio de nombres (`d:`,
 * `D:`, sin prefijo…) porque cada servidor CalDAV los usa a su manera; NO
 * pretende ser un parser XML general — solo entiende la forma concreta de
 * un `<d:multistatus>` de WebDAV. Si algún día hace falta hablar con un
 * servidor más raro que iCloud, aquí es donde se nota primero.
 */

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Todas las apariciones de `<[prefijo:]tag ...>contenido</[prefijo:]tag>`, con o sin prefijo. */
export function buscarTodos(xml: string, tag: string): string[] {
  const t = escaparRegex(tag);
  const re = new RegExp(`<(?:[\\w-]+:)?${t}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${t}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/** La primera aparición, o null si no hay ninguna (incluye las autocerradas: `<d:collection/>`). */
export function buscarUno(xml: string, tag: string): string | null {
  const encontrados = buscarTodos(xml, tag);
  if (encontrados.length) return encontrados[0];
  const t = escaparRegex(tag);
  const auto = new RegExp(`<(?:[\\w-]+:)?${t}\\b[^>]*/>`, "i");
  return auto.test(xml) ? "" : null;
}

/** ¿Aparece esta etiqueta (con o sin contenido) en el fragmento? */
export function tieneEtiqueta(xml: string, tag: string): boolean {
  return buscarUno(xml, tag) !== null;
}

export interface RespuestaDav {
  href: string;
  /** El XML íntegro de este `<response>`, para buscar props dentro con las funciones de arriba. */
  xml: string;
  /** El texto dentro del `<propstat>` cuyo `<status>` contiene "200" (las props que sí existen). */
  propsOk: string;
}

function decodificarHref(href: string): string {
  try {
    return decodeURIComponent(href.trim());
  } catch {
    return href.trim();
  }
}

/** Parte un `<multistatus>` en sus `<response>`, ya con las props válidas (status 200) separadas. */
export function parsearMultistatus(xml: string): RespuestaDav[] {
  return buscarTodos(xml, "response").map((bloque) => {
    const href = decodificarHref(buscarUno(bloque, "href") ?? "");
    const propstats = buscarTodos(bloque, "propstat");
    const ok = propstats.find((p) => /200/.test(buscarUno(p, "status") ?? ""));
    const propsOk = ok ? (buscarUno(ok, "prop") ?? "") : "";
    return { href, xml: bloque, propsOk };
  });
}
