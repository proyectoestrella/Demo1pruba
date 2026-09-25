/** Resolutores de «hoy». */
import { sumarDias } from "../entidades";
import {
  activa, citasDelDia, citasDe, cuando, etiquetaRelativa, dineroDe, esDeColor, fin, hora, nombrePro, nombreServicios, ocupacion, soloHoy,
} from "./calculos";
import { duracion, euros, lista, listaConResto, mayus, NO_LO_TENGO, pila, plural, respuesta, type Contexto, type Resolutor } from "./tipos";

const verCalendario = (dia: string) => ({ tipo: "ver-calendario" as const, etiqueta: "Ver calendario", dia });

/** Reparto por profesional: «5 de María, 6 de Sara y 7 de Noelia». */
export function reparto(c: Contexto, citas: { employeeId: string }[]): string {
  const partes = c.estado.equipo
    .map((e) => ({ n: citas.filter((x) => x.employeeId === e.id).length, nombre: pila(e.name) }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} de ${x.nombre}`);
  return lista(partes);
}

export const citasHoy: Resolutor = (c) => {
  const citas = citasDelDia(c.estado, c.hoy);
  if (!citas.length) return respuesta("Hoy no tienes **ninguna cita**.", { acciones: [verCalendario(c.hoy)], cifras: [{ etiqueta: "citas hoy", valor: 0, unidad: "citas" }] });
  const rep = c.estado.equipo.length > 1 ? `: ${reparto(c, citas)}` : "";
  return respuesta(`Hoy tienes **${plural(citas.length, "cita", "citas")}**${rep}.`, {
    cifras: [{ etiqueta: "citas hoy", valor: citas.length, unidad: "citas" }],
    acciones: [verCalendario(c.hoy)],
  });
};

export const citasHoyProfesional: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  const dia = c.e.fecha?.tipo === "dia" ? c.e.fecha.dia : c.hoy;
  const et = etiquetaRelativa(dia, c.hoy);
  const citas = citasDelDia(c.estado, dia).filter((x) => x.employeeId === pro.id);
  const t = c.estado.ahora.getTime();
  const sig = citas.find((x) => Date.parse(x.start) > t);
  const cola = !citas.length ? "" : dia !== c.hoy ? (sig ? `; la primera es ${pila(sig.clientName)} a las ${hora(sig.start, c.estado)}` : "") : sig ? `; la siguiente es ${pila(sig.clientName)} a las ${hora(sig.start, c.estado)}` : "; ya no le queda ninguna por empezar";
  const verbo = dia < c.hoy ? "tuvo" : "tiene";
  return respuesta(`${pila(pro.name)} ${verbo} **${plural(citas.length, "cita", "citas")}** ${et}${cola}.`, {
    cifras: [{ etiqueta: `citas de ${pila(pro.name)} ${et}`, valor: citas.length, unidad: "citas" }],
    acciones: [{ ...verCalendario(dia), profesionalId: pro.id }],
  });
};

export const proximaCita: Resolutor = (c) => {
  const t = c.estado.ahora.getTime();
  let citas = citasDelDia(c.estado, c.hoy).filter((x) => x.status !== "no-show");
  const pro = c.e.profesionales[0];
  if (pro) citas = citas.filter((x) => x.employeeId === pro.id);
  const ahora = citas.filter((x) => Date.parse(x.start) <= t && fin(x) > t);
  const sig = citas.find((x) => Date.parse(x.start) > t);
  const partes: string[] = [];
  if (ahora.length) {
    const quien = ahora.map((x) => `${pila(x.clientName)} con ${nombrePro(x.employeeId, c.estado)}`);
    partes.push(ahora.length === 1 ? `Ahora está **${ahora[0].clientName}** con ${nombrePro(ahora[0].employeeId, c.estado)}` : `Ahora hay **${ahora.length} en el sillón**: ${lista(quien)}`);
  }
  if (sig) {
    const min = Math.round((Date.parse(sig.start) - t) / 60_000);
    const dentro = min < 120 ? `, dentro de ${duracion(min)}` : "";
    partes.push(`${ahora.length ? "la siguiente" : "La siguiente"} es ${ahora.length ? pila(sig.clientName) : `**${sig.clientName}**`} a las ${hora(sig.start, c.estado)}${pro ? "" : ` con ${nombrePro(sig.employeeId, c.estado)}`}${dentro}`);
  }
  if (!partes.length) return respuesta(`Hoy ya no queda ninguna cita${pro ? ` de ${pila(pro.name)}` : ""}.`, { acciones: [verCalendario(sumarDias(c.hoy, 1))] });
  const cita = sig ?? ahora[0];
  return respuesta(`${partes.join("; ")}.`, { acciones: [{ tipo: "abrir-cita", etiqueta: "Abrir cita", citaId: cita.id }] });
};

export const listaCitasHoy: Resolutor = (c) => {
  const t = c.estado.ahora.getTime();
  const quedan = citasDelDia(c.estado, c.hoy).filter((x) => fin(x) > t && x.status !== "no-show");
  if (!quedan.length) return respuesta("Hoy ya no te queda **ninguna cita**.", { acciones: [{ tipo: "ver-hoja", etiqueta: "Ver hoja del día", dia: c.hoy }] });
  const items = quedan.slice(0, 8).map((x) => `${hora(x.start, c.estado)} ${pila(x.clientName)} (${nombreServicios(x, c.estado)})`);
  return respuesta(`Te ${quedan.length === 1 ? "queda" : "quedan"} **${quedan.length}**: ${listaConResto(items, quedan.length)}.`, {
    cifras: [{ etiqueta: "citas que quedan hoy", valor: quedan.length, unidad: "citas" }],
    acciones: [{ tipo: "ver-hoja", etiqueta: "Ver hoja del día", dia: c.hoy }],
  });
};

export function textoHuecos(c: Contexto, dia: string, etiqueta: string, profesionalId?: string, desdeAhora = false) {
  const h = c.fuentes.huecos(dia, { profesionalId });
  if (!h) return respuesta(`${NO_LO_TENGO}: no sé el horario del equipo para calcular los huecos.`, { acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Equipo", destino: "Equipo" }] });
  const t = c.estado.ahora.getTime();
  const libres = desdeAhora ? h.filter((x) => Date.parse(x.hasta) - t >= 30 * 60_000).map((x) => (Date.parse(x.desde) < t ? { ...x, desde: new Date(t).toISOString(), minutos: Math.round((Date.parse(x.hasta) - t) / 60_000) } : x)) : h;
  if (!libres.length) return respuesta(`${mayus(etiqueta)} no queda **ningún hueco**. ¡Día completo!`, { cifras: [{ etiqueta: "huecos", valor: 0, unidad: "huecos" }], acciones: [verCalendario(dia)] });
  const total = libres.reduce((s, x) => s + x.minutos, 0);
  const items = libres.slice(0, 4).map((x) => `${nombrePro(x.profesionalId, c.estado)} ${libres.length > 2 ? "a las" : "de"} ${hora(x.desde, c.estado)}${libres.length > 2 ? "" : ` a ${hora(x.hasta, c.estado)}`}`);
  const resto = libres.length > 4 ? ` y ${libres.length - 4} más` : "";
  const verbo = etiqueta === "hoy" ? "Quedan" : `${mayus(etiqueta)} hay`;
  return respuesta(`${verbo} **${plural(libres.length, "hueco", "huecos")}** (${duracion(total)} en total): ${lista(items)}${resto}.`, {
    cifras: [{ etiqueta: "huecos", valor: libres.length, unidad: "huecos" }, { etiqueta: "minutos libres", valor: total, unidad: "min" }],
    acciones: [{ tipo: "nueva-cita", etiqueta: "Nueva cita", dia, profesionalId }],
  });
}

export const huecosHoy: Resolutor = (c) => textoHuecos(c, c.hoy, "hoy", c.e.profesionales[0]?.id, true);

export const ocupacionHoy: Resolutor = (c) => {
  const o = ocupacion(c, soloHoy(c.hoy));
  if (!o) return respuesta(`${NO_LO_TENGO}: me falta el horario del equipo.`);
  const caben = Math.floor(o.libres / 60);
  const extra = o.pct >= 95 ? " ¡Día completo!" : caben ? ` Aún caben unas ${caben} citas de una hora.` : "";
  return respuesta(`La agenda de hoy está al **${o.pct} %**.${extra}`, { cifras: [{ etiqueta: "ocupación hoy", valor: o.pct, unidad: "%" }] });
};

export const ingresosHoy: Resolutor = (c) => {
  const d = dineroDe(citasDelDia(c.estado, c.hoy), c.estado.ahora);
  const total = d.cobrado + d.previsto + d.porCobrar;
  if (!total) return respuesta("Hoy no hay nada cobrado ni previsto.");
  const quedan = d.previsto + d.porCobrar;
  return respuesta(`Hoy llevas **${euros(d.cobrado)} cobrados** de ${euros(total)}${quedan ? `; quedan ${euros(quedan)} por cobrar` : ". ¡Todo cobrado!"}.`, {
    cifras: [{ etiqueta: "cobrado hoy", valor: d.cobrado, unidad: "€" }, { etiqueta: "total del día", valor: total, unidad: "€" }],
  });
};

/** Citas que ya terminaron y siguen sin desenlace (ni hecha, ni cobrada, ni plantón). */
export function sinMarcar(c: Contexto) {
  const t = c.estado.ahora.getTime();
  return citasDe(c.estado, { desde: sumarDias(c.hoy, -30), hasta: c.hoy, etiqueta: "" })
    .filter((x) => activa(x) && (x.status === "confirmed" || x.status === "pending" || x.status === "late") && !x.paidAt && fin(x) <= t);
}

function solicitudes(c: Contexto) {
  const t = c.estado.ahora.getTime();
  return c.estado.citas.filter((x) => x.status === "pending" && fin(x) > t).sort((a, b) => a.start.localeCompare(b.start));
}

export const pendienteDeTi: Resolutor = (c) => {
  const sol = solicitudes(c).length;
  const marcar = sinMarcar(c).length;
  const vencidas = c.estado.citas.filter((x) => Date.parse(x.start) > c.estado.ahora.getTime() && activa(x) && c.fuentes.senal.estado(x)?.estado === "vencida").length;
  const partes = [
    sol && plural(sol, "solicitud por confirmar", "solicitudes por confirmar"),
    marcar && plural(marcar, "cita por marcar", "citas por marcar"),
    vencidas && plural(vencidas, "señal vencida", "señales vencidas"),
  ].filter(Boolean) as string[];
  const total = sol + marcar + vencidas;
  if (!total) return respuesta("No tienes **nada pendiente**. ¡Todo al día!");
  const empieza = sol ? " Empieza por las solicitudes." : "";
  return respuesta(`Tienes **${plural(total, "cosa", "cosas")}**: ${lista(partes)}.${empieza}`, {
    cifras: [{ etiqueta: "pendientes", valor: total }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Hoy", destino: "Hoy" }],
  });
};

export const solicitudesPendientes: Resolutor = (c) => {
  const s = solicitudes(c);
  if (!s.length) return respuesta("No tienes **ninguna solicitud** por confirmar.");
  const conDia = s.slice(0, 4).map((x) => `${pila(x.clientName)} (${cuando(x.start, c).replace(" a las", "")})`);
  const resto = s.length > 4 ? ` y ${s.length - 4} más` : "";
  return respuesta(`Tienes **${plural(s.length, "solicitud", "solicitudes")}**: ${lista(conDia)}${resto}.`, {
    cifras: [{ etiqueta: "solicitudes", valor: s.length }],
    acciones: [{ tipo: "abrir-cita", etiqueta: "Confirmar la primera", citaId: s[0].id }],
  });
};

export const porMarcar: Resolutor = (c) => {
  const s = sinMarcar(c).sort((a, b) => a.start.localeCompare(b.start));
  if (!s.length) return respuesta("No te falta **ninguna** por marcar. ¡Al día!");
  const vieja = s[0];
  return respuesta(`Te ${s.length === 1 ? "falta" : "faltan"} **${s.length} por marcar**, la más antigua: ${cuando(vieja.start, c)} (${pila(vieja.clientName)}).`, {
    cifras: [{ etiqueta: "por marcar", valor: s.length }],
    acciones: [{ tipo: "abrir-cita", etiqueta: "Marcar ahora", citaId: vieja.id }],
  });
};

export const coloresHoy: Resolutor = (c) => {
  const citas = citasDelDia(c.estado, c.hoy).filter((x) => esDeColor(x, c.estado));
  if (!citas.length) return respuesta("Hoy **no hay** ninguna cita de color.");
  const vistos = new Set<string>();
  const con: string[] = [];
  const sin: string[] = [];
  for (const x of citas) {
    if (vistos.has(x.clientId)) continue;
    vistos.add(x.clientId);
    const f = c.fuentes.fichaClienta(x.clientId);
    if (f?.ultimoColor?.formula) con.push(`A ${x.clientName} le pusiste ${f.ultimoColor.formula}`);
    else sin.push(x.clientName);
  }
  const partes = [con.slice(0, 3).join(". ")];
  if (sin.length) partes.push(`A ${lista(sin.slice(0, 3))} le${sin.length > 1 ? "s" : ""} falta el color anotado`);
  return respuesta(`Hoy hay **${plural(citas.length, "cita de color", "citas de color")}**. ${partes.filter(Boolean).join(". ")}.`, {
    cifras: [{ etiqueta: "citas de color hoy", valor: citas.length, unidad: "citas" }],
    acciones: [{ tipo: "ver-hoja", etiqueta: "Ver hoja del día", dia: c.hoy }],
  });
};
