/** Resolutores de «agenda». */
import { sumarDias } from "../entidades";
import {
  activa, citasDe, citasDelDia, cuando, estaSemana, esteMes, etiquetaRelativa, hora, nombrePro, ocupacion, porDia, rangoDe,
} from "./calculos";
import { periodoAnalitica } from "./dinero";
import { reparto, textoHuecos } from "./hoy";
import { duracion, enPeriodo, lista, listaConResto, mayus, NO_LO_TENGO, pct, pila, plural, respuesta, type Contexto, type Rango, type Resolutor } from "./tipos";

function diaPedido(c: Contexto): string {
  const f = c.e.fecha;
  return f?.tipo === "dia" ? f.dia : f?.tipo === "periodo" ? f.desde : c.hoy;
}

export const citasDia: Resolutor = (c) => {
  const dia = diaPedido(c);
  const et = etiquetaRelativa(dia, c.hoy);
  const citas = citasDelDia(c.estado, dia);
  const abre = c.fuentes.aperturaDelDia(dia);
  if (!citas.length) {
    const cerrado = abre && !abre.trabaja ? " Ese día está cerrado." : "";
    return respuesta(`${mayus(et)} no tienes **ninguna cita**.${cerrado}`, { acciones: [{ tipo: "ver-calendario", etiqueta: "Ver ese día", dia }] });
  }
  const rango = ` de ${hora(citas[0].start, c.estado)} a ${hora(new Date(Math.max(...citas.map((x) => Date.parse(x.start) + x.duration * 60_000))).toISOString(), c.estado)}`;
  return respuesta(`${mayus(et)} tienes **${plural(citas.length, "cita", "citas")}**,${rango}.`, {
    cifras: [{ etiqueta: `citas ${et}`, valor: citas.length, unidad: "citas" }],
    acciones: [{ tipo: "ver-calendario", etiqueta: "Ver ese día", dia }],
  });
};

export const citasManana: Resolutor = (c) => {
  const dia = sumarDias(c.hoy, 1);
  const citas = citasDelDia(c.estado, dia);
  const hoja = { tipo: "ver-hoja" as const, etiqueta: "Ver hoja de mañana", dia };
  if (!citas.length) return respuesta("Mañana no tienes **ninguna cita**.", { acciones: [hoja] });
  const p = citas[0];
  return respuesta(`Mañana tienes **${plural(citas.length, "cita", "citas")}**; la primera es ${pila(p.clientName)} a las ${hora(p.start, c.estado)} con ${nombrePro(p.employeeId, c.estado)}.`, {
    cifras: [{ etiqueta: "citas mañana", valor: citas.length, unidad: "citas" }],
    acciones: [hoja],
  });
};

export const huecosDia: Resolutor = (c) => {
  const dia = diaPedido(c);
  return textoHuecos(c, dia, etiquetaRelativa(dia, c.hoy), c.e.profesionales[0]?.id, dia === c.hoy);
};

/** Primer hueco de al menos `min` minutos desde ahora, en los próximos 60 días. */
function primerHueco(c: Contexto, min: number, profesionalId?: string, desde = c.hoy) {
  const t = c.estado.ahora.getTime();
  for (let i = 0, d = desde; i < 60; i++, d = sumarDias(d, 1)) {
    const h = c.fuentes.huecos(d, { profesionalId, minMinutos: min });
    if (h === null) return null;
    const ok = h
      .map((x) => (Date.parse(x.desde) < t ? { ...x, desde: new Date(Math.ceil(t / 900_000) * 900_000).toISOString() } : x))
      .filter((x) => (Date.parse(x.hasta) - Date.parse(x.desde)) / 60_000 >= min)
      .sort((a, b) => a.desde.localeCompare(b.desde));
    if (ok.length) return ok[0];
  }
  return undefined;
}

