/** Resolutores de «clientas». Solo responden con la clienta resuelta: nunca con otra. */
import { diaEnZona as fechaEnZona } from "../reloj";
import { sumarDias } from "../entidades";
import { activa, citasDe, esDeColor, esteMes, etiquetaRelativa, fin, rangoDe, visitasPorClienta } from "./calculos";
import { duracion, enPeriodo, euros, fechaLarga, lista, mayus, NO_LO_TENGO, pct, pila, plural, respuesta, type Contexto, type Resolutor } from "./tipos";

const ficha = (id: string) => ({ tipo: "abrir-ficha" as const, etiqueta: "Abrir ficha", clientaId: id });

function sinFicha(c: Contexto) {
  return respuesta(`${NO_LO_TENGO}: no encuentro la ficha de ${c.clienta!.name}.`);
}

export const ultimaVisitaClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  if (!f) return sinFicha(c);
  const v = f.visitas[0];
  if (!v) return respuesta(`${pila(cl.name)} **aún no ha venido** nunca.`, { acciones: [ficha(cl.id)] });
  const dia = fechaEnZona(v.fecha, c.estado.timeZone);
  const hace = Math.round((Date.parse(c.hoy) - Date.parse(dia)) / 86_400_000);
  const cuanto = hace >= 14 ? ` (hace ${hace >= 60 ? `${Math.round(hace / 7)} semanas` : `${hace} días`})` : "";
  return respuesta(`${cl.name} vino el **${fechaLarga(dia, c.hoy)}**${cuanto}: ${v.servicios.join(" + ") || "sin servicio anotado"} con ${pila(v.profesional)}, ${euros(v.importe)}.`, {
    cifras: [{ etiqueta: "días desde la última visita", valor: hace, unidad: "dias" }],
    acciones: [ficha(cl.id)],
  });
};

export const ultimoColorClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  if (!f) return sinFicha(c);
  const col = f.ultimoColor;
  if (!col?.formula) return respuesta(`${pila(cl.name)} no tiene **ningún color** anotado.`, { acciones: [{ ...ficha(cl.id), etiqueta: "Añadir color" }] });
  return respuesta(`A ${cl.name} le pusiste **${col.formula}** (${fechaLarga(fechaEnZona(col.fecha, c.estado.timeZone), c.hoy)}).`, { acciones: [ficha(cl.id)] });
};

export const frecuenciaClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  if (!f) return sinFicha(c);
  if (!f.frecuenciaMediaDias || f.visitas.length < 2) return respuesta(`${pila(cl.name)} ha venido ${plural(f.visitas.length, "vez", "veces")}: aún no puedo calcular cada cuánto viene.`, { acciones: [ficha(cl.id)] });
  const sem = Math.round(f.frecuenciaMediaDias / 7);
  const cada = sem >= 2 ? `cada ${sem} semanas` : `cada ${Math.round(f.frecuenciaMediaDias)} días`;
  const ult = f.visitas[0] ? Math.round((Date.parse(c.hoy) - Date.parse(fechaEnZona(f.visitas[0].fecha, c.estado.timeZone))) / 86_400_000) : 0;
  const lleva = ult >= 14 ? `; ya lleva ${Math.round(ult / 7)} sin venir` : "";
  const toca = f.proximaCita ? "" : lleva;
  return respuesta(`${pila(cl.name)} viene **${cada}** de media${toca}.`, {
    cifras: [{ etiqueta: "días entre visitas", valor: Math.round(f.frecuenciaMediaDias), unidad: "dias" }],
    acciones: [f.proximaCita ? ficha(cl.id) : { tipo: "nueva-cita", etiqueta: "Dar cita", clientaId: cl.id }],
  });
};

