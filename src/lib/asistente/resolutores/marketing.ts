/** Resolutores de «marketing»: las cifras vienen de las fuentes (campañas del panel). */
import { visitasPorClienta } from "./calculos";
import { NO_LO_TENGO, plural, respuesta, type Resolutor } from "./tipos";

const verMarketing = { tipo: "ver-seccion" as const, etiqueta: "Ver Marketing", destino: "Marketing" };
const preparar = { tipo: "ver-seccion" as const, etiqueta: "Preparar mensaje", destino: "Marketing" };

export const campanas: Resolutor = (c) => {
  const l = c.fuentes.marketing.campanas();
  if (!l) return respuesta(`${NO_LO_TENGO}: las campañas no están disponibles.`);
  const top = [...l].sort((a, b) => b.personas - a.personas)[0];
  if (!top) return respuesta("Ahora mismo **no hay ninguna campaña** que merezca la pena.");
  return respuesta(`La que más rinde ahora: **«${top.titulo}»**, ${plural(top.personas, "persona", "personas")} con el mensaje ya escrito.${top.motivo ? ` ${top.motivo}` : ""}`, {
    cifras: [{ etiqueta: top.titulo, valor: top.personas, unidad: "clientas" }],
    acciones: [verMarketing],
  });
};

export const recuperables: Resolutor = (c) => {
  const r = c.fuentes.marketing.recuperables();
  if (!r) return respuesta(`${NO_LO_TENGO}: no puedo calcular lo recuperable.`);
  return respuesta(`Este mes puedes recuperar **${plural(r.clientas, "clienta", "clientas")}** y rellenar ${plural(r.huecos, "hueco", "huecos")}.`, {
    cifras: [{ etiqueta: "clientas recuperables", valor: r.clientas, unidad: "clientas" }, { etiqueta: "huecos", valor: r.huecos, unidad: "huecos" }],
    acciones: [verMarketing],
  });
};

export const huecosFlojos: Resolutor = (c) => {
  const f = c.fuentes.marketing.franjaFloja();
  if (!f) return respuesta(`${NO_LO_TENGO}: aún no hay semanas suficientes para saber qué franja flojea.`);
  const t = c.estado.ahora.getTime();
  const activas = [...visitasPorClienta(c.estado).values()].filter((v) => t - Date.parse(v[v.length - 1].start) < 180 * 86_400_000).length;
  return respuesta(`${f.etiqueta.charAt(0).toUpperCase() + f.etiqueta.slice(1)} estáis al ${f.pct} %. Tienes **${plural(activas, "clienta activa", "clientas activas")}** para ofrecérselo.`, {
    cifras: [{ etiqueta: "ocupación de la franja", valor: f.pct, unidad: "%" }, { etiqueta: "clientas activas", valor: activas, unidad: "clientas" }],
    acciones: [{ ...preparar, etiqueta: "Preparar envío" }],
  });
};

export const segundaVisita: Resolutor = (c) => {
  const s = c.fuentes.marketing.segundaVisita();
  if (!s) return respuesta(`${NO_LO_TENGO}.`);
  if (!s.personas) return respuesta(`Todas las nuevas de los últimos ${s.dias} días **ya han vuelto**. ¡Bien!`);
  return respuesta(`**${plural(s.personas, "clienta", "clientas")}** ${s.personas === 1 ? "vino" : "vinieron"} una sola vez en los últimos ${s.dias} días.`, {
    cifras: [{ etiqueta: "sin segunda visita", valor: s.personas, unidad: "clientas" }],
    acciones: [preparar],
  });
};

export const resenas: Resolutor = (c) => {
  const s = c.fuentes.marketing.resenas();
  if (!s) return respuesta(`${NO_LO_TENGO}.`);
  if (!s.personas) return respuesta(`En los últimos ${s.dias} días no ha venido nadie a quien pedir reseña.`);
  return respuesta(`**${plural(s.personas, "clienta", "clientas")}** ${s.personas === 1 ? "vino" : "vinieron"} en los últimos ${s.dias} días; es buen momento para pedirles la reseña.`, {
    cifras: [{ etiqueta: "para reseña", valor: s.personas, unidad: "clientas" }],
    acciones: [preparar],
  });
};
