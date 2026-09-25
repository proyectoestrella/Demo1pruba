/** Resolutores de «configuración» y «ayuda». */
import { etiquetaRelativa, hora, minutos } from "./calculos";
import { euros, lista, mayus, NO_LO_TENGO, respuesta, type Resolutor } from "./tipos";

const ajustes = (destino: string, etiqueta = `Abrir ${destino}`) => ({ tipo: "ver-seccion" as const, etiqueta, destino });

export const abiertoAhora: Resolutor = (c) => {
  const dia = c.e.fecha?.tipo === "dia" ? c.e.fecha.dia : c.hoy;
  const j = c.fuentes.aperturaDelDia(dia);
  if (!j) return respuesta(`${NO_LO_TENGO}: no tengo el horario del salón.`, { acciones: [ajustes("Mi página", "Cambiar en Mi página")] });
  const et = etiquetaRelativa(dia, c.hoy);
  if (!j.trabaja || !j.franjas.length) return respuesta(`No, ${et} ${c.estado.salonNombre} está **cerrado**.`);
  const ultima = j.franjas[j.franjas.length - 1].hasta;
  if (dia === c.hoy) {
    const ahora = minutos(hora(c.estado.ahora.toISOString(), c.estado));
    const abierto = j.franjas.some((f) => ahora >= minutos(f.desde) && ahora < minutos(f.hasta));
    if (abierto) return respuesta(`Sí, hoy abrís hasta las **${ultima.replace(/^0/, "")}**.`);
    const luego = j.franjas.find((f) => minutos(f.desde) > ahora);
    if (luego) return respuesta(`Ahora está cerrado; hoy abrís a las **${luego.desde.replace(/^0/, "")}**.`);
    return respuesta(`Ya habéis cerrado: hoy abríais hasta las **${ultima.replace(/^0/, "")}**.`);
  }
  return respuesta(`Sí, ${et} abrís de **${lista(j.franjas.map((f) => `${f.desde.replace(/^0/, "")} a ${f.hasta.replace(/^0/, "")}`))}**.`);
};

export const horarioSalon: Resolutor = (c) => {
  const h = c.fuentes.horarioResumen();
  if (!h) return respuesta(`${NO_LO_TENGO}: no tengo el horario del salón.`, { acciones: [ajustes("Mi página", "Cambiar en Mi página")] });
  return respuesta(`${c.estado.salonNombre} abre **${h}**.`, { acciones: [ajustes("Mi página", "Cambiar en Mi página")] });
};

export const enlaceReservas: Resolutor = (c) => {
  const e = c.fuentes.enlaceReservas();
  if (!e) return respuesta(`${NO_LO_TENGO}: tu página aún no tiene enlace.`);
  return respuesta(`Tu página es **${e}**.`, { acciones: [{ tipo: "copiar", etiqueta: "Copiar enlace", destino: e }] });
};

export const politicaCancelacion: Resolutor = (c) => {
  const p = c.fuentes.senal.politicaCancelacion();
  const faq = ajustes("Mi página › Preguntas frecuentes", "Cambiar en Mi página");
  if (!p) return respuesta("Tu web **no dice nada** sobre cancelar. Puedes añadirlo en las preguntas frecuentes.", { acciones: [faq] });
  return respuesta(`Tu web dice: ${p}`, { acciones: [faq] });
};

export const preguntasReserva: Resolutor = (c) => {
  const p = c.fuentes.preguntasReserva(c.e.servicios.length ? c.e.servicios.map((s) => s.id) : undefined);
  const ed = ajustes("Ajustes › Preguntas", "Editar en Ajustes");
  if (!p) return respuesta(`${NO_LO_TENGO}.`, { acciones: [ed] });
  if (!p.length) return respuesta("Al reservar **no preguntas nada** extra.", { acciones: [ed] });
  return respuesta(`Al reservar preguntas **${p.length === 1 ? "una cosa" : `${p.length} cosas`}**: ${lista(p.map((x) => x.replace(/[¿?]/g, "").toLowerCase()))}.`, {
    cifras: [{ etiqueta: "preguntas", valor: p.length }],
    acciones: [ed],
  });
};

