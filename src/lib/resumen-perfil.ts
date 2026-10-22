/**
 * Frases del historial para un cambio en el perfil del salón (22-oct-2026):
 * «Cambió el nombre del salón: «Peluchic» → «PeluChic»», «Nueva foto de
 * portada», «Avatar de Anca», «Añadidas 2 fotos a la galería»…
 *
 * Puro: no importa la store. La store lo llama al registrar cada campo con
 * el valor de antes, el de después y los nombres que hagan falta (equipo y
 * servicios) para no enseñar ids.
 */

export interface ContextoResumenPerfil {
  /** id de profesional → nombre. */
  equipo?: Record<string, string>;
  /** id de servicio → nombre. */
  servicios?: Record<string, string>;
}

/** Cómo se llama cada campo del perfil en el historial. */
export const NOMBRE_CAMPO: Record<string, string> = {
  name: "el nombre del salón", tagline: "el tipo de negocio", about: "la presentación", address: "la dirección",
  phone: "el teléfono", instagram: "el Instagram", heroImage: "la foto de portada", galleryPhotos: "la galería",
  photoCount: "las fotos", specialties: "las especialidades", faq: "las preguntas frecuentes",
  openingHours: "el horario del salón", team: "el equipo", teamIds: "el equipo", teamHours: "el horario del equipo",
  teamExperience: "la experiencia del equipo", serviciosPorProfesional: "qué servicios hace cada profesional",
  menu: "la carta de servicios y precios", preguntasReserva: "las preguntas de reserva", bookingQuestionsEnabled: "las preguntas de reserva",
  bookingQuestionsRequired: "las preguntas de reserva", duracionFlexible: "la duración flexible",
  noShowFeeEur: "el recargo por plantón", noShowNoticeHours: "el aviso del plantón", timeZone: "la zona horaria",
  lastSlotBufferMin: "el margen de la última hora", priorityHours: "las franjas prioritarias", smartSpread: "el reparto de agenda",
  depositTemplate: "el mensaje de la señal", plantillas: "los mensajes de WhatsApp",
  coloresServicio: "los colores de los servicios", coloresProfesional: "los colores del equipo",
  avataresClientas: "el avatar de una clienta", avataresEquipo: "el avatar de una profesional",
  logoUrl: "el logo", logotipoClaroUrl: "el logo para fondo claro", logotipoOscuroUrl: "el logo para fondo oscuro",
  plan: "el plan", calendario: "las preferencias del calendario",
  terminoProfesional: "cómo se llama a las profesionales", nifResponsable: "el NIF del responsable",
  correoPrivacidad: "el correo de privacidad", ocultarPrecioReserva: "si se ve el precio al reservar",
  rating: "la nota de Google", reviewCount: "el número de reseñas", enlaces: "los enlaces a redes, blog y tienda",
  destacados: "«Lo más pedido»", whatsapp: "el WhatsApp", boletin: "el boletín", galeriaPropia: "la galería de fotos",
  descripcionesServicios: "las descripciones de los servicios", preciosLiterales: "los precios de la carta",
  diasEspeciales: "los días especiales", bloqueosAgenda: "los bloqueos de agenda", antelacionMinimaMin: "la antelación mínima para reservar",
  clientImportOrigin: "el origen de las clientas importadas", demoAbreHoy: "si la demo abre hoy",
};

/** Campos cuyo valor es una imagen (una URL). */
const IMAGENES: Record<string, { nueva: string; quitada: string; cambiada: string }> = {
  heroImage: { nueva: "Nueva foto de portada", quitada: "Quitada la foto de portada", cambiada: "Nueva foto de portada" },
  logoUrl: { nueva: "Nuevo logo", quitada: "Quitado el logo", cambiada: "Nuevo logo" },
  logotipoClaroUrl: { nueva: "Nuevo logo para fondo claro", quitada: "Quitado el logo para fondo claro", cambiada: "Nuevo logo para fondo claro" },
  logotipoOscuroUrl: { nueva: "Nuevo logo para fondo oscuro", quitada: "Quitado el logo para fondo oscuro", cambiada: "Nuevo logo para fondo oscuro" },
};

