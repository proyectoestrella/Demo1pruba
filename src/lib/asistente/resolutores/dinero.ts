/** Resolutores de «dinero». Cobrado = con paidAt; previsto = confirmadas que aún no empezaron. */
import { sumarDias } from "../entidades";
import { activa, citasDe, dineroDe, esteMes, mesPasado, ocupacion, rangoDe, soloHoy } from "./calculos";
import { enPeriodo, euros, lista, mayus, nombreMes, plural, respuesta, type Contexto, type Resolutor } from "./tipos";

const analitica = { tipo: "ver-seccion" as const, etiqueta: "Ver Analítica", destino: "Analítica" };

export const cobradoPeriodo: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const d = dineroDe(citasDe(c.estado, r), c.estado.ahora);
  const futuro = r.desde > c.hoy;
  if (futuro) return respuesta(`${mayus(enPeriodo(r.etiqueta))} aún no ha llegado: tienes **${euros(d.previsto)} previstos** en ${plural(d.previstas, "cita", "citas")}.`, { cifras: [{ etiqueta: "previsto", valor: d.previsto, unidad: "€" }] });
  if (!d.cobradas && d.porCobrar) return respuesta(`${mayus(enPeriodo(r.etiqueta))} **no has marcado ningún cobro**: hay ${euros(d.porCobrar)} de citas ya hechas sin marcar como cobradas${d.previsto ? ` y ${euros(d.previsto)} de las que faltan` : ""}.`, { cifras: [{ etiqueta: `cobrado ${r.etiqueta}`, valor: 0, unidad: "€" }, { etiqueta: "sin marcar", valor: d.porCobrar, unidad: "€" }], acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Caja del día", destino: "Caja" }] });
  const nv = d.noVino ? ` (${d.noVino} no ${d.noVino === 1 ? "vino" : "vinieron"})` : "";
  // Mismo criterio que Analítica: «por cobrar» = lo del periodo aún sin cobrar,
  // tanto las citas ya hechas como las que faltan.
  const falta = d.porCobrar + d.previsto;
  const pc = falta ? ` Quedan **${euros(falta)} por cobrar**${d.porCobrar && d.previsto ? `: ${euros(d.porCobrar)} de citas ya hechas y ${euros(d.previsto)} de las que faltan` : ""}.` : "";
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} ${r.hasta >= c.hoy ? "llevas cobrados" : "cobraste"} **${euros(d.cobrado)}** en ${plural(d.cobradas, "cita", "citas")}${nv}.${pc}`, {
    cifras: [{ etiqueta: `cobrado ${r.etiqueta}`, valor: d.cobrado, unidad: "€" }, { etiqueta: "citas cobradas", valor: d.cobradas, unidad: "citas" }],
    acciones: [analitica],
  });
};

export const previstoPeriodo: Resolutor = (c) => {
  const r = rangoDe(c, (h) => ({ ...esteMes(h), desde: h }));
  const d = dineroDe(citasDe(c.estado, r), c.estado.ahora);
  return respuesta(`${mayus(enPeriodo(r.etiqueta))} tienes **${euros(d.previsto)} previstos** en ${plural(d.previstas, "cita", "citas")} que aún no han empezado.`, {
    cifras: [{ etiqueta: `previsto ${r.etiqueta}`, valor: d.previsto, unidad: "€" }],
  });
};

export const estimacionMes: Resolutor = (c) => {
  const d = dineroDe(citasDe(c.estado, esteMes(c.hoy)), c.estado.ahora);
  const total = d.cobrado + d.previsto + d.porCobrar;
  const pc = d.porCobrar ? `, ${euros(d.porCobrar)} por cobrar` : "";
  return respuesta(`Este mes llevas ${euros(d.cobrado)} cobrados${pc} y **${euros(d.previsto)} previstos**: unos **${euros(total)}** si todo sigue así. Es una estimación con las citas apuntadas.`, {
    cifras: [{ etiqueta: "estimación del mes", valor: total, unidad: "€" }],
  });
};

export const cobroPorMetodo: Resolutor = (c) => {
  const r = rangoDe(c, soloHoy);
  const m = new Map<string, number>();
  for (const x of citasDe(c.estado, r)) if (x.paidAt && activa(x)) m.set(x.paymentMethod || "sin método", (m.get(x.paymentMethod || "sin método") ?? 0) + x.priceEur);
  if (!m.size) return respuesta(`${mayus(enPeriodo(r.etiqueta))} no hay nada cobrado todavía.`);
  const NOMBRE: Record<string, string> = { card: "tarjeta", tarjeta: "tarjeta", cash: "efectivo", efectivo: "efectivo", bizum: "Bizum", transfer: "transferencia", transferencia: "transferencia" };
  const items = [...m].sort((a, b) => b[1] - a[1]).map(([k, v], i) => (i === 0 ? `**${NOMBRE[k] ?? k} ${euros(v)}**` : `${NOMBRE[k] ?? k} ${euros(v)}`));
  return respuesta(`${mayus(enPeriodo(r.etiqueta))}: ${lista(items)}.`, { cifras: [...m].map(([k, v]) => ({ etiqueta: NOMBRE[k] ?? k, valor: v, unidad: "€" as const })) });
};

/** El tipo de periodo de Analítica que corresponde a la pregunta. */
export function periodoAnalitica(c: Contexto, porDefecto: "semana" | "mes" = "mes") {
  const f = c.e.fecha;
  if (!f) return { tipo: porDefecto, etiqueta: porDefecto === "mes" ? "este mes" : "esta semana" } as const;
  if (f.tipo === "dia") return f.dia === c.hoy ? ({ tipo: "hoy", etiqueta: "hoy" } as const) : ({ tipo: "personalizado", desde: f.dia, hasta: f.dia, etiqueta: f.etiqueta } as const);
  if (f.etiqueta === "esta semana") return { tipo: "semana", etiqueta: "esta semana" } as const;
  if (f.etiqueta === "este mes") return { tipo: "mes", etiqueta: "este mes" } as const;
  return { tipo: "personalizado", desde: f.desde, hasta: f.hasta, etiqueta: f.etiqueta } as const;
}

function nombreAnterior(tipo: string, parcial: boolean): string {
  const base = tipo === "semana" ? "la semana pasada" : tipo === "mes" ? "el mes pasado" : tipo === "hoy" ? "ayer" : "el periodo anterior";
  return parcial && tipo !== "personalizado" ? `${base} a estas alturas` : base;
}

export const compararPeriodos: Resolutor = (c) => {
  const pa = periodoAnalitica(c);
  const r = c.fuentes.resumenPeriodo?.(pa);
  if (r) {
    // Mismas cifras que Analítica: periodo completo frente al anterior recortado al mismo tramo.
    if (r.variacionCitas === null) return respuesta(`${mayus(enPeriodo(pa.etiqueta))} llevas **${plural(r.citas, "cita", "citas")}**; del periodo anterior no tengo datos para comparar.`);
    const v = r.variacionCitas;
    const ant = nombreAnterior(pa.tipo, r.parcial);
    const occ = r.ocupacion !== null && r.ocupacionPrevia !== null ? ` La ocupación está al ${r.ocupacion} % (${ant}, ${r.ocupacionPrevia} %).` : "";
    const animo = v >= 5 ? (pa.tipo === "mes" ? " ¡Buen mes!" : " ¡Bien!") : "";
    return respuesta(`${mayus(enPeriodo(pa.etiqueta))} tienes **${plural(r.citas, "cita", "citas")}**, ${v === 0 ? "las mismas" : `un **${Math.abs(v)} % ${v > 0 ? "más" : "menos"}**`} que ${ant} (${r.citasPrevias}).${occ}${animo}`, {
      cifras: [{ etiqueta: "citas", valor: r.citas, unidad: "citas" }, { etiqueta: "citas antes", valor: r.citasPrevias ?? 0, unidad: "citas" }, { etiqueta: "variación", valor: v, unidad: "%" }],
      acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Analítica", destino: "Analítica" }],
    });
  }
  const f = c.e.fecha;
  const actual = f?.tipo === "periodo" ? { desde: f.desde, hasta: f.hasta, etiqueta: f.etiqueta } : esteMes(c.hoy);
  const esMes = actual.etiqueta === "este mes";
  const prev = esMes ? mesPasado(c.hoy) : { desde: sumarDias(actual.desde, -(Math.round((Date.parse(actual.hasta) - Date.parse(actual.desde)) / 86_400_000) + 1)), hasta: sumarDias(actual.desde, -1), etiqueta: "el periodo anterior" };
  // Comparación justa: el mismo número de días transcurridos.
  const corte = actual.hasta > c.hoy ? c.hoy : actual.hasta;
  const dias = Math.round((Date.parse(corte) - Date.parse(actual.desde)) / 86_400_000);
  const prevCorte = { ...prev, hasta: sumarDias(prev.desde, dias) < prev.hasta ? sumarDias(prev.desde, dias) : prev.hasta };
  const a = citasDe(c.estado, { ...actual, hasta: corte }).filter(activa).length;
  const b = citasDe(c.estado, prevCorte).filter(activa).length;
  const oa = ocupacion(c, { ...actual, hasta: corte });
  const ob = ocupacion(c, prevCorte);
  if (!b) return respuesta(`${mayus(enPeriodo(actual.etiqueta))} llevas **${plural(a, "cita", "citas")}**; del periodo anterior no tengo datos para comparar.`);
  const p = Math.round(((a - b) / b) * 100);
  const occ = oa && ob ? ` y una ocupación del ${oa.pct} % (${prev.etiqueta}, ${ob.pct} %)` : "";
  const animo = p >= 5 ? (esMes ? " ¡Buen mes!" : " ¡Bien!") : "";
  return respuesta(`${mayus(enPeriodo(actual.etiqueta))} llevas un **${Math.abs(p)} % ${p >= 0 ? "más" : "menos"} de citas** que a estas alturas de ${prev.etiqueta}${occ}.${animo}`.replace("de el ", "del "), {
    cifras: [{ etiqueta: "citas ahora", valor: a, unidad: "citas" }, { etiqueta: "citas antes", valor: b, unidad: "citas" }, { etiqueta: "variación", valor: p, unidad: "%" }],
  });
};

export const precioMedio: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const citas = citasDe(c.estado, r).filter((x) => activa(x) && x.status !== "no-show" && x.priceEur > 0);
  if (!citas.length) return respuesta(`${mayus(enPeriodo(r.etiqueta))} no hay citas para calcularlo.`);
  const m = Math.round(citas.reduce((s, x) => s + x.priceEur, 0) / citas.length);
  return respuesta(`Cada cita deja **${euros(m)} de media** ${enPeriodo(r.etiqueta)}, según tarifa.`, { cifras: [{ etiqueta: "precio medio", valor: m, unidad: "€" }] });
};

export const resumenMes: Resolutor = (c) => {
  const r = rangoDe(c, esteMes);
  const d = dineroDe(citasDe(c.estado, r), c.estado.ahora);
  const n = citasDe(c.estado, r).filter(activa).length;
  const o = ocupacion(c, r);
  const nombre = r.etiqueta === "este mes" ? mayus(nombreMes(c.hoy)) : mayus(r.etiqueta);
  return respuesta(`${nombre}: **${euros(d.cobrado)} cobrados**, ${plural(n, "cita", "citas")}${o ? ` y un ${o.pct} % de ocupación` : ""}.`, {
    cifras: [{ etiqueta: "cobrado", valor: d.cobrado, unidad: "€" }, { etiqueta: "citas", valor: n, unidad: "citas" }, ...(o ? [{ etiqueta: "ocupación", valor: o.pct, unidad: "%" as const }] : [])],
    acciones: [{ tipo: "descargar", etiqueta: "Descargar Excel", destino: `${r.desde}/${r.hasta}` }],
  });
};

export const dineroProfesional: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  const r = rangoDe(c, esteMes);
  const d = dineroDe(citasDe(c.estado, r).filter((x) => x.employeeId === pro.id), c.estado.ahora);
  const prev = d.previsto ? ` y ${euros(d.previsto)} previstos${r.etiqueta === "este mes" ? " hasta fin de mes" : ""}` : "";
  return respuesta(`${pro.name.split(" ")[0]} lleva **${euros(d.cobrado)} cobrados** ${enPeriodo(r.etiqueta)}${prev}.`, {
    cifras: [{ etiqueta: "cobrado", valor: d.cobrado, unidad: "€" }, { etiqueta: "previsto", valor: d.previsto, unidad: "€" }],
  });
};

