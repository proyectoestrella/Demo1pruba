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

/* -------------------------------------------------------------------------
 * Contenido compartido de la web oficial
 * ---------------------------------------------------------------------- */

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

/**
 * Preguntas frecuentes del inicio. Cada respuesta se ciñe a lo que existe hoy
 * en el producto (registro de versiones y hoja de planes v2 del 26-sep).
 */
export const PREGUNTAS_INICIO: Pregunta[] = [
  {
    pregunta: "¿Mis clientas tienen que descargarse algo?",
    respuesta:
      "No. Reservan desde tu enlace, en el navegador del móvil o del ordenador. No necesitan cuenta ni contraseña: dejan su nombre y su teléfono, y el correo si quieren.",
  },
  {
    pregunta: "¿Cuánto se tarda en empezar?",
    respuesta:
      "Una semana. Hablamos una hora, lo montamos nosotros con tus servicios, tu equipo y tus clientas, lo repasas con nosotros y das tu enlace. Después te acompañamos por WhatsApp las dos primeras semanas.",
  },
  {
    pregunta: "¿siShow cobra a mis clientas o se queda una comisión?",
    respuesta:
      "No. siShow no cobra nada a tus clientas ni se queda comisión por reserva: tú pagas una cuota fija al mes y ellas te pagan a ti, como siempre. Si pides señal, el Bizum llega a tu número.",
  },
  {
    pregunta: "¿Funciona en el móvil y en el iPad?",
    respuesta:
      "Sí. siShow funciona en el navegador del móvil, de la tablet y del ordenador, y puedes añadirlo a la pantalla de inicio para abrirlo como una app más.",
  },
  {
    pregunta: "¿El asistente usa inteligencia artificial?",
    respuesta:
      "No. Busca en tu agenda, tus fichas y tu caja y te responde con esos datos. Si algo no lo sabe, te lo dice: no se inventa nada.",
  },
  {
    pregunta: "¿Los WhatsApp a mis clientas los mandáis vosotros?",
    respuesta:
      "Salen de tu propio WhatsApp: siShow te prepara el recordatorio, la confirmación o la petición de señal y tú lo envías con un toque. Si prefieres que se envíen solos desde tu número, lo montamos a tu medida.",
  },
  {
    pregunta: "¿Qué pasa con las clientas que ya tengo?",
    respuesta:
      "Las traemos nosotros en la puesta en marcha. Si usas TPV 123, también su historial de ventas; si usas otro programa, lo miramos contigo.",
  },
  {
    pregunta: "¿Sirve para barberías y centros de estética?",
    respuesta:
      "Sí. Los servicios, la duración y los precios los pones tú, así que funciona igual con cortes y arreglos de barba que con tratamientos de estética.",
  },
];

/** La semana de puesta en marcha, paso a paso. */
export const SEMANA_PUESTA: { cuando: string; titulo: string; texto: string }[] = [
  { cuando: "Día 1", titulo: "Hablamos una hora", texto: "Nos cuentas tus servicios, tu equipo, tu horario y cómo quieres la señal." },
  { cuando: "Días 2 y 3", titulo: "Lo montamos nosotros", texto: "Cargamos tu carta, el equipo y tus clientas, y dejamos lista tu web de reservas." },
  { cuando: "Día 4", titulo: "Lo repasas", texto: "Te lo enseñamos ya hecho y cambiamos lo que no te encaje." },
  { cuando: "Días 5 a 7", titulo: "Primeras reservas", texto: "Formación con tu equipo, compartes tu enlace y estamos pendientes de las primeras citas." },
];

/** Resumen de cada plan para el inicio: para quién es y lo principal. */
export const RESUMEN_PLANES: Record<PlanSishow, { para: string; puntos: string[] }> = {
  reservas: {
    para: "Para recibir reservas por internet y ordenar la agenda del salón.",
    puntos: ["Web de reservas con tu nombre", "Agenda del equipo", "Fichas con el color de cada clienta", "Caja y señal por Bizum"],
  },
  "reservas-asistente": {
    para: "Lo mismo, y un asistente que te responde con tus datos.",
    puntos: ["Todo lo de Reservas", "El asistente, sin inteligencia artificial", "Historial de ventas de TPV 123", "Lo que gasta cada clienta"],
  },
  "todo-incluido": {
    para: "Para el salón que quiere tenerlo todo y que se lo llevemos al día.",
    puntos: ["Todo lo de Reservas + Asistente", "Más tipos de acceso e historial completo", "Campañas, analítica completa y Excel", "Tu propio dominio y soporte prioritario"],
  },
};