export const primerHuecoServicio: Resolutor = (c) => {
  const sv = c.e.servicios[0];
  const pro = c.e.profesionales[0];
  const desde = c.e.fecha?.tipo === "dia" ? c.e.fecha.dia : c.e.fecha?.tipo === "periodo" ? c.e.fecha.desde : c.hoy;
  const h = primerHueco(c, sv.durationMin, pro?.id, desde < c.hoy ? c.hoy : desde);
  if (h === null) return respuesta(`${NO_LO_TENGO}: me falta el horario del equipo.`);
  if (!h) return respuesta(`No veo hueco para ${sv.name} (${duracion(sv.durationMin)}) en los próximos 60 días${pro ? ` con ${pila(pro.name)}` : ""}.`);
  return respuesta(`${mayus(sv.name)} (${duracion(sv.durationMin)}) cabe **${cuando(h.desde, c)}** con ${nombrePro(h.profesionalId, c.estado)}.`, {
    acciones: [{ tipo: "nueva-cita", etiqueta: "Dar la cita", dia: h.desde.slice(0, 10), profesionalId: h.profesionalId }],
  });
};

export const huecoProfesional: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  if (c.e.fecha?.tipo === "dia") return textoHuecos(c, c.e.fecha.dia, etiquetaRelativa(c.e.fecha.dia, c.hoy), pro.id, c.e.fecha.dia === c.hoy);
  const h = primerHueco(c, 30, pro.id);
  if (h === null) return respuesta(`${NO_LO_TENGO}: me falta el horario de ${pila(pro.name)}.`);
  if (!h) return respuesta(`${pila(pro.name)} no tiene huecos en los próximos 60 días.`);
  const sem = estaSemana(c.hoy);
  let quedan = 0;
  const t = c.estado.ahora.getTime();
  for (let d = c.hoy; d <= sem.hasta; d = sumarDias(d, 1)) quedan += (c.fuentes.huecos(d, { profesionalId: pro.id }) ?? []).filter((x) => Date.parse(x.hasta) > t).length;
  return respuesta(`${pila(pro.name)} tiene el primer hueco **${cuando(h.desde, c)}** (${duracion(h.minutos)}). Esta semana le ${quedan === 1 ? "queda 1 hueco" : `quedan ${quedan} huecos`}.`, {
    acciones: [{ tipo: "ver-calendario", etiqueta: `Ver calendario de ${pila(pro.name)}`, profesionalId: pro.id, dia: h.desde.slice(0, 10) }],
  });
};

/** El mismo tramo del periodo anterior («esta semana» → la pasada). */
export function anterior(r: Rango): Rango {
  const n = Math.round((Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000) + 1;
  return { desde: sumarDias(r.desde, -n), hasta: sumarDias(r.desde, -1), etiqueta: "el anterior" };
}

export function comparacion(ahora: number, antes: number, nombre: string): string {
  if (!antes) return "";
  const p = Math.round(((ahora - antes) / antes) * 100);
  if (p === 0) return `, igual que ${nombre}`;
  return `, un ${Math.abs(p)} % ${p > 0 ? "más" : "menos"} que ${nombre}`;
}

function nombreAnterior(r: Rango): string {
  if (r.etiqueta === "esta semana") return "la pasada";
  if (r.etiqueta === "este mes") return "el mes pasado";
  if (r.etiqueta === "hoy") return "ayer";
  return "el periodo anterior";
}

export const citasPeriodo: Resolutor = (c) => {
  // Con la fuente de Analítica, las mismas cifras que su tarjeta de citas.
  const pa = periodoAnalitica(c, "semana");
  const ra = pa.tipo !== "personalizado" || pa.hasta <= c.hoy ? c.fuentes.resumenPeriodo?.(pa) : null;
  if (ra) {
    const ant = pa.tipo === "semana" ? "la semana pasada" : pa.tipo === "mes" ? "el mes pasado" : pa.tipo === "hoy" ? "ayer" : "el periodo anterior";
    const cmp = ra.variacionCitas === null ? "" : ra.variacionCitas === 0 ? `, las mismas que ${ant}${ra.parcial ? " a estas alturas" : ""}` : `, un ${Math.abs(ra.variacionCitas)} % ${ra.variacionCitas > 0 ? "más" : "menos"} que ${ant}${ra.parcial ? " a estas alturas" : ""}`;
    return respuesta(`${mayus(enPeriodo(pa.etiqueta))} tienes **${plural(ra.citas, "cita", "citas")}**${cmp}.`, {
      cifras: [{ etiqueta: `citas ${pa.etiqueta}`, valor: ra.citas, unidad: "citas" }],
      acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Analítica", destino: "Analítica" }],
    });
  }
  const r = rangoDe(c, estaSemana);
  const n = citasDe(c.estado, r).filter(activa).length;
  const antes = citasDe(c.estado, anterior(r)).filter(activa).length;
  const futuro = r.desde > c.hoy;
  const verbo = futuro || r.hasta > c.hoy ? "tienes" : "tuviste";
  const cmp = futuro ? "" : comparacion(n, antes, nombreAnterior(r));
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} ${r.desde <= c.hoy && r.hasta >= c.hoy ? "llevas" : verbo} **${plural(n, "cita", "citas")}**${cmp}.`, {
    cifras: [{ etiqueta: `citas ${r.etiqueta}`, valor: n, unidad: "citas" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Analítica", destino: "Analítica" }],
  });
};

export const ocupacionPeriodo: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const o = ocupacion(c, r);
  if (!o) return respuesta(`${NO_LO_TENGO}: me falta el horario del equipo.`);
  const por = c.estado.equipo
    .map((e) => ({ n: pila(e.name), o: ocupacion(c, r, e.id) }))
    .filter((x) => x.o)
    .sort((a, b) => b.o!.pct - a.o!.pct)
    .map((x) => `${x.n} ${x.o!.pct} %`);
  const det = por.length > 1 ? `: ${lista(por)}` : "";
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} estáis al **${o.pct} %**${det}.`, { cifras: [{ etiqueta: `ocupación ${r.etiqueta}`, valor: o.pct, unidad: "%" }] });
};

