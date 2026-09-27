/**
 * Datos de la web oficial de siShow (sishow.es). Lo que se promete en ella
 * sale de aquí para que precios, planes, enlaces de ejemplo y textos legales
 * no se contradigan con el resto de la app (ver `lib/plan.ts`).
 *
 * Lote 17 creó la primera versión en `/`; la web oficial (inicio,
 * funcionalidades, precios, contacto y legales) la amplía sin tocar el panel
 * ni la web de reservas de cada salón.
 */
import type { PlanSishow } from "./plan";

/** Dominio de la web oficial: canónicas, sitemap y Open Graph apuntan aquí. */
export const SITIO_URL = "https://sishow.es";

/** Correo de contacto comercial. */
export const CORREO_SISHOW = "infosishow@gmail.com";

/**
 * Número de WhatsApp de siShow, solo dígitos con prefijo de país (p. ej.
 * «34600000000»). MARCADOR: Tomás lo rellena cuando tenga el número. Mientras
 * siga siendo el marcador, el botón de WhatsApp abre el correo.
 */
export const WHATSAPP_SISHOW = "WHATSAPP_SISHOW";

const MENSAJE_WHATSAPP = "Hola, quiero ver siShow para mi salón.";

/** Enlace del botón de WhatsApp; `null` si el número aún es el marcador. */
export function enlaceWhatsapp(numero: string = WHATSAPP_SISHOW): string | null {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 9) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`;
}

export function enlaceCorreo(asunto = "Quiero ver siShow para mi salón", cuerpo?: string): string {
  const base = `mailto:${CORREO_SISHOW}?subject=${encodeURIComponent(asunto)}`;
  return cuerpo ? `${base}&body=${encodeURIComponent(cuerpo)}` : base;
}

/** Lo que nos ayuda saber para enseñarle siShow con su salón. */
export const DATOS_PARA_LA_DEMO = [
  "Nombre del salón y ciudad",
  "Cuántas sois y qué servicios hacéis",
  "Cómo lleváis hoy la agenda: libreta, WhatsApp u otro programa",
  "Si pedís señal o querríais pedirla",
];

/** Correo con esas preguntas ya escritas, para contestarlas debajo. */
export function enlaceCorreoConDatos(): string {
  const cuerpo = `Hola:\n\nMe gustaría ver siShow con mi salón.\n\n${DATOS_PARA_LA_DEMO.map((d) => `- ${d}: `).join("\n")}\n\nGracias.`;
  return enlaceCorreo("Quiero ver siShow para mi salón", cuerpo);
}

/** Perfil de la demo de PeluChic (el mismo `?d=` que se enseña a María). */
export const DEMO_PELUCHIC = "eyJuIjoiUGVsdUNoaWMiLCJ0IjoiUGVsdXF1ZXLDrWEiLCJkIjoiQ2FsbGUgUHJpbmNlc2EgZGUgw4lib2xpLCAxMDAgKGVzcXVpbmEgQy4gZGUgTWFyw61hIFR1ZG9yLCAxNCwgTG9jIDEwNCksIEhvcnRhbGV6YS9TYW5jaGluYXJybywgMjgwNTAgTWFkcmlkIiwicCI6IjY2NiA3NyA2NyAzMSIsInIiOjQuNSwiYyI6ODEsInMiOlsibm92aWFzIiwibWFkcmluYXMiLCJldmVudG9zIl0sIm8iOlsiQ2VycmFkbyIsIjEwOjAw4oCTMjA6MDAiLCIxMDowMOKAkzIwOjAwIiwiMTA6MDDigJMyMDowMCIsIjEwOjAw4oCTMjA6MDAiLCI5OjAw4oCTMTQ6MDAiLCJDZXJyYWRvIl0sImUiOlsiTWFyw61hfkVzdGlsaXN0YSwgbm92aWFzIHkgcGVpbmFkb3MgZGUgZXZlbnRvIiwiU2FyYX5Db2xvcmlzdGEsIGNvbG9yIHkgbWVjaGFzL2JhbGF5YWdlIiwiTm9lbGlhfkVzdGlsaXN0YSwgcmVjb2dpZG9zIHkgdHJhdGFtaWVudG9zIl0sIm0iOlsiQ29ydGUgeSBwZWluYWRvfjQ1fjI1flBlbHVxdWVyw61hIiwiVGludGV-NDB-MzV-UGVsdXF1ZXLDrWEiLCJNZWNoYXMgLyBiYWxheWFnZX4xMjB-ODB-UGVsdXF1ZXLDrWEiLCJQZWluYWRvIGRlIG5vdmlhfjkwfjkwflBlbHVxdWVyw61hIiwiUmVjb2dpZG8gZGUgZXZlbnRvfjYwfjQ1flBlbHVxdWVyw61hIiwiVHJhdGFtaWVudG8gY2FwaWxhcn4zMH4yMH5QZWx1cXVlcsOtYSJdLCJkZiI6MSwiaCI6Ii9hcGkvZm90bz9wbGFjZT1DaElKY19kWTNxMHVRZzBSZWVBemMxWTNpcnMmaT0wIiwiZiI6MTAsImciOlsiNSIsIjIiLCI3IiwiNCIsIjMiLCI2Il0sImZlIjoxLCJmYiI6IjY2NiA3NyA2NyAzMSIsImZhIjoyMH0";

/**
 * Enlaces de la demo que enseña la web oficial: la web de reservas de un
 * salón de ejemplo y su panel. `/demo/peluchic` siembra la demo de PeluChic
 * y entra al panel (lo crea el rol de enrutado, en su rama). Toda la web
 * oficial enlaza con estas dos constantes y con ninguna otra.
 */
export const DEMO_WEB_URL = "/s/peluchic";
export const DEMO_PANEL_URL = "/demo/peluchic";

/**
 * Los mismos enlaces con el perfil dentro (`?d=`), del lote 17. Siguen
 * funcionando sin `/demo/peluchic` y sirven para comprobar la demo mientras
 * esa ruta no exista; la web oficial ya no los usa.
 */
export const ENLACE_WEB_EJEMPLO = `/s/peluchic?d=${DEMO_PELUCHIC}`;
export const ENLACE_PANEL_EJEMPLO = `/app?d=${DEMO_PELUCHIC}`;

/** Precio por mes, en euros, pagando el año entero o mes a mes. */
export const PRECIOS: Record<PlanSishow, { anual: number; mensual: number }> = {
  reservas: { anual: 36, mensual: 40 },
  "reservas-asistente": { anual: 42, mensual: 47 },
  "todo-incluido": { anual: 55, mensual: 59 },
};

/** Puesta en marcha: horas de trabajo nuestro, a precio por hora. */
export const PUESTA_EN_MARCHA = { horas: 5, precioHora: 18 };

export function precioPuestaEnMarcha(anual: boolean): number {
  const total = PUESTA_EN_MARCHA.horas * PUESTA_EN_MARCHA.precioHora;
  return anual ? total / 2 : total;
}

/* -------------------------------------------------------------------------
 * Páginas de la web oficial
 * ---------------------------------------------------------------------- */

export type ClavePagina =
  | "inicio"
  | "funcionalidades"
  | "precios"
  | "contacto"
  | "aviso-legal"
  | "privacidad"
  | "cookies";

export interface PaginaWeb {
  ruta: string;
  /** Texto del `<title>` (sin sufijo: ya nombra siShow cuando hace falta). */
  titulo: string;
  /** Meta descripción, 120-160 caracteres. */
  descripcion: string;
}

export const PAGINAS_WEB: Record<ClavePagina, PaginaWeb> = {
  inicio: {
    ruta: "/",
    titulo: "siShow: reservas online y agenda para peluquerías y centros de belleza",
    descripcion:
      "Tus clientas reservan solas desde tu web, tú llevas la agenda del equipo, las fichas de color y la caja desde el móvil. Funcionando en una semana.",
  },
  funcionalidades: {
    ruta: "/funcionalidades",
    titulo: "Funcionalidades de siShow: reservas, agenda, fichas de color y caja",
    descripcion:
      "Web de reservas con tu nombre, agenda del equipo, fichas con el color de cada clienta, caja y señal, asistente sin IA, accesos por rol y deshacer.",
  },
  precios: {
    ruta: "/precios",
    titulo: "Precios de siShow: planes para tu salón desde 36 € al mes",
    descripcion:
      "Tres planes con precio cerrado: Reservas, Reservas + Asistente y Todo incluido. Pago anual o mensual y puesta en marcha de 90 € (45 € con el anual).",
  },
  contacto: {
    ruta: "/contacto",
    titulo: "Contacto: hablemos de tu salón | siShow",
    descripcion:
      "Escríbenos a infosishow@gmail.com y te enseñamos siShow con tus servicios y tu equipo. O prueba antes la demo de un salón de ejemplo.",
  },
  "aviso-legal": {
    ruta: "/legal/aviso-legal",
    titulo: "Aviso legal | siShow",
    descripcion: "Datos del titular de sishow.es, condiciones de uso de la web, propiedad intelectual y legislación aplicable.",
  },
  privacidad: {
    ruta: "/legal/privacidad",
    titulo: "Política de privacidad | siShow",
    descripcion:
      "Quién trata tus datos cuando nos escribes, para qué, con qué base legal, cuánto tiempo y cómo ejercer tus derechos según el RGPD.",
  },
  cookies: {
    ruta: "/legal/cookies",
    titulo: "Política de cookies | siShow",
    descripcion: "sishow.es no usa cookies de analítica ni de publicidad. Qué se guarda en tu navegador y para qué.",
  },
};

/** Navegación principal de la cabecera. */
export const NAV_WEB: { ruta: "/funcionalidades" | "/precios" | "/contacto"; texto: string }[] = [
  { ruta: "/funcionalidades", texto: "Funcionalidades" },
  { ruta: "/precios", texto: "Precios" },
  { ruta: "/contacto", texto: "Contacto" },
];

/** `<head>` básico de una página de la web oficial: título y descripción. */
export function cabezaWeb(clave: ClavePagina) {
  const p = PAGINAS_WEB[clave];
  return {
    meta: [{ title: p.titulo }, { name: "description", content: p.descripcion }],
  };
}

/* -------------------------------------------------------------------------
 * Contenido compartido de la web oficial
 * ---------------------------------------------------------------------- */

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

/**
 * Preguntas frecuentes del inicio. Cada respuesta se ciñe a lo que existe hoy
 * en el producto (registro de versiones y hoja de planes v2 del 26-sep).
 */
export const PREGUNTAS_INICIO: Pregunta[] = [
  {
    pregunta: "¿Mis clientas tienen que descargarse algo?",
    respuesta:
      "No. Reservan desde tu enlace, en el navegador del móvil o del ordenador. No necesitan cuenta ni contraseña: dejan su nombre y su teléfono, y el correo si quieren.",
  },
  {
    pregunta: "¿Cuánto se tarda en empezar?",
    respuesta:
      "Una semana. Hablamos una hora, lo montamos nosotros con tus servicios, tu equipo y tus clientas, lo repasas con nosotros y das tu enlace. Después te acompañamos por WhatsApp las dos primeras semanas.",
  },
  {
    pregunta: "¿siShow cobra a mis clientas o se queda una comisión?",
    respuesta:
      "No. siShow no cobra nada a tus clientas ni se queda comisión por reserva: tú pagas una cuota fija al mes y ellas te pagan a ti, como siempre. Si pides señal, el Bizum llega a tu número.",
  },
  {
    pregunta: "¿Funciona en el móvil y en el iPad?",
    respuesta:
      "Sí. siShow funciona en el navegador del móvil, de la tablet y del ordenador, y puedes añadirlo a la pantalla de inicio para abrirlo como una app más.",
  },
  {
    pregunta: "¿El asistente usa inteligencia artificial?",
    respuesta:
      "No. Busca en tu agenda, tus fichas y tu caja y te responde con esos datos. Si algo no lo sabe, te lo dice: no se inventa nada.",
  },
  {
    pregunta: "¿Los WhatsApp a mis clientas los mandáis vosotros?",
    respuesta:
      "Salen de tu propio WhatsApp: siShow te prepara el recordatorio, la confirmación o la petición de señal y tú lo envías con un toque. Si prefieres que se envíen solos desde tu número, lo montamos a tu medida.",
  },
  {
    pregunta: "¿Qué pasa con las clientas que ya tengo?",
    respuesta:
      "Las traemos nosotros en la puesta en marcha. Si usas TPV 123, también su historial de ventas; si usas otro programa, lo miramos contigo.",
  },
  {
    pregunta: "¿Sirve para barberías y centros de estética?",
    respuesta:
      "Sí. Los servicios, la duración y los precios los pones tú, así que funciona igual con cortes y arreglos de barba que con tratamientos de estética.",
  },
];

/** La semana de puesta en marcha, paso a paso. */
export const SEMANA_PUESTA: { cuando: string; titulo: string; texto: string }[] = [
  { cuando: "Día 1", titulo: "Hablamos una hora", texto: "Nos cuentas tus servicios, tu equipo, tu horario y cómo quieres la señal." },
  { cuando: "Días 2 y 3", titulo: "Lo montamos nosotros", texto: "Cargamos tu carta, el equipo y tus clientas, y dejamos lista tu web de reservas." },
  { cuando: "Día 4", titulo: "Lo repasas", texto: "Te lo enseñamos ya hecho y cambiamos lo que no te encaje." },
  { cuando: "Días 5 a 7", titulo: "Primeras reservas", texto: "Formación con tu equipo, compartes tu enlace y estamos pendientes de las primeras citas." },
];

/** Resumen de cada plan para el inicio: para quién es y lo principal. */
export const RESUMEN_PLANES: Record<PlanSishow, { para: string; puntos: string[] }> = {
  reservas: {
    para: "Para recibir reservas por internet y ordenar la agenda del salón.",
    puntos: ["Web de reservas con tu nombre", "Agenda del equipo", "Fichas con el color de cada clienta", "Caja y señal por Bizum"],
  },
  "reservas-asistente": {
    para: "Lo mismo, y un asistente que te responde con tus datos.",
    puntos: ["Todo lo de Reservas", "El asistente, sin inteligencia artificial", "Historial de ventas de TPV 123", "Lo que gasta cada clienta"],
  },
  "todo-incluido": {
    para: "Para el salón que quiere tenerlo todo y que se lo llevemos al día.",
    puntos: ["Todo lo de Reservas + Asistente", "Más tipos de acceso e historial completo", "Campañas, analítica completa y Excel", "Tu propio dominio y soporte prioritario"],
  },
};

/* -------------------------------------------------------------------------
 * Precios: detalle de cada plan, comparativa y «a tu medida»
 * ---------------------------------------------------------------------- */

/**
 * Si los precios publicados llevan IVA. PENDIENTE (Tomás): la LSSI (art. 10)
 * pide decir si los precios incluyen los impuestos. `null` = sin decidir: la
 * página de precios enseña el aviso de pendiente en vez de inventarlo.
 */
export const PRECIOS_CON_IVA: boolean | null = null;

export function notaImpuestos(conIva: boolean | null = PRECIOS_CON_IVA): string | null {
  if (conIva === null) return null;
  return conIva ? "Precios con IVA incluido." : "Precios sin IVA: se añade el IVA que corresponda.";
}

/** Lo que trae cada plan, en la tarjeta de /precios. */
export const DETALLE_PLANES: Record<PlanSishow, { para: string; puntos: string[] }> = {
  reservas: {
    para: "Para recibir reservas por internet y ordenar la agenda del salón.",
    puntos: [
      "Web de reservas en tusalon.sishow.es",
      "Agenda del equipo y la pantalla Hoy",
      "Fichas con el color y el historial de cada clienta",
      "Caja del día y señal por Bizum",
      "Recordatorio por correo automático y por WhatsApp con un toque",
      "Lista de espera y hoja del día",
      "Accesos de gerente y estilista",
      "Deshacer lo de las últimas 24 horas",
      "Enlace para pedir reseñas en Google",
    ],
  },
  "reservas-asistente": {
    para: "Lo mismo, y un asistente que te responde con tus datos.",
    puntos: [
      "Todo lo de Reservas",
      "El asistente, sin inteligencia artificial",
      "Historial de ventas de TPV 123 en cada ficha",
      "Lo que gasta cada clienta",
    ],
  },
  "todo-incluido": {
    para: "Para el salón que lo quiere todo y que se lo llevemos al día.",
    puntos: [
      "Todo lo de Reservas + Asistente",
      "Subencargada y recepción, cada una con lo suyo",
      "Historial de 90 días y versiones de tu web",
      "Campañas: las que no vuelven, horas flojas y segunda visita",
      "Analítica completa y exportar a Excel",
      "Cierre de caja guardado y fichero para tu gestoría",
      "La señal que libera el hueco sola",
      "Importación mensual de TPV 123",
      "Tu propio dominio (tusalon.es)",
      "Informe y sesión de ajuste cada mes",
      "Soporte prioritario",
    ],
  },
};

/** Celda de la comparativa: incluido, no incluido o un texto corto. */
export type CeldaPlan = boolean | string;

export interface GrupoComparativa {
  grupo: string;
  filas: { funcion: string; planes: Record<PlanSishow, CeldaPlan> }[];
}

const todos = (v: CeldaPlan = true): Record<PlanSishow, CeldaPlan> => ({ reservas: v, "reservas-asistente": v, "todo-incluido": v });
const soloTodo: Record<PlanSishow, CeldaPlan> = { reservas: false, "reservas-asistente": false, "todo-incluido": true };
const desdeAsistente: Record<PlanSishow, CeldaPlan> = { reservas: false, "reservas-asistente": true, "todo-incluido": true };

/**
 * Comparativa de planes. Sale de la hoja de planes v2 (aprobada el 26-sep) y
 * de `FUNCIONES_POR_PLAN` en `lib/plan.ts`: si cambia una, cambia la otra.
 */
export const COMPARATIVA: GrupoComparativa[] = [
  {
    grupo: "Reservas y agenda",
    filas: [
      { funcion: "Web de reservas en tusalon.sishow.es", planes: todos() },
      { funcion: "Tu propio dominio (tusalon.es)", planes: soloTodo },
      { funcion: "Agenda: día, 3 días, semana, mes y cronograma", planes: todos() },
      { funcion: "Preguntas propias al reservar", planes: todos() },
      { funcion: "Lista de espera y hoja del día", planes: todos() },
      { funcion: "Recordatorio por correo automático y por WhatsApp con un toque", planes: todos() },
      { funcion: "Google Calendar (en pruebas)", planes: todos() },
    ],
  },
  {
    grupo: "Clientas",
    filas: [
      { funcion: "Fichas con color, historial y avisos", planes: todos() },
      { funcion: "Historial de ventas de TPV 123 y gasto por clienta", planes: desdeAsistente },
      { funcion: "Importación mensual de TPV 123", planes: soloTodo },
    ],
  },
  {
    grupo: "Caja y señal",
    filas: [
      { funcion: "Cobros en efectivo, tarjeta y Bizum", planes: todos() },
      { funcion: "Señal por Bizum con plazo", planes: todos() },
      { funcion: "La señal libera el hueco sola si no llega", planes: soloTodo },
      { funcion: "Cierre de caja guardado y fichero para la gestoría", planes: soloTodo },
    ],
  },
  {
    grupo: "Equipo",
    filas: [
      { funcion: "Accesos de gerente y estilista", planes: todos() },
      { funcion: "Accesos de subencargada y recepción", planes: soloTodo },
      { funcion: "Deshacer e historial de cambios", planes: { reservas: "24 horas", "reservas-asistente": "24 horas", "todo-incluido": "90 días" } },
      { funcion: "Versiones de tu web para volver a una anterior", planes: soloTodo },
    ],
  },
  {
    grupo: "Asistente y crecimiento",
    filas: [
      { funcion: "El asistente, sin inteligencia artificial", planes: desdeAsistente },
      { funcion: "Enlace para pedir reseñas en Google", planes: todos() },
      { funcion: "Campañas para recuperar clientas y llenar horas flojas", planes: soloTodo },
      { funcion: "Analítica del mes", planes: todos() },
      { funcion: "Analítica completa y exportar a Excel", planes: soloTodo },
    ],
  },
  {
    grupo: "Acompañamiento",
    filas: [
      { funcion: "Puesta en marcha en una semana", planes: todos() },
      { funcion: "Acompañamiento por WhatsApp las dos primeras semanas", planes: todos() },
      { funcion: "Informe y sesión de ajuste cada mes", planes: soloTodo },
      { funcion: "Soporte prioritario", planes: soloTodo },
    ],
  },
];

/** Qué incluye la puesta en marcha (hoja de planes v2). */
export const PUESTA_INCLUYE = [
  "Cargamos tu carta, tu equipo y tu horario",
  "Traemos tus clientas, y su historial si usas TPV 123",
  "Dejamos lista tu web de reservas con tu enlace",
  "Formación con tu equipo",
  "Te acompañamos por WhatsApp las dos primeras semanas",
];

/** Lo que no entra en los planes y se presupuesta aparte (sin cifras en la web). */
export const A_TU_MEDIDA: { titulo: string; texto: string }[] = [
  {
    titulo: "Conexión con tu contabilidad y facturación",
    texto: "Una sola herramienta para ver y controlar todo el negocio al momento, conectada con el programa que ya usas.",
  },
  {
    titulo: "Gestión de formaciones",
    texto: "Tus cursos, las plazas, las alumnas, los cobros y los certificados.",
  },
  {
    titulo: "WhatsApp automático",
    texto:
      "Que tu número conteste y envíe solo los recordatorios, las confirmaciones y los avisos de la señal. Hay que dar de alta tu número en Meta (de 3 a 4 semanas) y Meta cobra unos pocos euros al mes por los mensajes.",
  },
];

export const PREGUNTAS_PRECIOS: Pregunta[] = [
  {
    pregunta: "¿Qué cambia entre pagar al año o mes a mes?",
    respuesta:
      "Pagando el año entero, cada mes sale más barato (36, 42 o 55 € en vez de 40, 47 o 59 €) y la puesta en marcha se queda en la mitad: 45 € en lugar de 90 €.",
  },
  {
    pregunta: "¿Hay comisiones por reserva o por cobro?",
    respuesta:
      "No. La cuota es fija. siShow no cobra a tus clientas ni pasa por sus pagos: te pagan a ti, en efectivo, con tarjeta o por Bizum.",
  },
  {
    pregunta: "¿Qué incluye la puesta en marcha?",
    respuesta:
      "Cinco horas de trabajo nuestro: cargamos tu carta, tu equipo y tu horario, traemos tus clientas, dejamos lista tu web de reservas, damos la formación a tu equipo y te acompañamos por WhatsApp las dos primeras semanas.",
  },
  {
    pregunta: "¿Los mensajes de WhatsApp están incluidos?",
    respuesta:
      "Los botones que abren tu WhatsApp con el mensaje preparado, sí, en todos los planes: recordatorio, confirmación, señal y campañas. Que se envíen solos desde tu número va a tu medida.",
  },
  {
    pregunta: "¿Qué es «a tu medida»?",
    respuesta:
      "Lo que no entra en ningún plan: conectar siShow con tu contabilidad, gestionar formaciones o el WhatsApp automático. Nos cuentas qué necesitas y te lo presupuestamos por escrito.",
  },
  {
    pregunta: "¿Puedo verlo antes de decidir?",
    respuesta:
      "Sí. La demo de un salón de ejemplo está abierta, y si quieres te lo enseñamos con tus servicios y tu equipo, sin compromiso.",
  },
];
