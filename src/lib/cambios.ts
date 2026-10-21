/**
 * Registro de cambios y deshacer (lote 9). Puro: lo usan la store (deshacer
 * inmediato y demo) y el servidor (historial y `deshacerCambio`).
 *
 * La idea entera:
 *   - Cada acción reversible guarda SOLO los campos que cambia, con su valor
 *     de antes y de después.
 *   - Deshacer = aplicar «antes» como parche nuevo, y solo si el estado actual
 *     de esos campos sigue siendo «después». Si alguien lo cambió luego, no se
 *     pisa en silencio: se avisa.
 *   - Deshacer no borra nada: marca el cambio como deshecho y deja otro que lo
 *     cuenta (se puede rehacer deshaciendo el deshacer).
 *
 * Diseño en docs/diseno-deshacer.md; contrato en docs/contrato-deshacer.md.
 */
import type { AccionId } from "./permisos";
import { accionesDeParchePerfil } from "./api/guardas";

export const TIPOS_CAMBIO = [
  "cita.cancelar", "cita.rechazar", "cita.confirmar", "cita.marcar-asistencia", "cita.cobrar", "cita.mover", "cita.editar",
  "senal.pedir", "senal.prorrogar", "senal.recibir", "senal.aplicar", "senal.devolver", "senal.retener",
  "recargo.aplicar", "recargo.perdonar", "recargo.cobrar", "clienta.bloquear", "clienta.editar",
  "servicio.editar", "servicio.borrar", "profesional.editar", "horario.editar",
  "preguntas.editar", "ajustes.editar", "perfil.publicar", "perfil.restaurar", "perfil.campo",
  // Caja (lote 11). Solo el borrado se registra: un alta no es deshacible por
  // historial (igual que crear una cita o un servicio tampoco lo es), solo
  // borrarla — y eso sí se puede deshacer (recupera el pago).
  "pago.borrar",
] as const;
export type TipoCambio = (typeof TIPOS_CAMBIO)[number];

export type EntidadCambio = "cita" | "clienta" | "servicio" | "perfil" | "pago";

export interface Cambio {
  /** uuid generado en el navegador: un reintento no duplica ni aplica dos veces. */
  id: string;
  tipo: TipoCambio;
  entidad: EntidadCambio;
  /** Id de la cita o de la clienta; en el perfil, la clave («menu», «teamHours»…). */
  idEntidad: string;
  /** SOLO los campos que cambian, con su valor anterior (`null` = no existía). */
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
  /** «Cancelada la cita de Lucía (mar 30, 10:00)». */
  resumen: string;
  autor: string | null;
  autorNombre: string | null;
  /** ISO. */
  fecha: string;
  deshechoEn?: string;
  deshechoPor?: string;
  /** Si este cambio ES un deshacer, a cuál deshace. */
  deshaceA?: string;
  /** Se mandó un WhatsApp a la clienta por este cambio. */
  avisoEnviado: boolean;
  /** Profesional (employee_id) de quien lo hizo, si tiene ficha de equipo. */
  empleadoId?: string | null;
  /** Aparato desde el que se hizo: id estable (localStorage) y nombre legible («iPhone · Safari»). */
  dispositivoId?: string | null;
  dispositivoNombre?: string | null;
}

export const DIAS_RETENCION = 90;
export const SEGUNDOS_AVISO = 10;

export type MotivoNoDeshacer = "CAMBIADO" | "POSTERIORES" | "SOLAPE" | "PERMISO" | "CADUCADO" | "DESHECHO" | "NO_ESTA";
export type EstadoDeshacer = { puede: true; aviso?: "CLIENTA_AVISADA" } | { puede: false; motivo: MotivoNoDeshacer };

/**
 * Igualdad de valores guardables (JSON), sin depender del orden de las claves.
 *
 * `undefined`, `null` y `""` cuentan como el mismo «nada»: son justo las tres
 * formas en que un campo del perfil llega a valer «vacío» según por dónde
 * pase (el campo nunca se ha tocado, se ha borrado a mano, o el editor de
 * «Mi página» siempre manda una cadena y nunca ausencia) — el propio tipo
 * `SalonProfile` lo dice campo a campo: «Vacío o ausente = …». Si NO se
 * igualaran aquí, publicar sin tocar un campo que nunca se rellenó registraría
 * un cambio espurio (p.ej. `logoUrl`: de `undefined` a `""`).
 */