/** Campos de texto corto: se enseña el antes y el después. */
const TEXTOS_CORTOS = new Set(["name", "tagline", "address", "phone", "instagram", "whatsapp", "terminoProfesional", "nifResponsable", "correoPrivacidad"]);
/** Textos largos: solo se dice que cambió (el detalle lo enseña «antes → después»). */
const TEXTOS_LARGOS = new Set(["about", "depositTemplate"]);

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const vacio = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const corto = (v: unknown, max = 40) => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Claves de un mapa cuyo valor ha cambiado (añadidas, quitadas o distintas). */
function clavesCambiadas(a: unknown, b: unknown): string[] {
  const ma = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
  const mb = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(ma), ...Object.keys(mb)])].filter((k) => JSON.stringify(ma[k] ?? null) !== JSON.stringify(mb[k] ?? null));
}

function nombres(ids: string[], mapa: Record<string, string> | undefined, porDefecto: string): string {
  const n = ids.map((id) => mapa?.[id]).filter((x): x is string => !!x);
  if (n.length === 0) return porDefecto;
  if (n.length <= 2) return n.join(" y ");
  return `${n.slice(0, 2).join(", ")} y ${n.length - 2} más`;
}

/**
 * La frase de un cambio de un campo del perfil. Sin valores, la genérica
 * («Cambió el logo»), que es lo que dejaban las filas antiguas.
 */
export function resumenCampoPerfil(clave: string, antes?: unknown, despues?: unknown, ctx: ContextoResumenPerfil = {}): string {
  const n = NOMBRE_CAMPO[clave] ?? (clave.startsWith("deposit") ? "la regla de la señal" : `«${clave}»`);
  const generico = `Cambió ${n}`;
  if (arguments.length < 3) return generico;

  const img = IMAGENES[clave];
  if (img) return vacio(despues) ? img.quitada : vacio(antes) ? img.nueva : img.cambiada;

  if (TEXTOS_CORTOS.has(clave)) {
    if (vacio(despues)) return `Quitó ${n} («${corto(antes)}»)`;
    if (vacio(antes)) return `Puso ${n}: «${corto(despues)}»`;
    return `Cambió ${n}: «${corto(antes)}» → «${corto(despues)}»`;
  }
  if (TEXTOS_LARGOS.has(clave)) return vacio(despues) ? `Quitó ${n}` : `Reescribió ${n}`;

  if (clave === "rating" || clave === "reviewCount") return `Cambió ${n}: ${vacio(antes) ? "—" : String(antes)} → ${vacio(despues) ? "—" : String(despues)}`;

  if (clave === "galeriaPropia" || clave === "galleryPhotos") {
    const urlDe = (x: unknown) => (typeof x === "string" ? x : String((x as { url?: string } | null)?.url ?? ""));
    const a = (Array.isArray(antes) ? antes : []).map(urlDe);
    const d = (Array.isArray(despues) ? despues : []).map(urlDe);
    const puestas = d.filter((u) => !a.includes(u)).length;
    const quitadas = a.filter((u) => !d.includes(u)).length;
    const partes: string[] = [];
    if (puestas) partes.push(`${plural(puestas, "añadida", "añadidas")} ${puestas} ${plural(puestas, "foto", "fotos")}`);
    if (quitadas) partes.push(`${plural(quitadas, "quitada", "quitadas")} ${quitadas} ${plural(quitadas, "foto", "fotos")}`);
    if (partes.length === 0) return "Cambió el orden o el texto de las fotos de la galería";
    return `Galería: ${partes.join(" y ")}`;
  }

  if (clave === "openingHours") {
    const a = Array.isArray(antes) ? antes : [];
    const d = Array.isArray(despues) ? despues : [];
    const dias = DIAS.filter((_, i) => String(a[i] ?? "") !== String(d[i] ?? ""));
    if (dias.length === 0) return generico;
    if (dias.length === 1) {
      const i = DIAS.indexOf(dias[0]);
      return `Cambió el horario del ${dias[0]}: ${corto(a[i] || "cerrado", 30)} → ${corto(d[i] || "cerrado", 30)}`;
    }
    return `Cambió el horario del salón (${dias.length <= 3 ? dias.join(", ") : `${dias.length} días`})`;
  }

  if (clave === "specialties") {
    const a = (Array.isArray(antes) ? antes : []).map(String);
    const d = (Array.isArray(despues) ? despues : []).map(String);
    const puestas = d.filter((x) => !a.includes(x));
    const quitadas = a.filter((x) => !d.includes(x));
    const partes: string[] = [];
    if (puestas.length) partes.push(`+ ${puestas.join(", ")}`);
    if (quitadas.length) partes.push(`− ${quitadas.join(", ")}`);
    return partes.length ? `Especialidades: ${partes.join(" · ")}` : "Cambió el orden de las especialidades";
  }

  if (clave === "menu" || clave === "faq" || clave === "priorityHours") {
    const a = Array.isArray(antes) ? antes.length : 0;
    const d = Array.isArray(despues) ? despues.length : 0;
    if (d > a) return `${mayus(n)}: ${d - a} ${plural(d - a, "línea nueva", "líneas nuevas")}`;
    if (d < a) return `${mayus(n)}: ${a - d} ${plural(a - d, "línea quitada", "líneas quitadas")}`;
    return `Cambió ${n}`;
  }

  if (clave === "avataresEquipo") {
    const ids = clavesCambiadas(antes, despues);
    return `Avatar de ${nombres(ids, ctx.equipo, "una profesional")}`;
  }
  if (clave === "avataresClientas") return `Avatar de ${plural(clavesCambiadas(antes, despues).length, "una clienta", "varias clientas")}`;
  if (clave === "coloresServicio") {
    const ids = clavesCambiadas(antes, despues);
    return `Cambió el color de ${nombres(ids, ctx.servicios, "un servicio")} en el calendario`;
  }
  if (clave === "coloresProfesional") {
    const ids = clavesCambiadas(antes, despues);
    return `Cambió el color de ${nombres(ids, ctx.equipo, "una profesional")} en el calendario`;
  }
  if (clave === "descripcionesServicios") {
    const ids = clavesCambiadas(antes, despues);
    return `Cambió la descripción de ${nombres(ids, ctx.servicios, ids.length > 1 ? "varios servicios" : "un servicio")}`;
  }
  if (clave === "team") {
    const a = Array.isArray(antes) ? antes.length : 0;
    const d = Array.isArray(despues) ? despues.length : 0;
    if (d > a) return `Equipo: ${d - a} ${plural(d - a, "persona nueva", "personas nuevas")}`;
    if (d < a) return `Equipo: ${a - d} ${plural(a - d, "persona menos", "personas menos")}`;
    return "Cambió el equipo (nombres o especialidades)";
  }
  if (typeof despues === "boolean") return `Cambió ${n}: ${antes ? "sí" : "no"} → ${despues ? "sí" : "no"}`;
  if (typeof despues === "number" || typeof antes === "number") return `Cambió ${n}: ${vacio(antes) ? "—" : String(antes)} → ${vacio(despues) ? "—" : String(despues)}`;
  return generico;
}

