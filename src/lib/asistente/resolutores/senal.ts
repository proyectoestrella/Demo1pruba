/** Resolutores de «señal». El estado lo da la fuente: el motor no lo recalcula. */
import { activa, citasDe, cuando, esteMes, rangoDe } from "./calculos";
import { enPeriodo, euros, lista, mayus, NO_LO_TENGO, pila, plural, respuesta, type Contexto, type Resolutor } from "./tipos";
import type { CitaA, SenalCitaA } from "../fuentes";

function conEstado(c: Contexto, citas: CitaA[], estados: SenalCitaA["estado"][]) {
  const out: Array<{ cita: CitaA; s: SenalCitaA }> = [];
  for (const cita of citas) {
    const s = c.fuentes.senal.estado(cita);
    if (s && estados.includes(s.estado)) out.push({ cita, s });
  }
  return out.sort((a, b) => a.cita.start.localeCompare(b.cita.start));
}

function futuras(c: Contexto) {
  const t = c.estado.ahora.getTime() - 86_400_000;
  return c.estado.citas.filter((x) => activa(x) && Date.parse(x.start) > t);
}

function sinRegla(c: Contexto) {
  const r = c.fuentes.senal.regla();
  return !r || !r.activa;
}

export const senalesPendientes: Resolutor = (c) => {
  if (sinRegla(c)) return respuesta("No pides señal: **no esperas ninguna**.", { acciones: [{ tipo: "ver-seccion", etiqueta: "Abrir Ajustes › Señal", destino: "Ajustes › Señal" }] });
  const l = conEstado(c, futuras(c), ["pedida"]);
  if (!l.length) return respuesta("No esperas **ninguna señal** ahora mismo.");
  const items = l.slice(0, 3).map(({ cita, s }) => `${pila(cita.clientName)} (${s.importeEur ? euros(s.importeEur) : "sin importe"}${s.venceISO ? `, antes de ${cuando(s.venceISO, c).replace(/^hoy a /, "")}` : ""})`);
  return respuesta(`Esperas **${plural(l.length, "señal", "señales")}**: ${lista(items)}${l.length > 3 ? ` y ${l.length - 3} más` : ""}.`, {
    cifras: [{ etiqueta: "señales pedidas", valor: l.length, unidad: "señales" }],
  });
};

export const senalesVencidas: Resolutor = (c) => {
  const l = conEstado(c, futuras(c), ["vencida"]);
  if (!l.length) return respuesta("No tienes **ninguna señal vencida**. ¡Bien!");
  const items = l.slice(0, 3).map(({ cita, s }) => `la de ${cita.clientName}${s.importeEur ? ` (${euros(s.importeEur)})` : ""}`);
  return respuesta(`**${plural(l.length, "señal vencida", "señales vencidas")}**: ${lista(items)}. Dale más tiempo o libera el hueco.`, {
    cifras: [{ etiqueta: "señales vencidas", valor: l.length, unidad: "señales" }],
    acciones: [{ tipo: "abrir-cita", etiqueta: "Abrir cita", citaId: l[0].cita.id }],
  });
};

const ESTADO: Record<SenalCitaA["estado"], string> = {
  no_aplica: "no lleva señal",
  por_pedir: "está **por pedir**",
  pedida: "está **pedida**",
  vencida: "está **vencida**",
  recibida: "está **recibida**",
  aplicada: "está **recibida** y descontada",
  devuelta: "está **devuelta**",
  retenida: "se ha **retenido**",
  anulada: "está **anulada**",
};

export const senalCita: Resolutor = (c) => {
  const cl = c.clienta!;
  const t = c.estado.ahora.getTime() - 86_400_000;
  const cita = c.estado.citas.filter((x) => x.clientId === cl.id && activa(x) && Date.parse(x.start) > t).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!cita) return respuesta(`${pila(cl.name)} no tiene ninguna cita próxima, así que no hay señal.`);
  const s = c.fuentes.senal.estado(cita);
  if (!s) return respuesta(`${NO_LO_TENGO}: no sé el estado de la señal de ${pila(cl.name)}.`);
  const imp = s.estado === "pedida" && s.importeEur ? `: ${euros(s.importeEur)}${s.venceISO ? ` antes de ${cuando(s.venceISO, c)}` : ""}. Cuando la veas en tu banco, márcala` : s.estado === "recibida" && s.recibidaEur ? ` (${euros(s.recibidaEur)})` : "";
  return respuesta(`La señal de ${pila(cl.name)} ${ESTADO[s.estado]}${imp}.`, { acciones: [{ tipo: "abrir-cita", etiqueta: "Abrir cita", citaId: cita.id }] });
};

export const reglaSenal: Resolutor = (c) => {
  const r = c.fuentes.senal.regla();
  const ajustes = { tipo: "ver-seccion" as const, etiqueta: "Abrir Ajustes › Señal", destino: "Ajustes › Señal" };
  if (!r) return respuesta(`${NO_LO_TENGO}: no encuentro la configuración de la señal.`, { acciones: [ajustes] });
  if (!r.activa) return respuesta("**No pides señal** ahora mismo. Se activa en Ajustes › Señal.", { acciones: [ajustes] });
  const pol = c.fuentes.senal.politicaCancelacion();
  return respuesta(`Pides **${r.resumen}**.${pol ? ` ${mayus(pol)}` : ""}`.replace(/\.\.$/, "."), { acciones: [ajustes] });
};

export const senalesRecibidas: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const l = conEstado(c, citasDe(c.estado, r), ["recibida", "aplicada"]);
  const total = l.reduce((s, x) => s + (x.s.recibidaEur ?? x.s.importeEur ?? 0), 0);
  if (!l.length) return respuesta(`${mayus(enPeriodo(r.etiqueta))} **no has recibido** ninguna señal.`);
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} has recibido **${plural(l.length, "señal", "señales")}**: ${euros(total)}.`, {
    cifras: [{ etiqueta: "señales recibidas", valor: l.length, unidad: "señales" }, { etiqueta: "importe", valor: total, unidad: "€" }],
  });
};
