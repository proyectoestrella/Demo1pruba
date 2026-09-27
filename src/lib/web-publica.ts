/**
 * Piezas compartidas de la web pública del salón (portada, reserva y
 * confirmación), lote 17.
 *
 * Un solo contenedor para cabecera, secciones, flujo de reserva y pie: antes
 * la cabecera iba a `max-w-7xl` y la reserva a `max-w-6xl`, y a 1440 px el
 * título de la reserva empezaba 58 px más a la derecha que el logo.
 */
export const CONTENEDOR_WEB = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/**
 * Contenedor fluido de la web del salón (lote 18.1): margen lateral
 * `clamp(16px, 4vw, 72px)` y ancho útil de 1600 a 2048 px (ver
 * `src/web-salon.css`). Sustituye a `CONTENEDOR_WEB` en la portada, la
 * reserva y la confirmación, que a 1920 px dejaban un 43 % del ancho vacío.
 */
export const CONTENEDOR_SALON = "contenedor-salon";

/** Ritmo vertical de sección, sobre la escala de 4 (56 / 80 px). */
export const SECCION_WEB = "py-14 md:py-20";

/** «novias, madrinas y eventos»: lista en español con «y» antes del último. */
export function listaConY(items: string[]): string {
  const limpios = items.map((s) => s.trim()).filter(Boolean);
  if (limpios.length <= 1) return limpios[0] ?? "";
  return `${limpios.slice(0, -1).join(", ")} y ${limpios[limpios.length - 1]}`;
}

/** Nota con coma decimal: 4.5 → «4,5». */
export function notaEs(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

/* ---- Enlaces del salón (lote 18.4) ---------------------------------------
 * Todo sale del perfil (`enlaces`, `whatsapp`, `boletin`), para que sirva a
 * cualquier salón: lo que falta no se pinta. Solo se aceptan direcciones
 * http(s): el perfil lo escribe la dueña, y un `javascript:` en un enlace de
 * su web pública no puede llegar nunca a un `href`.
 * ------------------------------------------------------------------------- */

/** La URL si es http(s) y está bien formada; si no, `undefined`. */
export function urlSegura(url: string | undefined | null): string | undefined {
  const t = url?.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export interface EnlacesSalon {
  blog?: string;
  instagram?: string;
  facebook?: string;
  tienda?: string;
  web?: string;
}

/**
 * Los enlaces que se pueden enseñar. Instagram cae al usuario de siempre
 * (`instagram: "@peluchic"`) si no viene la dirección completa.
 */
export function enlacesDelSalon(p: { enlaces?: EnlacesSalon; instagram?: string }): EnlacesSalon {
  const e = p.enlaces ?? {};
  const usuario = p.instagram?.trim().replace(/^@/, "");
  const instagram =
    urlSegura(e.instagram) ??
    (usuario && /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? `https://www.instagram.com/${usuario}` : undefined);
  const r: EnlacesSalon = {
    blog: urlSegura(e.blog),
    instagram,
    facebook: urlSegura(e.facebook),
    tienda: urlSegura(e.tienda),
    web: urlSegura(e.web),
  };
  for (const k of Object.keys(r) as (keyof EnlacesSalon)[]) if (!r[k]) delete r[k];
  return r;
}

/**
 * Número de WhatsApp en el formato de wa.me (solo dígitos, con prefijo de
 * país). Un móvil o fijo español de 9 cifras sin prefijo lleva el 34 delante.
 */
export function numeroWhatsApp(raw: string | undefined | null): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  let d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^[6789]\d{8}$/.test(d)) d = `34${d}`;
  d = d.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : undefined;
}

/** Texto con el que se abre la conversación de WhatsApp desde la web del salón. */
export function textoWhatsApp(nombreSalon: string): string {
  const nombre = nombreSalon.trim();
  return nombre ? `Hola, ${nombre}. Os escribo desde vuestra web de reservas.` : "Hola. Os escribo desde vuestra web de reservas.";
}

/** Enlace de WhatsApp del salón (`whatsapp` del perfil o, si no hay, `phone`), con el texto ya escrito. */
export function enlaceWhatsApp(p: { whatsapp?: string; phone?: string; name?: string }): string | undefined {
  const n = numeroWhatsApp(p.whatsapp) ?? numeroWhatsApp(p.phone);
  if (!n) return undefined;
  return `https://wa.me/${n}?text=${encodeURIComponent(textoWhatsApp(p.name ?? ""))}`;
}

/**
 * Precio de un servicio en la carta pública (lote 18.5): el literal del salón
 * si lo hay («desde 150 € (sin IVA)», «43,50 € / 47,50 €»); si no, el importe
 * sin decimales de relleno («25 €», «28,50 €»). El espacio antes del euro no
 * se parte.
 */
export function precioDeCarta(s: { priceEur: number; priceText?: string }): string {
  const literal = s.priceText?.trim();
  if (literal) return literal;
  const conDecimales = Math.round(s.priceEur * 100) % 100 !== 0;
  const n = s.priceEur.toLocaleString("es-ES", {
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${n}\u00a0€`;
}