export const proximaCitaClienta: Resolutor = (c) => {
  const cl = c.clienta!;
  const t = c.estado.ahora.getTime();
  const prox = c.estado.citas.filter((x) => x.clientId === cl.id && activa(x) && Date.parse(x.start) > t).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!prox) return respuesta(`${pila(cl.name)} no tiene **ninguna cita** apuntada.`, { acciones: [{ tipo: "nueva-cita", etiqueta: "Dar cita", clientaId: cl.id }] });
  const sv = prox.serviceIds.map((id) => c.estado.servicios.find((s) => s.id === id)?.name).filter(Boolean).join(" + ");
  return respuesta(`${cl.name} viene **${cuando(prox.start, c)}**${sv ? ` a ${sv}` : ""} con ${nombrePro(prox.employeeId, c.estado)}.`, {
    acciones: [{ tipo: "abrir-ficha", etiqueta: "Abrir ficha", clientaId: cl.id }],
  });
};

export const recordatoriosManana: Resolutor = (c) => {
  const dia = sumarDias(c.hoy, 1);
  const citas = citasDelDia(c.estado, dia);
  const faltan = citas.filter((x) => !x.reminderSentAt).length;
  const hoja = { tipo: "ver-hoja" as const, etiqueta: "Ver hoja de mañana", dia };
  if (!citas.length) return respuesta("Mañana no hay citas: no hay recordatorios que mandar.");
  if (!faltan) return respuesta(`Ya has mandado **todos** los recordatorios de mañana (${citas.length}). ¡Bien!`, { acciones: [hoja] });
  return respuesta(`Te ${faltan === 1 ? "falta" : "faltan"} **${plural(faltan, "recordatorio", "recordatorios")}** para mañana. Se mandan uno a uno desde tu WhatsApp.`, {
    cifras: [{ etiqueta: "recordatorios pendientes", valor: faltan }],
    acciones: [hoja],
  });
};