export const plantonesConfig: Resolutor = (c) => {
  const r = c.fuentes.recargo();
  const ac = ajustes("Ajustes › Plantones y señal", "Ajustes › Plantones y señal");
  if (!r) return respuesta(`${NO_LO_TENGO}.`, { acciones: [ac] });
  const senal = c.fuentes.senal.regla()?.activa;
  if (!r.activo) return respuesta(`**No cobras penalización**${senal ? ": solo la señal si no vienen" : ""}.`, { acciones: [ac] });
  return respuesta(`Cobras **${r.eur ? euros(r.eur) : "un recargo"}** si no vienen${r.horasAviso ? ` o avisan con menos de ${r.horasAviso} h` : ""}.`, { acciones: [ac] });
};

export const mensajesWhatsapp: Resolutor = (c) => {
  const p = c.fuentes.plantillas();
  const cambiar = ajustes("Ajustes › Mensajes", "Cambiarlo en Ajustes › Mensajes");
  if (!p || (!p.recordatorio && !p.confirmacion)) return respuesta(`${NO_LO_TENGO}: no encuentro tus mensajes.`, { acciones: [cambiar] });
  const pideConf = /confirm/.test(c.pregunta) && !!p.confirmacion;
  const txt = p.recordatorio && !pideConf ? `El recordatorio dice: «${p.recordatorio}».` : `La confirmación dice: «${p.confirmacion}».`;
  return respuesta(txt, { acciones: [cambiar] });
};

export const duracionFlexible: Resolutor = (c) => {
  const d = c.fuentes.duracionFlexible();
  const a = ajustes("Ajustes › Tu agenda", "Ajustes › Tu agenda");
  if (d === null) return respuesta(`${NO_LO_TENGO}.`, { acciones: [a] });
  return respuesta(d ? "Sí: la web enseña una duración orientativa y **la fijas tú** al confirmar." : "No: cada servicio dura **lo que dice la carta**. Puedes activarlo para fijarla al confirmar.", { acciones: [a] });
};

export const calendarioSuscrito: Resolutor = (c) => {
  const s = c.fuentes.calendarioSuscrito();
  const a = ajustes("Ajustes › Tu agenda", "Ajustes › Tu agenda");
  const como = "Puedes ver las citas en tu Google Calendar o en el iPhone con un enlace privado; se actualiza cada pocas horas.";
  if (s) return respuesta(`**Ya lo tienes activado**. ${como}`, { acciones: [a] });
  return respuesta(`${como} Actívalo en Ajustes › Tu agenda.`, { acciones: [a] });
};

export const equipoYColores: Resolutor = (c) => {
  const col = c.fuentes.colores();
  const a = ajustes("Ajustes › Colores", "Cambiarlos en Ajustes › Colores");
  if (!col) return respuesta(`${NO_LO_TENGO}.`, { acciones: [a] });
  const sv = c.e.servicios.length ? c.e.servicios : c.estado.servicios.slice(0, 3);
  const pr = c.e.profesionales.length ? c.e.profesionales : c.estado.equipo;
  const partes = [
    ...sv.filter((s) => col.servicios[s.id]).map((s) => `${mayus(s.name)} sale en ${col.servicios[s.id]}`),
    ...pr.filter((p) => col.profesionales[p.id]).map((p) => `${p.name.split(" ")[0]} en ${col.profesionales[p.id]}`),
  ];
  if (!partes.length) return respuesta(`${NO_LO_TENGO}: no hay colores asignados.`, { acciones: [a] });
  return respuesta(`${lista(partes)}.`, { acciones: [a] });
};

export const quePuedoPreguntar: Resolutor = () =>
  respuesta("Pregúntame por hoy, la agenda, tus clientas, el equipo, los servicios, el dinero o la señal. Por ejemplo: «huecos el sábado» o «qué se hizo Marta».", {
    sugerencias: ["¿Cuántas citas tengo mañana?", "¿Cuánto llevo este mes?", "¿Quién no ha venido?"],
  });

export const comoPreguntar: Resolutor = () =>
  respuesta("Escribe como hablas: «cuántas mañana», «color de Elena», «cuánto llevo este mes». Con el nombre de la clienta o de la profesional acierto más.");