/**
 * Lo que una restauración cambia en el perfil, campo a campo, para dejarlo
 * en el historial como UN cambio deshacible: solo las claves que de verdad
 * cambian, con `null` donde la clave no existía (así deshacer la borra).
 */
export function diferenciaDePerfil(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  claves: Iterable<string> = new Set([...Object.keys(antes), ...Object.keys(despues)]),
): { antes: Record<string, unknown>; despues: Record<string, unknown> } {
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const k of claves) {
    if (JSON.stringify(antes[k] ?? null) === JSON.stringify(despues[k] ?? null)) continue;
    a[k] = antes[k] ?? null;
    d[k] = despues[k] ?? null;
  }
  return { antes: a, despues: d };
}

/** «Restaurada la versión de tu página del 21 oct, 18:05 (3 cambios: la foto de portada, el logo y 1 más)». */
export function resumenRestauracion(fechaVersion: string, claves: string[]): string {
  let cuando = String(fechaVersion).slice(0, 10);
  try {
    cuando = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(fechaVersion)).replace(".", "");
  } catch {
    /* fecha ilegible: se queda la ISO corta */
  }
  if (claves.length === 0) return `Restaurada la versión de tu página del ${cuando} (era igual que la publicada)`;
  const nombresCampos = [...new Set(claves.map((k) => NOMBRE_CAMPO[k] ?? k))];
  const lista = nombresCampos.length <= 2 ? nombresCampos.join(" y ") : `${nombresCampos.slice(0, 2).join(", ")} y ${nombresCampos.length - 2} más`;
  return `Restaurada la versión de tu página del ${cuando} (${lista})`;
}

/** Versiones de Mi página que se pueden recuperar SIEMPRE, con cualquier plan. */
export const VERSIONES_WEB_SIEMPRE = 10;

/**
 * ¿Puede restaurarse esta versión con este plan? Con historial completo,
 * todas las guardadas; si no, las {@link VERSIONES_WEB_SIEMPRE} más recientes.
 * `posicion` es su puesto (0 = la más reciente) entre las del salón.
 */
export function versionRestaurable(posicion: number, completo: boolean): boolean {
  return posicion >= 0 && (completo || posicion < VERSIONES_WEB_SIEMPRE);
}