export const gastoClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  if (!f) return sinFicha(c);
  if (!f.visitas.length) return respuesta(`${pila(cl.name)} aún no ha venido: **0 €**.`);
  return respuesta(`${pila(cl.name)} lleva **${euros(f.gastoTotal)}** en ${plural(f.visitas.length, "visita", "visitas")} (${euros(f.gastoUltimos12Meses)} en los últimos 12 meses). Es orientativo, según tus precios.`, {
    cifras: [{ etiqueta: "gasto total", valor: f.gastoTotal, unidad: "€" }, { etiqueta: "últimos 12 meses", valor: f.gastoUltimos12Meses, unidad: "€" }],
    acciones: [ficha(cl.id)],
  });
};

export const datosClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  if (/\bcumple/.test(c.pregunta)) {
    if (!cl.birthday || !/^\d{4}-\d{2}-\d{2}/.test(cl.birthday)) return respuesta(`No tengo apuntado el cumpleaños de ${pila(cl.name)}.`, { acciones: [ficha(cl.id)] });
    return respuesta(`${pila(cl.name)} cumple años el **${fechaLarga(`2000-${cl.birthday.slice(5, 10)}`)}**.`, { acciones: [ficha(cl.id)] });
  }
  if (!cl.phone && !cl.email) return respuesta(`De ${cl.name} no tengo teléfono ni email apuntados.`, { acciones: [ficha(cl.id)] });
  const partes = [cl.phone && `**${cl.phone}**`, cl.email].filter(Boolean);
  return respuesta(`${cl.name}: ${partes.join(" · ")}.`, {
    acciones: [cl.phone ? { tipo: "whatsapp", etiqueta: "WhatsApp", clientaId: cl.id } : ficha(cl.id)],
  });
};

export const notasClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  const notas = [cl.notes?.trim(), ...(f?.avisos ?? [])].filter((x): x is string => !!x);
  if (!notas.length) return respuesta(`De ${pila(cl.name)} **no tienes nada** apuntado.`, { acciones: [ficha(cl.id)] });
  return respuesta(`De ${pila(cl.name)} tienes apuntado: «${notas.join(" · ")}».`, { acciones: [ficha(cl.id)] });
};