export function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const vacio = (v: unknown) => v === undefined || v === null || v === "";
  if (vacio(a) || vacio(b)) return vacio(a) && vacio(b);
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}
function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, ordenar((v as Record<string, unknown>)[k])]));
  }
  return v ?? null;
}

/**
 * Los campos que cambian entre dos estados de una entidad. `campos` limita
 * la comparación (por defecto, la unión de claves).
 */
export function diferencia(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos?: string[],
): { antes: Record<string, unknown>; despues: Record<string, unknown> } {
  const claves = campos ?? [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const k of claves) {
    if (mismoValor(antes[k], despues[k])) continue;
    a[k] = antes[k] ?? null;
    d[k] = despues[k] ?? null;
  }
  return { antes: a, despues: d };
}

/** Crea el cambio, o `null` si en realidad no cambia nada. */
export function registrarCambio(p: {
  id: string;
  tipo: TipoCambio;
  entidad: EntidadCambio;
  idEntidad: string;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
  campos?: string[];
  resumen: string;
  autor?: string | null;
  autorNombre?: string | null;
  fecha: string;
  avisoEnviado?: boolean;
  empleadoId?: string | null;
  dispositivoId?: string | null;
  dispositivoNombre?: string | null;
}): Cambio | null {
  const dif = diferencia(p.antes, p.despues, p.campos);
  if (!Object.keys(dif.despues).length) return null;
  return {
    id: p.id,
    tipo: p.tipo,
    entidad: p.entidad,
    idEntidad: p.idEntidad,
    antes: dif.antes,
    despues: dif.despues,
    resumen: p.resumen,
    autor: p.autor ?? null,
    autorNombre: p.autorNombre ?? null,
    fecha: p.fecha,
    avisoEnviado: !!p.avisoEnviado,
    empleadoId: p.empleadoId ?? null,
    dispositivoId: p.dispositivoId ?? null,
    dispositivoNombre: p.dispositivoNombre ?? null,
  };
}

/** ¿Siguen los campos del cambio valiendo lo que dejó el cambio? */
export function sigueIgual(c: Cambio, actual: Record<string, unknown> | null | undefined): boolean {
  if (!actual) return false;
  return Object.entries(c.despues).every(([k, v]) => mismoValor(actual[k], v));
}

/** El parche que deshace el cambio: los valores de antes. */
export function inverso(c: Cambio): Record<string, unknown> {
  return { ...c.antes };
}

/** La acción que hay que poder hacer para deshacer este cambio. */
export function accionDe(tipo: TipoCambio): AccionId {
  const m: Record<TipoCambio, AccionId> = {
    "cita.cancelar": "cita.cancelar",
    "cita.rechazar": "cita.rechazar-solicitud",
    "cita.confirmar": "cita.confirmar-solicitud",
    "cita.marcar-asistencia": "cita.marcar-asistencia",
    "cita.cobrar": "cita.cobrar",
    "cita.mover": "cita.mover",
    "cita.editar": "cita.editar",
    "senal.pedir": "senal.gestionar",
    "senal.prorrogar": "senal.gestionar",
    "senal.recibir": "senal.gestionar",
    "senal.aplicar": "senal.gestionar",
    "senal.devolver": "senal.gestionar",
    "senal.retener": "senal.gestionar",
    "recargo.aplicar": "recargo.gestionar",
    "recargo.perdonar": "recargo.gestionar",
    "recargo.cobrar": "recargo.gestionar",
    "clienta.bloquear": "clienta.bloquear",
    "clienta.editar": "clienta.editar",
    "servicio.editar": "servicio.editar",
    "servicio.borrar": "servicio.editar",
    "profesional.editar": "equipo.editar",
    "horario.editar": "equipo.editar",
    "preguntas.editar": "salon.editar",
    "ajustes.editar": "salon.editar",
    "perfil.publicar": "web.publicar",
    "perfil.restaurar": "web.restaurar-version",
    // Por defecto; el permiso real depende del campo (ver accionesDeCambio).
    "perfil.campo": "salon.editar",
    // Crear y borrar un pago manual son el mismo nivel de confianza.
    "pago.borrar": "dinero.crear",
  };
  return m[tipo];
}

/**
 * Los permisos que pide un cambio concreto: un campo del perfil pide el de su
 * parte (web, equipo, carta, ajustes, plan); el resto, el de su tipo.
 */
export function accionesDeCambio(c: Pick<Cambio, "tipo" | "idEntidad">): AccionId[] {
  return c.tipo === "perfil.campo" ? accionesDeParchePerfil([c.idEntidad]) : [accionDe(c.tipo)];
}

