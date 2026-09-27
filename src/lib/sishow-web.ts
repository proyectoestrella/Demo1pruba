/**
 * Datos de la web oficial de siShow (sishow.es). Lo que se promete en ella
 * sale de aquí para que precios, planes, enlaces de ejemplo y textos legales
 * no se contradigan con el resto de la app (ver `lib/plan.ts`).
 *
 * Lote 17 creó la primera versión en `/`; la web oficial (inicio,
 * funcionalidades, precios, contacto y legales) la amplía sin tocar el panel
 * ni la web de reservas de cada salón.
 */
import type { PlanSishow } from "./plan";

/** Dominio de la web oficial: canónicas, sitemap y Open Graph apuntan aquí. */
export const SITIO_URL = "https://sishow.es";

/** Correo de contacto comercial. */
export const CORREO_SISHOW = "infosishow@gmail.com";

/**
 * Número de WhatsApp de siShow, solo dígitos con prefijo de país (p. ej.
 * «34600000000»). MARCADOR: Tomás lo rellena cuando tenga el número. Mientras
 * siga siendo el marcador, el botón de WhatsApp abre el correo.
 */
export const WHATSAPP_SISHOW = "WHATSAPP_SISHOW";

const MENSAJE_WHATSAPP = "Hola, quiero ver siShow para mi salón.";