export const clientasTotal: Resolutor = (c) =>
  respuesta(`Tienes **${plural(c.estado.clientas.length, "clienta", "clientas")}** en tu cartera.`, {
    cifras: [{ etiqueta: "clientas", valor: c.estado.clientas.length, unidad: "clientas" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Clientas", destino: "Clientas" }],
  });

/** Día de la primera visita de cada clienta. */
function primeras(c: Contexto): Map<string, { dia: string; nombre: string }> {
  const m = new Map<string, { dia: string; nombre: string }>();
  for (const [id, v] of visitasPorClienta(c.estado)) m.set(id, { dia: fechaEnZona(v[0].start, c.estado.timeZone), nombre: v[0].clientName });
  return m;
}

export const clientasNuevas: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const nuevas = [...primeras(c).values()].filter((x) => x.dia >= r.desde && x.dia <= r.hasta).sort((a, b) => b.dia.localeCompare(a.dia));
  if (!nuevas.length) return respuesta(`${mayus(enPeriodo(r.etiqueta))} **no ha venido** ninguna clienta nueva.`);
  const ult = nuevas[0];
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} ${nuevas.length === 1 ? "ha venido" : "han venido"} **${plural(nuevas.length, "clienta nueva", "clientas nuevas")}**. La última fue ${pila(ult.nombre)} el ${Number(ult.dia.slice(8))}.`, {
    cifras: [{ etiqueta: `nuevas ${r.etiqueta}`, valor: nuevas.length, unidad: "clientas" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Clientas › Nuevas", destino: "Clientas › Nuevas" }],
  });
};

export const clientasRecurrentes: Resolutor = (c) => {
  const v = [...visitasPorClienta(c.estado).values()];
  const con = v.length;
  const repiten = v.filter((x) => x.length >= 2);
  if (!con) return respuesta("Aún no hay visitas para saber quién repite.");
  const gaps: number[] = [];
  for (const l of repiten) for (let i = 1; i < l.length; i++) gaps.push((Date.parse(l[i].start) - Date.parse(l[i - 1].start)) / 86_400_000);
  const media = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const vuelven = media ? ` Vuelven cada ${Math.round(media / 7)} semanas de media.` : "";
  return respuesta(`**${repiten.length} de ${con}** repiten (${pct(repiten.length, con)} %).${vuelven}`, {
    cifras: [{ etiqueta: "recurrentes", valor: repiten.length, unidad: "clientas" }, { etiqueta: "con alguna visita", valor: con, unidad: "clientas" }],
  });
};

export const SEMANAS_INACTIVIDAD = 8;
export function inactivas(c: Contexto) {
  const limite = sumarDias(c.hoy, -SEMANAS_INACTIVIDAD * 7);
  const t = c.estado.ahora.getTime();
  const futuras = new Set(c.estado.citas.filter((x) => activa(x) && Date.parse(x.start) > t).map((x) => x.clientId));
  return [...visitasPorClienta(c.estado)].filter(([id, v]) => !futuras.has(id) && fechaEnZona(v[v.length - 1].start, c.estado.timeZone) < limite);
}

export const clientasInactivas: Resolutor = (c) => {
  const n = inactivas(c).length;
  if (!n) return respuesta(`Ninguna clienta lleva más de ${SEMANAS_INACTIVIDAD} semanas sin venir. ¡Bien!`);
  return respuesta(`**${plural(n, "clienta", "clientas")}** ${n === 1 ? "lleva" : "llevan"} más de ${SEMANAS_INACTIVIDAD} semanas sin venir y sin cita. Tienes el mensaje preparado.`, {
    cifras: [{ etiqueta: "inactivas", valor: n, unidad: "clientas" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver campaña", destino: "Marketing" }],
  });
};

export const mejoresClientas: Resolutor = (c) => {
  const gasto = [...visitasPorClienta(c.estado)].map(([id, v]) => ({ id, nombre: v[v.length - 1].clientName, eur: v.reduce((s, x) => s + x.priceEur, 0) }));
  gasto.sort((a, b) => b.eur - a.eur);
  const top = gasto.slice(0, 3);
  if (!top.length) return respuesta("Aún no hay visitas para saberlo.");
  const items = top.map((x, i) => (i === 0 ? `**${x.nombre} (${euros(x.eur)})**` : `${x.nombre} (${euros(x.eur)})`));
  return respuesta(`Tus ${top.length} que más gastan: ${lista(items)}. Es orientativo, según tus precios.`, {
    cifras: top.map((x) => ({ etiqueta: x.nombre, valor: x.eur, unidad: "€" as const })),
    acciones: [{ tipo: "abrir-ficha", etiqueta: `Abrir ficha de ${pila(top[0].nombre)}`, clientaId: top[0].id }],
  });
};

export const colorPendiente: Resolutor = (c) => {
  const t = c.estado.ahora.getTime();
  const proximas = citasDe(c.estado, { desde: c.hoy, hasta: sumarDias(c.hoy, 14), etiqueta: "" }).filter((x) => activa(x) && fin(x) > t && esDeColor(x, c.estado));
  const ids = [...new Set(proximas.map((x) => x.clientId))];
  const faltan = ids.filter((id) => !c.fuentes.fichaClienta(id)?.ultimoColor?.formula);
  if (!ids.length) return respuesta("No hay citas de color en las próximas dos semanas.");
  if (!faltan.length) return respuesta("Todas las clientas de color de las próximas dos semanas **tienen su color** anotado. ¡Bien!");
  return respuesta(`A **${plural(faltan.length, "clienta", "clientas")}** con cita de color en las próximas dos semanas le${faltan.length > 1 ? "s" : ""} falta el color. Apúntalo antes de que lleguen.`, {
    cifras: [{ etiqueta: "color pendiente", valor: faltan.length, unidad: "clientas" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Color pendiente", destino: "Clientas › Color pendiente" }],
  });
};

export const cumpleanos: Resolutor = (c) => {
  const conFecha = c.estado.clientas.filter((x) => x.birthday && /^\d{4}-\d{2}-\d{2}/.test(x.birthday));
  if (!conFecha.length) return respuesta("No tengo el cumpleaños de ninguna clienta: entra al traer tus clientas de tu programa anterior.");
  const r = rangoDe(c, (h) => ({ desde: h, hasta: sumarDias(h, 6), etiqueta: "esta semana" }));
  const hits: Array<{ nombre: string; dia: string }> = [];
  for (let d = r.desde; d <= r.hasta; d = sumarDias(d, 1)) for (const x of conFecha) if (x.birthday!.slice(5, 10) === d.slice(5, 10)) hits.push({ nombre: x.name, dia: d });
  if (!hits.length) return respuesta(`${mayus(enPeriodo(r.etiqueta))} no cumple **ninguna** clienta.`);
  const items = hits.slice(0, 4).map((h) => `${h.nombre} (${etiquetaRelativa(h.dia, c.hoy)})`);
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} ${hits.length === 1 ? "cumple" : "cumplen"} **${lista(items)}**${hits.length > 4 ? ` y ${hits.length - 4} más` : ""}.`, {
    cifras: [{ etiqueta: "cumpleaños", valor: hits.length, unidad: "clientas" }],
  });
};