/** Cómo se llama cada campo del perfil en el historial. */
const NOMBRE_CAMPO: Record<string, string> = {
  name: "el nombre del salón", tagline: "el tipo de negocio", about: "el texto «Sobre nosotros»", address: "la dirección",
  phone: "el teléfono", instagram: "el Instagram", heroImage: "la foto de portada", galleryPhotos: "la galería",
  photoCount: "las fotos", specialties: "las especialidades", faq: "las preguntas frecuentes",
  openingHours: "el horario del salón", team: "el equipo", teamIds: "el equipo", teamHours: "el horario del equipo",
  menu: "la carta", preguntasReserva: "las preguntas de reserva", bookingQuestionsEnabled: "las preguntas de reserva",
  bookingQuestionsRequired: "las preguntas de reserva", duracionFlexible: "la duración flexible",
  noShowFeeEur: "el recargo por plantón", noShowNoticeHours: "el aviso del plantón", timeZone: "la zona horaria",
  lastSlotBufferMin: "el margen de la última hora", priorityHours: "las horas prioritarias", smartSpread: "el reparto de agenda",
  depositTemplate: "el mensaje de la señal", plantillas: "los mensajes de WhatsApp",
  coloresServicio: "los colores del calendario", coloresProfesional: "los colores del calendario",
  avataresClientas: "el avatar de una clienta", avataresEquipo: "el avatar de una profesional",
  logoUrl: "el logo", plan: "el plan", calendario: "las preferencias del calendario",
};
export function resumenCampoPerfil(clave: string): string {
  const n = NOMBRE_CAMPO[clave] ?? (clave.startsWith("deposit") ? "la regla de la señal" : `«${clave}»`);
  return `Cambiado ${n}`;
}

export interface ContextoDeshacer {
  /** Estado actual de la entidad (la cita, la clienta o el perfil). */
  actual: Record<string, unknown> | null | undefined;
  /** Todos los cambios conocidos (para ver si hay posteriores sobre la misma entidad). */
  cambios: Cambio[];
  /** Quien quiere deshacer. */
  quien: string | null;
  /** ¿Tiene el permiso de la acción original (con su alcance sobre esta entidad)? */
  puedeLaAccion: boolean;
  /** ¿Tiene `historial.deshacer-ajeno`? */
  puedeAjeno: boolean;
  ahora: Date;
  /** Solo citas que se mueven: ¿el hueco de «antes» sigue libre? */
  huecoLibre?: boolean;
  /**
   * La persona ya vio el aviso de conflicto y confirmó: se salta «esto ha
   * cambiado desde entonces» y «hay cambios posteriores» (se pisa SOLO lo que
   * este cambio tocó). Nunca salta permisos, caducidad, deshecho ni solape.
   */
  forzar?: boolean;
}

/** ¿Se puede deshacer, y si no, por qué? El orden de las comprobaciones importa. */
export function puedeDeshacer(c: Cambio, ctx: ContextoDeshacer): EstadoDeshacer {
  if (c.deshechoEn) return { puede: false, motivo: "DESHECHO" };
  if (ctx.ahora.getTime() - Date.parse(c.fecha) > DIAS_RETENCION * 86_400_000) return { puede: false, motivo: "CADUCADO" };
  const propio = !!c.autor && c.autor === ctx.quien;
  if (!ctx.puedeLaAccion || (!propio && !ctx.puedeAjeno && c.autor !== null)) return { puede: false, motivo: "PERMISO" };
  if (ctx.actual === null || ctx.actual === undefined) return { puede: false, motivo: "NO_ESTA" };
  const posteriores = ctx.cambios.filter(
    (x) => x.id !== c.id && x.entidad === c.entidad && x.idEntidad === c.idEntidad && !x.deshechoEn && x.fecha > c.fecha && x.deshaceA !== c.id,
  );
  if (!ctx.forzar) {
    if (posteriores.some((x) => Object.keys(x.despues).some((k) => k in c.despues))) return { puede: false, motivo: "POSTERIORES" };
    if (!sigueIgual(c, ctx.actual)) return { puede: false, motivo: "CAMBIADO" };
  }
  if (c.tipo === "cita.mover" && ctx.huecoLibre === false) return { puede: false, motivo: "SOLAPE" };
  return c.avisoEnviado ? { puede: true, aviso: "CLIENTA_AVISADA" } : { puede: true };
}

