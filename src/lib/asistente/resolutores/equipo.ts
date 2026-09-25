/** Resolutores de «equipo». */
import { activa, citasDe, contarServicios, esteMes, etiquetaRelativa, ocupacion, rangoDe } from "./calculos";
import { enPeriodo, lista, mayus, NO_LO_TENGO, pila, plural, respuesta, type Resolutor } from "./tipos";

export const horarioProfesional: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  const h = c.fuentes.horarioResumen(pro.id);
  if (!h) return respuesta(`${NO_LO_TENGO}: no tengo el horario de ${pila(pro.name)}.`, { acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Equipo", destino: "Equipo" }] });
  return respuesta(`${pila(pro.name)} trabaja **${h}**.`, { acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Equipo", destino: "Equipo" }] });
};

export const quienTrabaja: Resolutor = (c) => {
  const dia = c.e.fecha?.tipo === "dia" ? c.e.fecha.dia : c.e.fecha?.tipo === "periodo" ? c.e.fecha.desde : c.hoy;
  const et = etiquetaRelativa(dia, c.hoy);
  const j = c.estado.equipo.map((e) => ({ e, j: c.fuentes.jornada(e.id, dia) }));
  if (j.every((x) => !x.j)) return respuesta(`${NO_LO_TENGO}: me falta el horario del equipo.`);
  const si = j.filter((x) => x.j?.trabaja);
  if (!si.length) return respuesta(`${mayus(et)} **no trabaja nadie**: está cerrado.`);
  const franjas = (x: (typeof si)[number]) => x.j!.franjas.map((f) => `${f.desde.replace(/^0/, "")}–${f.hasta.replace(/^0/, "")}`).join(" y ");
  const iguales = si.every((x) => franjas(x) === franjas(si[0]));
  if (si.length === c.estado.equipo.length && iguales) {
    const todas = si.length === 2 ? "las dos" : si.length === 3 ? "las tres" : si.length === 4 ? "las cuatro" : `las ${si.length}`;
    return respuesta(`${mayus(et)} trabajáis **${si.length === 1 ? "solo tú" : todas}**, de ${franjas(si[0]).replace("–", " a ")}.`);
  }
  return respuesta(`${mayus(et)} trabaja${si.length > 1 ? "n" : ""} **${lista(si.map((x) => pila(x.e.name)))}**: ${si.map((x) => `${pila(x.e.name)} ${franjas(x)}`).join(", ")}.`);
};

export const citasProfesionalPeriodo: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  const r = rangoDe(c, esteMes);
  const citas = citasDe(c.estado, r).filter(activa);
  const n = citas.filter((x) => x.employeeId === pro.id).length;
  const otras = c.estado.equipo.filter((e) => e.id !== pro.id).map((e) => ({ n: citas.filter((x) => x.employeeId === e.id).length, nombre: pila(e.name) })).sort((a, b) => b.n - a.n);
  const cmp = otras[0] ? (n > otras[0].n ? `, ${n - otras[0].n} más que ${otras[0].nombre}` : n < otras[0].n ? `, ${otras[0].n - n} menos que ${otras[0].nombre}` : `, las mismas que ${otras[0].nombre}`) : "";
  const verbo = r.desde > c.hoy ? "tiene" : r.hasta < c.hoy ? "tuvo" : "lleva";
  return respuesta(`${pila(pro.name)} ${verbo} **${plural(n, "cita", "citas")}** ${enPeriodo(r.etiqueta)}${cmp}.`, {
    cifras: [{ etiqueta: `citas de ${pila(pro.name)}`, valor: n, unidad: "citas" }],
    acciones: [{ tipo: "ver-seccion", etiqueta: "Ver Equipo", destino: "Equipo" }],
  });
};

export const ocupacionProfesional: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  const r = rangoDe(c, esteMes);
  const o = ocupacion(c, r, pro.id);
  if (!o) return respuesta(`${NO_LO_TENGO}: me falta el horario de ${pila(pro.name)}.`);
  const otras = c.estado.equipo.filter((e) => e.id !== pro.id).map((e) => ({ n: pila(e.name), o: ocupacion(c, r, e.id) })).filter((x) => x.o).sort((a, b) => a.o!.pct - b.o!.pct);
  const libre = otras[0] && otras[0].o!.pct < o.pct ? `; la más libre es ${otras[0].n} (${otras[0].o!.pct} %)` : "";
  return respuesta(`${pila(pro.name)} está al **${o.pct} %** ${enPeriodo(r.etiqueta)}${libre}.`, { cifras: [{ etiqueta: `ocupación de ${pila(pro.name)}`, valor: o.pct, unidad: "%" }] });
};

export const loQueMasHace: Resolutor = (c) => {
  const pro = c.e.profesionales[0];
  const r = rangoDe(c, (h) => ({ ...esteMes(h), desde: new Date(Date.parse(h) - 29 * 86_400_000).toISOString().slice(0, 10), hasta: h, etiqueta: "los últimos 30 días" }));
  const top = contarServicios(citasDe(c.estado, r).filter((x) => x.employeeId === pro.id), c.estado);
  if (!top.length) return respuesta(`${pila(pro.name)} no tiene servicios ${enPeriodo(r.etiqueta)}.`);
  const luego = top.slice(1, 3).map((x) => x.nombre);
  return respuesta(`A ${pila(pro.name)} lo que más le piden es **${top[0].nombre}** (${plural(top[0].veces, "vez", "veces")} ${enPeriodo(r.etiqueta)})${luego.length ? `, luego ${lista(luego)}` : ""}.`, {
    cifras: [{ etiqueta: top[0].nombre, valor: top[0].veces, unidad: "veces" }],
  });
};

export const profesionalHabitual: Resolutor = (c) => {
  const cl = c.clienta!;
  const f = c.fuentes.fichaClienta(cl.id);
  if (!f?.profesionalHabitual) return respuesta(`${pila(cl.name)} aún no tiene una profesional habitual.`);
  return respuesta(`${pila(cl.name)} va casi siempre con **${pila(f.profesionalHabitual)}**.`, { acciones: [{ tipo: "abrir-ficha", etiqueta: "Abrir ficha", clientaId: cl.id }] });
};
