/**
 * Datos de la web de producto de siShow (`/`), lote 17. Lo que se promete en
 * esa página sale de aquí para que precios, planes y enlaces de ejemplo no se
 * contradigan con el resto de la app (ver `lib/plan.ts`).
 */
import type { PlanSishow } from "./plan";

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