/** El cambio que cuenta el deshacer: invierte antes/después y apunta al original. */
export function cambioDeDeshacer(c: Cambio, p: { id: string; autor: string | null; autorNombre: string | null; fecha: string; empleadoId?: string | null; dispositivoId?: string | null; dispositivoNombre?: string | null }): Cambio {
  return {
    id: p.id,
    tipo: c.tipo,
    entidad: c.entidad,
    idEntidad: c.idEntidad,
    antes: { ...c.despues },
    despues: { ...c.antes },
    resumen: `Deshecho: ${c.resumen.charAt(0).toLowerCase()}${c.resumen.slice(1)}`,
    autor: p.autor,
    autorNombre: p.autorNombre,
    fecha: p.fecha,
    deshaceA: c.id,
    avisoEnviado: false,
    empleadoId: p.empleadoId ?? null,
    dispositivoId: p.dispositivoId ?? null,
    dispositivoNombre: p.dispositivoNombre ?? null,
  };
}

/** Marca el original como deshecho y añade el cambio del deshacer. */
export function aplicarDeshacerEnLista(cambios: Cambio[], original: Cambio, deshacer: Cambio): Cambio[] {
  return [deshacer, ...cambios.map((x) => (x.id === original.id ? { ...x, deshechoEn: deshacer.fecha, deshechoPor: deshacer.autor ?? undefined } : x))];
}

/** Los que siguen dentro de la retención, del más nuevo al más viejo, como mucho `max`. */
export function podar(cambios: Cambio[], ahora: Date, max = 200): Cambio[] {
  const limite = ahora.getTime() - DIAS_RETENCION * 86_400_000;
  return cambios.filter((c) => Date.parse(c.fecha) >= limite).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, max);
}

/** El texto del motivo, para el historial. */
export function textoMotivo(m: MotivoNoDeshacer): string {
  return {
    CAMBIADO: "Ya no se puede deshacer: esto ha cambiado desde entonces.",
    POSTERIORES: "Deshaz antes los cambios posteriores sobre lo mismo.",
    SOLAPE: "No se puede volver a esa hora: el hueco ya está ocupado.",
    PERMISO: "Tu acceso no permite deshacer este cambio.",
    CADUCADO: `Han pasado más de ${DIAS_RETENCION} días.`,
    DESHECHO: "Ya está deshecho.",
    NO_ESTA: "Esto ya no está en el panel (o no se ha cargado en este aparato): no se puede deshacer desde aquí.",
  }[m];
}

/** Motivos que se pueden saltar tras avisar y confirmar («Deshacer igualmente»). */
export function motivoSaltable(m: MotivoNoDeshacer): boolean {
  return m === "CAMBIADO" || m === "POSTERIORES";
}

/**
 * Permiso de VER un cambio: cada persona ve lo suyo; quien tiene
 * `historial.deshacer-ajeno` (gerente, subencargada) ve lo de todas.
 * Los cambios sin autora (`autor` nulo: demo, acciones antiguas) los ve cualquiera
 * con acceso al historial, igual que `puedeDeshacer` permite deshacerlos.
 */
export function puedeVerCambio(c: Pick<Cambio, "autor">, quien: string | null, puedeAjeno: boolean): boolean {
  return puedeAjeno || c.autor === null || (!!quien && c.autor === quien);
}

/**
 * Comprobación de SERVIDOR al registrar un deshacer: la autora original
 * manda; si no es ella hace falta `historial.deshacer-ajeno`. Devuelve el
 * motivo de rechazo o `null` si procede.
 */
export function rechazoDeDeshacerEnServidor(
  original: Pick<Cambio, "autor" | "deshechoEn">,
  quien: string,
  puedeAjeno: boolean,
): "PERMISO" | "DESHECHO" | null {
  if (original.deshechoEn) return "DESHECHO";
  if (!puedeVerCambio(original, quien, puedeAjeno)) return "PERMISO";
  return null;
}

/** Aviso antes de deshacer si la clienta ya recibió un WhatsApp. */
export function textoClientaAvisada(nombre: string): string {
  return `${nombre} ya recibió un WhatsApp con este cambio. Si lo deshaces, avísale de nuevo.`;
}

/**
 * Qué autora filtra el servidor al listar: quien no puede ver lo ajeno solo
 * recibe lo suyo, pida lo que pida; quien sí puede, filtra por la que pida.
 */
export function autorDelListado(puedeAjeno: boolean, userId: string, autorPedido?: string): string | undefined {
  return puedeAjeno ? autorPedido : userId;
}