export const clientasConDeuda: Resolutor = (c) => {
  const rec = c.fuentes.recargo();
  const deben = c.estado.clientas.filter((x) => (x.penaltyEur ?? 0) > 0);
  if (!deben.length) return respuesta(rec && !rec.activo ? "No tienes recargos activos: nadie te debe nada." : "**Nadie** te debe nada.");
  const total = deben.reduce((s, x) => s + (x.penaltyEur ?? 0), 0);
  const items = deben.slice(0, 3).map((x) => `${x.name} (${euros(x.penaltyEur!)})`);
  return respuesta(`**${plural(deben.length, "clienta", "clientas")}** te ${deben.length === 1 ? "debe" : "deben"} ${euros(total)}: ${lista(items)}${deben.length > 3 ? ` y ${deben.length - 3} más` : ""}.`, {
    cifras: [{ etiqueta: "clientas con deuda", valor: deben.length, unidad: "clientas" }, { etiqueta: "deuda total", valor: total, unidad: "€" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Clientas › Me deben", destino: "Clientas › Me deben" }],
  });
};

export const clientaBloqueada: Resolutor = (c) => {
  const cl = c.clienta!;
  const b = c.fuentes.bloqueo(cl.id);
  if (!b) return respuesta(cl.manualBlock ? `${pila(cl.name)} está **bloqueada a mano**.` : `${NO_LO_TENGO}: no sé si ${pila(cl.name)} puede reservar.`, { acciones: [ficha(cl.id)] });
  if (!b.bloqueada) return respuesta(`${pila(cl.name)} **puede reservar** por internet.`);
  return respuesta(`${pila(cl.name)} **no puede reservar** por internet${b.motivo ? `: ${b.motivo}` : ""}.`, { acciones: [ficha(cl.id)] });
};

export const buscarClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  const n = f?.visitas.length ?? 0;
  const ult = f?.visitas[0] ? `, la última el ${fechaLarga(fechaEnZona(f.visitas[0].fecha, c.estado.timeZone), c.hoy)}` : "";
  return respuesta(`Es **${cl.name}**: ${plural(n, "visita", "visitas")}${ult}.`, { acciones: [ficha(cl.id)] });
};

/** «¿cuánto tarda el tinte de Marta?»: la duración recordada, si hay. */
export function duracionDeClienta(c: Contexto, serviceIds: string[]): string {
  if (!c.clienta) return "";
  const d = c.fuentes.fichaClienta(c.clienta.id)?.duracionRecordada?.(serviceIds);
  return d ? ` A ${pila(c.clienta.name)} la última vez le llevó ${duracion(d)}.` : "";
}