export const listaEspera: Resolutor = (c) => {
  let l = c.estado.listaEspera;
  const sv = c.e.servicios[0];
  const pro = c.e.profesionales[0];
  if (!l.length) return respuesta("La lista de espera está **vacía**.", { acciones: [{ tipo: "ver-seccion", etiqueta: "Ver lista de espera", destino: "Lista de espera" }] });
  const total = l.length;
  if (sv) l = l.filter((x) => x.serviceId === sv.id);
  if (pro) l = l.filter((x) => x.preferredEmployeeId === pro.id);
  const filtro = sv || pro ? `para ${[sv?.name, pro && pila(pro.name)].filter(Boolean).join(" con ")}` : "";
  const items = l.slice(0, 3).map((x) => `${x.clientName}${x.preferredRange ? ` (${x.preferredRange.charAt(0).toLowerCase()}${x.preferredRange.slice(1)})` : ""}`);
  const detalle = !filtro ? `: ${listaConResto(items, l.length)}` : items.length ? `; ${filtro} ${l.length === 1 ? "está" : "están"} ${listaConResto(items, l.length)}` : `, pero ninguna ${filtro}`;
  return respuesta(`Hay **${total} en lista de espera**${detalle}.`, {
    cifras: [{ etiqueta: "en lista de espera", valor: total }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver lista de espera", destino: "Lista de espera" }],
  });
};

export const franjaFloja: Resolutor = (c) => {
  const f = c.fuentes.marketing.franjaFloja();
  if (!f) return respuesta(`${NO_LO_TENGO}: aún no hay semanas suficientes para saber qué franja flojea.`);
  return respuesta(`Tu franja más floja es **${f.etiqueta}** (${f.pct} % de ocupación). Puedes llenarla con una campaña.`, {
    cifras: [{ etiqueta: "ocupación de la franja", valor: f.pct, unidad: "%" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Marketing", destino: "Marketing" }],
  });
};

export const diaMasLleno: Resolutor = (c) => {
  const r = rangoDe(c, estaSemana);
  const m = porDia(c.estado);
  let mejor = { dia: "", n: 0 };
  for (let d = r.desde; d <= r.hasta; d = sumarDias(d, 1)) {
    const n = (m.get(d) ?? []).filter(activa).length;
    if (n > mejor.n) mejor = { dia: d, n };
  }
  if (!mejor.n) return respuesta(`${mayus(enPeriodo(r.etiqueta))} no hay citas.`);
  return respuesta(`El día con más citas ${enPeriodo(r.etiqueta)} es **${etiquetaRelativa(mejor.dia, c.hoy)}** (${plural(mejor.n, "cita", "citas")}).`, {
    cifras: [{ etiqueta: "citas del día más lleno", valor: mejor.n, unidad: "citas" }],
    acciones: [{ tipo: "ver-calendario", etiqueta: "Ver ese día", dia: mejor.dia }],
  });
};

export const cancelaciones: Resolutor = (c) => {
  const r = rangoDe(c, estaSemana);
  const todas = citasDe(c.estado, r).filter((x) => x.status !== "blocked");
  const n = todas.filter((x) => x.status === "cancelled").length;
  const p = pct(n, todas.length);
  const animo = n === 0 ? " ¡Bien!" : "";
  return respuesta(`${mayus(enPeriodo(r.etiqueta))}, **${plural(n, "cancelación", "cancelaciones")}**${n ? ` (un ${p} % de las citas)` : ""}.${animo}`, {
    cifras: [{ etiqueta: `cancelaciones ${r.etiqueta}`, valor: n, unidad: "citas" }],
  });
};

export const plantones: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const nv = citasDe(c.estado, r).filter((x) => x.status === "no-show");
  const tresMeses = citasDe(c.estado, { desde: sumarDias(c.hoy, -90), hasta: c.hoy, etiqueta: "" }).filter((x) => x.status === "no-show");
  const cuenta = new Map<string, { nombre: string; n: number; id: string }>();
  for (const x of tresMeses) {
    const v = cuenta.get(x.clientId) ?? { nombre: x.clientName, n: 0, id: x.clientId };
    v.n++;
    cuenta.set(x.clientId, v);
  }
  const peor = [...cuenta.values()].sort((a, b) => b.n - a.n)[0];
  const cola = peor && peor.n > 1 ? ` Quien más falla es ${peor.nombre} (${peor.n} veces en 3 meses).` : "";
  if (!nv.length) return respuesta(`${mayus(enPeriodo(r.etiqueta))}, **nadie ha faltado**. ¡Bien!${cola}`);
  const quienes = nv.length <= 3 ? `: ${lista(nv.map((x) => pila(x.clientName)))}` : "";
  return respuesta(`${mayus(enPeriodo(r.etiqueta))}, **${nv.length} no ${nv.length === 1 ? "vino" : "vinieron"}**${quienes}.${cola}`, {
    cifras: [{ etiqueta: `plantones ${r.etiqueta}`, valor: nv.length, unidad: "citas" }],
    acciones: peor && peor.n > 1 ? [{ tipo: "abrir-ficha", etiqueta: "Abrir ficha", clientaId: peor.id }] : [],
  });
};