/** Enlace del botón de WhatsApp; `null` si el número aún es el marcador. */
export function enlaceWhatsapp(numero: string = WHATSAPP_SISHOW): string | null {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 9) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`;
}

export function enlaceCorreo(asunto = "Quiero ver siShow para mi salón"): string {
  return `mailto:${CORREO_SISHOW}?subject=${encodeURIComponent(asunto)}`;
}

/** Perfil de la demo de PeluChic (el mismo `?d=` que se enseña a María). */
export const DEMO_PELUCHIC = "eyJuIjoiUGVsdUNoaWMiLCJ0IjoiUGVsdXF1ZXLDrWEiLCJkIjoiQ2FsbGUgUHJpbmNlc2EgZGUgw4lib2xpLCAxMDAgKGVzcXVpbmEgQy4gZGUgTWFyw61hIFR1ZG9yLCAxNCwgTG9jIDEwNCksIEhvcnRhbGV6YS9TYW5jaGluYXJybywgMjgwNTAgTWFkcmlkIiwicCI6IjY2NiA3NyA2NyAzMSIsInIiOjQuNSwiYyI6ODEsInMiOlsibm92aWFzIiwibWFkcmluYXMiLCJldmVudG9zIl0sIm8iOlsiQ2VycmFkbyIsIjEwOjAw4oCTMjA6MDAiLCIxMDowMOKAkzIwOjAwIiwiMTA6MDDigJMyMDowMCIsIjEwOjAw4oCTMjA6MDAiLCI5OjAw4oCTMTQ6MDAiLCJDZXJyYWRvIl0sImUiOlsiTWFyw61hfkVzdGlsaXN0YSwgbm92aWFzIHkgcGVpbmFkb3MgZGUgZXZlbnRvIiwiU2FyYX5Db2xvcmlzdGEsIGNvbG9yIHkgbWVjaGFzL2JhbGF5YWdlIiwiTm9lbGlhfkVzdGlsaXN0YSwgcmVjb2dpZG9zIHkgdHJhdGFtaWVudG9zIl0sIm0iOlsiQ29ydGUgeSBwZWluYWRvfjQ1fjI1flBlbHVxdWVyw61hIiwiVGludGV-NDB-MzV-UGVsdXF1ZXLDrWEiLCJNZWNoYXMgLyBiYWxheWFnZX4xMjB-ODB-UGVsdXF1ZXLDrWEiLCJQZWluYWRvIGRlIG5vdmlhfjkwfjkwflBlbHVxdWVyw61hIiwiUmVjb2dpZG8gZGUgZXZlbnRvfjYwfjQ1flBlbHVxdWVyw61hIiwiVHJhdGFtaWVudG8gY2FwaWxhcn4zMH4yMH5QZWx1cXVlcsOtYSJdLCJkZiI6MSwiaCI6Ii9hcGkvZm90bz9wbGFjZT1DaElKY19kWTNxMHVRZzBSZWVBemMxWTNpcnMmaT0wIiwiZiI6MTAsImciOlsiNSIsIjIiLCI3IiwiNCIsIjMiLCI2Il0sImZlIjoxLCJmYiI6IjY2NiA3NyA2NyAzMSIsImZhIjoyMH0";

export const ENLACE_WEB_EJEMPLO = `/s/peluchic?d=${DEMO_PELUCHIC}`;
export const ENLACE_PANEL_EJEMPLO = `/app?d=${DEMO_PELUCHIC}`;

/** Precio por mes, en euros, pagando el año entero o mes a mes. */
export const PRECIOS: Record<PlanSishow, { anual: number; mensual: number }> = {
  reservas: { anual: 36, mensual: 40 },
  "reservas-asistente": { anual: 42, mensual: 47 },
  "todo-incluido": { anual: 55, mensual: 59 },
};

/** Puesta en marcha: horas de trabajo nuestro, a precio por hora. */
export const PUESTA_EN_MARCHA = { horas: 5, precioHora: 18 };

export function precioPuestaEnMarcha(anual: boolean): number {
  const total = PUESTA_EN_MARCHA.horas * PUESTA_EN_MARCHA.precioHora;
  return anual ? total / 2 : total;
}

/* -------------------------------------------------------------------------
 * Páginas de la web oficial
 * ---------------------------------------------------------------------- */

export type ClavePagina =
  | "inicio"
  | "funcionalidades"
  | "precios"
  | "contacto"
  | "aviso-legal"
  | "privacidad"
  | "cookies";

export interface PaginaWeb {
  ruta: string;
  /** Texto del `<title>` (sin sufijo: ya nombra siShow cuando hace falta). */
  titulo: string;
  /** Meta descripción, 120-160 caracteres. */
  descripcion: string;
}

export const PAGINAS_WEB: Record<ClavePagina, PaginaWeb> = {
  inicio: {
    ruta: "/",
    titulo: "siShow: reservas online y agenda para peluquerías y centros de belleza",
    descripcion:
      "Tus clientas reservan solas desde tu web, tú llevas la agenda del equipo, las fichas de color y la caja desde el móvil. Funcionando en una semana.",
  },
  funcionalidades: {
    ruta: "/funcionalidades",
    titulo: "Funcionalidades de siShow: reservas, agenda, fichas de color y caja",
    descripcion:
      "Web de reservas con tu nombre, agenda del equipo, fichas con el color de cada clienta, caja y señal, asistente sin IA, accesos por rol y deshacer.",
  },
  precios: {
    ruta: "/precios",
    titulo: "Precios de siShow: planes para tu salón desde 36 € al mes",
    descripcion:
      "Tres planes con precio cerrado: Reservas, Reservas + Asistente y Todo incluido. Pago anual o mensual y puesta en marcha de 90 € (45 € con el anual).",
  },
  contacto: {
    ruta: "/contacto",
    titulo: "Contacto: hablemos de tu salón | siShow",
    descripcion:
      "Escríbenos a infosishow@gmail.com y te enseñamos siShow con tus servicios y tu equipo. O prueba antes la demo de un salón de ejemplo.",
  },
  "aviso-legal": {
    ruta: "/legal/aviso-legal",
    titulo: "Aviso legal | siShow",
    descripcion: "Datos del titular de sishow.es, condiciones de uso de la web, propiedad intelectual y legislación aplicable.",
  },
  privacidad: {
    ruta: "/legal/privacidad",
    titulo: "Política de privacidad | siShow",
    descripcion:
      "Quién trata tus datos cuando nos escribes, para qué, con qué base legal, cuánto tiempo y cómo ejercer tus derechos según el RGPD.",
  },
  cookies: {
    ruta: "/legal/cookies",
    titulo: "Política de cookies | siShow",
    descripcion: "sishow.es no usa cookies de analítica ni de publicidad. Qué se guarda en tu navegador y para qué.",
  },
};

/** Navegación principal de la cabecera. */
export const NAV_WEB: { ruta: "/funcionalidades" | "/precios" | "/contacto"; texto: string }[] = [
  { ruta: "/funcionalidades", texto: "Funcionalidades" },
  { ruta: "/precios", texto: "Precios" },
  { ruta: "/contacto", texto: "Contacto" },
];

/** `<head>` básico de una página de la web oficial: título y descripción. */
export function cabezaWeb(clave: ClavePagina) {
  const p = PAGINAS_WEB[clave];
  return {
    meta: [{ title: p.titulo }, { name: "description", content: p.descripcion }],
  };
}
