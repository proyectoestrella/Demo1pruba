/** Resolutores de «servicios». */
import { citasDe, contarServicios, esteMes, rangoDe } from "./calculos";
import { duracionDeClienta } from "./clientas";
import { duracion, enPeriodo, euros, lista, mayus, plural, respuesta, type Resolutor } from "./tipos";

const verServicios = { tipo: "ver-seccion" as const, etiqueta: "Ver Servicios", destino: "Servicios" };
const activos = (s: { active?: boolean }) => s.active !== false;

export const precioServicio: Resolutor = (c) => {
  const s = c.e.servicios;
  if (s.length > 1) return respuesta(`${lista(s.slice(0, 4).map((x) => `${x.name} **${euros(x.priceEur)}**`))}.`, { acciones: [verServicios] });
  return respuesta(`${mayus(s[0].name)} está a **${euros(s[0].priceEur)}** (${duracion(s[0].durationMin)}).`, {
    cifras: [{ etiqueta: s[0].name, valor: s[0].priceEur, unidad: "€" }],
    acciones: [verServicios],
  });
};

export const duracionServicio: Resolutor = (c) => {
  const s = c.e.servicios[0];
  return respuesta(`Según la carta, ${s.name} dura **${duracion(s.durationMin)}**.${duracionDeClienta(c, [s.id])}`, {
    cifras: [{ etiqueta: s.name, valor: s.durationMin, unidad: "min" }],
  });
};

export const servicioMasPedido: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const top = contarServicios(citasDe(c.estado, r), c.estado);
  if (!top.length) return respuesta(`${mayus(enPeriodo(r.etiqueta))} no hay servicios hechos todavía.`);
  const luego = top[1] ? `, luego ${top[1].nombre} (${top[1].veces})` : "";
  return respuesta(`Lo más pedido ${enPeriodo(r.etiqueta)} es **${top[0].nombre}** (${plural(top[0].veces, "vez", "veces")})${luego}.`, {
    cifras: top.slice(0, 3).map((x) => ({ etiqueta: x.nombre, valor: x.veces, unidad: "veces" as const })),
  });
};

export const servicioMasRentable: Resolutor = (c) => {
  const s = c.estado.servicios.filter((x) => activos(x) && x.durationMin > 0 && x.priceEur > 0).map((x) => ({ n: x.name, h: Math.round((x.priceEur / x.durationMin) * 60) })).sort((a, b) => b.h - a.h);
  if (!s.length) return respuesta("No tengo precios y duraciones para calcularlo.");
  const seg = s[1] ? ` ${mayus(s[1].n)}, ${s[1].h} €/h.` : "";
  return respuesta(`El que más deja por hora es **${s[0].n}: ${s[0].h} €/h**.${seg} Según tu carta.`, { cifras: [{ etiqueta: s[0].n, valor: s[0].h, unidad: "€" }] });
};

export const carta: Resolutor = (c) => {
  const s = c.estado.servicios.filter(activos);
  if (!s.length) return respuesta("Aún no tienes servicios en la carta.", { acciones: [verServicios] });
  const items = s.slice(0, 8).map((x) => `${x.name} ${euros(x.priceEur)}`);
  return respuesta(`Tienes **${plural(s.length, "servicio", "servicios")}**: ${lista(items)}${s.length > 8 ? ` y ${s.length - 8} más` : ""}.`, {
    cifras: [{ etiqueta: "servicios", valor: s.length }],
    acciones: [verServicios],
  });
};

export const vecesServicio: Resolutor = (c) => {
  const s = c.e.servicios[0];
  const r = rangoDe(c, esteMes);
  const x = contarServicios(citasDe(c.estado, r), c.estado).find((y) => y.id === s.id);
  const veces = x?.veces ?? 0;
  const eur = x ? `, que ${veces === 1 ? "ha" : "han"} dejado ${euros(x.euros)} según tarifa` : "";
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} llevas **${plural(veces, s.name, s.name)}**${eur}.`.replace(`${veces} ${s.name}`, `${veces} × ${s.name}`), {
    cifras: [{ etiqueta: s.name, valor: veces, unidad: "veces" }],
  });
};

export const dineroServicio: Resolutor = (c) => {
  const s = c.e.servicios[0];
  const r = rangoDe(c, esteMes);
  const x = contarServicios(citasDe(c.estado, r), c.estado).find((y) => y.id === s.id);
  if (!x) return respuesta(`${mayus(s.name)} no se ha hecho ${enPeriodo(r.etiqueta)}: **0 €**.`);
  return respuesta(`${mayus(s.name)} ha dejado **${euros(x.euros)}** ${enPeriodo(r.etiqueta)} (${plural(x.veces, "vez", "veces")}), según tarifa.`, {
    cifras: [{ etiqueta: s.name, valor: x.euros, unidad: "€" }],
  });
};
