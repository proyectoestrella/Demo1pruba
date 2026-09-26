import { msDe } from "./instante-cita";
import type { Appointment, Client, Employee, Service } from "./mock/types";
import { fechaCorta } from "./copy";
import { momentoLocal } from "./zona-horaria";

/**
 * Campañas de marketing calculadas a partir de los datos reales del salón:
 * citas, clientes, servicios y equipo. Nada de esto llama a ningún modelo de
 * lenguaje ni "IA" — son reglas sobre las mismas citas que el salón ya tiene
 * en el panel. El panel prepara el texto y la lista; el envío lo hace el
 * dueño desde su propio WhatsApp hasta que exista un canal de envío
 * automático (hoy no existe, ver `store.ts` sobre `clientConfirmedAt`).
 *
 * "Cumpleaños del mes" NO se genera aquí a propósito: `Client` (mock/types.ts)
 * no guarda fecha de nacimiento y no vamos a inventarla. En cuanto el modelo
 * la tenga, esta es la campaña que falta añadir a `buildCampanas`.
 */

const DAY_MS = 86_400_000;
const COSTE_INCLUIDO = "Incluido en tu cuota";

export interface CampanaPersona {
  clientId: string;
  nombre: string;
  telefono?: string;
  /** Una línea de contexto para esta persona: última visita, servicio, etc. */
  detalle: string;
}

export interface Campana {
  id: string;
  titulo: string;
  /** Una frase que explica a quién se dirige, para el subtítulo de la tarjeta. */
  resumenAQuien: string;
  /** Número destacado de la tarjeta — casi siempre personas.length, salvo en
   * "Huecos flojos", donde es el número de huecos libres a la semana. */
  cifra: number;
  cifraLabel: string;
  personas: CampanaPersona[];
  /** Texto sugerido, editable en el panel antes de copiarlo o abrir WhatsApp. */
  mensaje: string;
  coste: string;
}

export interface CampanasInput {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  employees: Employee[];
  salonName: string;
  salonAddress: string;
  /** Fijo para que los tests sean deterministas; por defecto "ahora". */
  now?: Date;
  /**
   * Zona del salón para decidir día y franja de cada cita («los martes por
   * la tarde»). Sin ella, la hora local del dispositivo, como hasta ahora.
   */
  timeZone?: string;
}

/* ---------------------------------------------------------------------- */
/* Utilidades compartidas                                                  */
/* ---------------------------------------------------------------------- */

function serviceMapOf(services: Service[]): Record<string, Service> {
  return Object.fromEntries(services.map((s) => [s.id, s]));
}

function nombresServicios(ids: string[], map: Record<string, Service>): string {
  return ids.map((id) => map[id]?.name).filter(Boolean).join(" + ") || "—";
}

function formatDateEs(iso: string): string {
  return fechaCorta(iso);
}

/** Deja solo dígitos: "+34 611 111 222" → "34611111222", listo para wa.me. */
export function phoneDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/** Enlace de WhatsApp para un cliente concreto con el mensaje ya cargado. */
export function whatsappUrl(phone: string, mensaje: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Citas agrupadas por clienta, en el orden original. Se calcula una vez por
 * lista (la store sustituye el array en cada cambio, así que la identidad
 * del array es la versión de los datos). Antes cada campaña recorría TODAS
 * las citas por CADA clienta: 595 × 3.344 en la demo PeluChic, tres veces
 * (barrido de calidad 2026-09-26).
 */
const indicePorClienta = new WeakMap<Appointment[], Map<string, Appointment[]>>();
function citasDeClienta(appointments: Appointment[], clientId: string): Appointment[] {
  let indice = indicePorClienta.get(appointments);
  if (!indice) {
    indice = new Map();
    for (const a of appointments) {
      const lista = indice.get(a.clientId);
      if (lista) lista.push(a);
      else indice.set(a.clientId, [a]);
    }
    indicePorClienta.set(appointments, indice);
  }
  return indice.get(clientId) ?? [];
}

function ultimaVisitaCompletada(appointments: Appointment[], clientId: string): Appointment | undefined {
  // La más reciente; a igualdad de hora, la primera de la lista (como el sort estable de antes).
  let mejor: Appointment | undefined;
  let mejorMs = -Infinity;
  for (const a of citasDeClienta(appointments, clientId)) {
    if (a.status !== "completed") continue;
    const ms = msDe(a);
    if (mejor === undefined || ms > mejorMs) { mejor = a; mejorMs = ms; }
  }
  return mejor;
}

/* ---------------------------------------------------------------------- */
/* 1. Clientes que no vuelven                                             */
/* ---------------------------------------------------------------------- */

export const SEMANAS_INACTIVIDAD = 5;
const DIAS_INACTIVIDAD = SEMANAS_INACTIVIDAD * 7;

export function clientesQueNoVuelven(
  appointments: Appointment[],
  clients: Client[],
  services: Service[],
  salonName: string,
  now: Date = new Date(),
): Campana | null {
  const serviceMap = serviceMapOf(services);
  const nowMs = +now;

  const candidatos = clients
    .map((client) => {
      const ultima = ultimaVisitaCompletada(appointments, client.id);
      if (!ultima) return null; // nunca ha venido: eso no es "no vuelve", es un lead
      const dias = (nowMs - +new Date(ultima.start)) / DAY_MS;
      if (dias < DIAS_INACTIVIDAD) return null;

      // Si ya tiene una cita futura puesta, ya ha vuelto: no hace falta campaña.
      const tieneProximaCita = citasDeClienta(appointments, client.id).some(
        (a) =>
          (a.status === "pending" || a.status === "confirmed") &&
          msDe(a) > nowMs,
      );
      if (tieneProximaCita) return null;

      return { client, ultima, dias };
    })
    .filter((c): c is { client: Client; ultima: Appointment; dias: number } => c !== null)
    .sort((a, b) => b.dias - a.dias);

  if (candidatos.length === 0) return null;

  const personas: CampanaPersona[] = candidatos.map(({ client, ultima }) => ({
    clientId: client.id,
    nombre: client.name,
    telefono: client.phone,
    detalle: `Última visita: ${formatDateEs(ultima.start)} · ${nombresServicios(ultima.serviceIds, serviceMap)}`,
  }));

  return {
    id: "no-vuelven",
    titulo: "Clientas que no vuelven",
    resumenAQuien: `Sin cita desde hace más de ${SEMANAS_INACTIVIDAD} semanas`,
    cifra: personas.length,
    cifraLabel: personas.length === 1 ? "clienta" : "clientas",
    personas,
    mensaje: `Hola, soy de ${salonName}. Hace tiempo que no te vemos por aquí y nos encantaría cuidarte de nuevo. ¿Te reservamos un hueco esta semana?`,
    coste: COSTE_INCLUIDO,
  };
}

/* ---------------------------------------------------------------------- */
/* 2. Huecos flojos                                                       */
/* ---------------------------------------------------------------------- */

const ROLLING_WEEKS = 6;
const HORA_CORTE_TARDE = 15;
const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

interface HuecoFlojo {
  diaLabel: string;
  franjaLabel: "mañana" | "tarde";
  capacidadSemanal: number;
  ocupacionPct: number;
  huecosLibres: number;
}

/**
 * Recorre los 14 cruces día×franja (7 días, mañana/tarde) y devuelve el de
 * menor ocupación entre los que el salón tiene abiertos, mirando las últimas
 * `ROLLING_WEEKS` semanas de citas reales (no las futuras, que aún están
 * incompletas). `null` si no hay ningún cruce con capacidad — agenda vacía o
 * cerrado siempre.
 */
export function calcularHuecoFlojo(
  appointments: Appointment[],
  employees: Employee[],
  now: Date,
  timeZone?: string,
): HuecoFlojo | null {
  const nowMs = +now;
  const desde = nowMs - ROLLING_WEEKS * 7 * DAY_MS;
  const pasadas = appointments.filter(
    (a) => a.status !== "cancelled" && msDe(a) >= desde && msDe(a) < nowMs,
  );

  // Slots usados por día×franja, en UNA pasada (antes eran 14 pasadas creando
  // un Date por cita en cada una). Índice: weekday * 2 + (tarde ? 1 : 0).
  const usadosPorCruce = new Array<number>(14).fill(0);
  for (const a of pasadas) {
    let dia: number;
    let hora: number;
    if (timeZone) {
      const m = momentoLocal(a.start, timeZone);
      dia = m.weekday;
      hora = Math.floor(m.minuto / 60);
    } else {
      const d = new Date(a.start);
      dia = d.getDay();
      hora = d.getHours();
    }
    usadosPorCruce[dia * 2 + (hora < HORA_CORTE_TARDE ? 0 : 1)] += a.duration / 30;
  }

  let mejor: HuecoFlojo | null = null;
  let mejorOcupacion = Infinity;
  let mejorHuecos = -1;

  for (let weekday = 0; weekday < 7; weekday++) {
    for (const half of ["mañana", "tarde"] as const) {
      let capacidadSlots = 0;
      for (const emp of employees) {
        const sched = emp.schedule[weekday];
        if (!sched) continue;
        const start = half === "mañana" ? sched.start : Math.max(sched.start, HORA_CORTE_TARDE);
        const end = half === "mañana" ? Math.min(sched.end, HORA_CORTE_TARDE) : sched.end;
        if (end > start) capacidadSlots += (end - start) * 2; // slots de 30 min
      }
      if (capacidadSlots === 0) continue; // cerrado en esa franja

      const usadasSlots = usadosPorCruce[weekday * 2 + (half === "mañana" ? 0 : 1)];

      const capacidadTotal = capacidadSlots * ROLLING_WEEKS;
      const ocupacionPct = Math.min(100, Math.round((usadasSlots / capacidadTotal) * 100));
      const usadosSemanaProm = usadasSlots / ROLLING_WEEKS;
      const huecosLibres = Math.max(0, Math.round(capacidadSlots - usadosSemanaProm));

      if (ocupacionPct < mejorOcupacion || (ocupacionPct === mejorOcupacion && huecosLibres > mejorHuecos)) {
        mejorOcupacion = ocupacionPct;
        mejorHuecos = huecosLibres;
        mejor = {
          diaLabel: DIAS_ES[weekday],
          franjaLabel: half,
          capacidadSemanal: capacidadSlots,
          ocupacionPct,
          huecosLibres,
        };
      }
    }
  }

  return mejor;
}

export function huecosFlojos(
  appointments: Appointment[],
  clients: Client[],
  employees: Employee[],
  salonName: string,
  now: Date = new Date(),
  timeZone?: string,
): Campana | null {
  const hueco = calcularHuecoFlojo(appointments, employees, now, timeZone);
  if (!hueco || hueco.huecosLibres <= 0) return null;

  const personas: CampanaPersona[] = clients
    .map((cliente) => {
      const ultima = ultimaVisitaCompletada(appointments, cliente.id);
      return ultima ? { cliente, ultima } : null;
    })
    .filter((v): v is { cliente: Client; ultima: Appointment } => v !== null)
    .sort((a, b) => +new Date(b.ultima.start) - +new Date(a.ultima.start))
    .map(({ cliente, ultima }) => ({
      clientId: cliente.id,
      nombre: cliente.name,
      telefono: cliente.phone,
      detalle: `Última visita: ${formatDateEs(ultima.start)}`,
    }));

  if (personas.length === 0) return null;

  return {
    id: "huecos-flojos",
    titulo: `Llena los ${hueco.diaLabel} por la ${hueco.franjaLabel}`,
    resumenAQuien: "Tus clientas activas, para que prueben ese horario",
    cifra: hueco.huecosLibres,
    cifraLabel: `huecos libres los ${hueco.diaLabel} por la ${hueco.franjaLabel} cada semana (${hueco.ocupacionPct}% de ocupación)`,
    personas,
    mensaje: `En ${salonName} tenemos hueco los ${hueco.diaLabel} por la ${hueco.franjaLabel}. Resérvalo esta semana y te hacemos un 15% de descuento.`,
    coste: COSTE_INCLUIDO,
  };
}

/* ---------------------------------------------------------------------- */
/* 3. Segunda visita                                                      */
/* ---------------------------------------------------------------------- */

export const DIAS_SEGUNDA_VISITA = 60;

export function segundaVisita(
  appointments: Appointment[],
  clients: Client[],
  services: Service[],
  employees: Employee[],
  salonName: string,
  now: Date = new Date(),
): Campana | null {
  const serviceMap = serviceMapOf(services);
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const nowMs = +now;

  const personas: CampanaPersona[] = clients
    .map((client): CampanaPersona | null => {
      const todas = citasDeClienta(appointments, client.id).filter((a) => a.status !== "cancelled");
      if (todas.length !== 1) return null; // solo cuenta con EXACTAMENTE una cita en toda su historia
      const unica = todas[0];
      if (unica.status !== "completed") return null; // aún no ha pasado de verdad por el salón
      const dias = (nowMs - +new Date(unica.start)) / DAY_MS;
      if (dias < 0 || dias > DIAS_SEGUNDA_VISITA) return null;

      const profesional = employeeMap[unica.employeeId]?.name;
      return {
        clientId: client.id,
        nombre: client.name,
        telefono: client.phone,
        detalle: `Primera cita: ${formatDateEs(unica.start)} · ${nombresServicios(unica.serviceIds, serviceMap)}${profesional ? ` con ${profesional}` : ""}`,
      };
    })
    .filter((p): p is CampanaPersona => p !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  if (personas.length === 0) return null;

  return {
    id: "segunda-visita",
    titulo: "Segunda visita",
    resumenAQuien: `Una sola cita en los últimos ${DIAS_SEGUNDA_VISITA} días`,
    cifra: personas.length,
    cifraLabel: personas.length === 1 ? "clienta nueva" : "clientas nuevas",
    personas,
    mensaje: `¡Hola! Nos alegró mucho tenerte por primera vez en ${salonName}. ¿Te reservamos ya tu segunda cita para seguir cuidando tu imagen?`,
    coste: COSTE_INCLUIDO,
  };
}

/* ---------------------------------------------------------------------- */
/* 4. Reseña tras la cita                                                 */
/* ---------------------------------------------------------------------- */

export const DIAS_RESENA = 7;

export function resenaTrasLaCita(
  appointments: Appointment[],
  clients: Client[],
  salonName: string,
  salonAddress: string,
  now: Date = new Date(),
): Campana | null {
  const nowMs = +now;
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  // Una entrada por cliente: si ha vuelto varias veces en la ventana, se queda
  // con la más reciente.
  const porCliente = new Map<string, Appointment>();
  for (const a of appointments) {
    if (a.status !== "completed") continue;
    const dias = (nowMs - msDe(a)) / DAY_MS;
    if (dias < 0 || dias > DIAS_RESENA) continue;
    const previa = porCliente.get(a.clientId);
    if (!previa || msDe(a) > +new Date(previa.start)) porCliente.set(a.clientId, a);
  }

  const personas: CampanaPersona[] = [...porCliente.entries()]
    .map(([clientId, a]): CampanaPersona | null => {
      const cliente = clientMap[clientId];
      if (!cliente) return null;
      return {
        clientId,
        nombre: cliente.name,
        telefono: cliente.phone,
        detalle: `Atendido/a el ${formatDateEs(a.start)}`,
      };
    })
    .filter((p): p is CampanaPersona => p !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  if (personas.length === 0) return null;

  // Sin ficha de Google (ni placeId) en el modelo del salón: en vez de
  // inventar un enlace de reseña, se manda a una búsqueda de Maps con el
  // nombre y la dirección reales — desde ahí el cliente llega a "Reseñas" en
  // un toque, y el enlace es honesto con lo que sabemos.
  const enlace = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salonName} ${salonAddress}`)}`;

  return {
    id: "resena",
    titulo: "Reseña tras la cita",
    resumenAQuien: `Atendidos en los últimos ${DIAS_RESENA} días`,
    cifra: personas.length,
    cifraLabel: personas.length === 1 ? "clienta" : "clientas",
    personas,
    mensaje: `Gracias por venir a ${salonName}. Si te has ido contento, nos ayudaría muchísimo que nos dejaras una reseña en Google: ${enlace}`,
    coste: COSTE_INCLUIDO,
  };
}

/* ---------------------------------------------------------------------- */
/* 5. Servicio que más deja (upsell)                                      */
/* ---------------------------------------------------------------------- */

export function servicioQueMasDeja(
  appointments: Appointment[],
  clients: Client[],
  services: Service[],
  salonName: string,
  now: Date = new Date(),
): Campana | null {
  void now; // sin ventana temporal: mira todo el historial de citas activas
  const serviceMap = serviceMapOf(services);
  const activas = appointments.filter((a) => a.status !== "cancelled");

  // Servicio "base": el que más veces se reserva solo, sin nada más.
  const solasCount = new Map<string, number>();
  for (const a of activas) {
    if (a.serviceIds.length === 1) {
      const id = a.serviceIds[0];
      solasCount.set(id, (solasCount.get(id) ?? 0) + 1);
    }
  }
  const baseEntry = [...solasCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const baseService = baseEntry ? serviceMap[baseEntry[0]] : undefined;
  if (!baseEntry || !baseService) return null;
  const baseId = baseEntry[0];

  // Servicio "complementario": el que más veces acompaña al base cuando la
  // cita lleva dos servicios. Si nadie los ha combinado nunca, no hay upsell
  // que ofrecer con datos reales — no se inventa uno.
  const combosCount = new Map<string, number>();
  for (const a of activas) {
    if (a.serviceIds.length === 2 && a.serviceIds.includes(baseId)) {
      const otro = a.serviceIds.find((id) => id !== baseId);
      if (otro) combosCount.set(otro, (combosCount.get(otro) ?? 0) + 1);
    }
  }
  const comboEntry = [...combosCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const comboService = comboEntry ? serviceMap[comboEntry[0]] : undefined;
  if (!comboEntry || !comboService) return null;
  const comboId = comboEntry[0];

  // Clientes que SOLO han pedido el servicio base y nunca el complementario.
  const porCliente = new Map<string, { veces: number; ultima: Appointment; proboCombo: boolean }>();
  for (const a of activas) {
    const entry = porCliente.get(a.clientId) ?? { veces: 0, ultima: a, proboCombo: false };
    if (a.serviceIds.includes(comboId)) entry.proboCombo = true;
    if (a.serviceIds.length === 1 && a.serviceIds[0] === baseId) {
      entry.veces += 1;
      if (msDe(a) > +new Date(entry.ultima.start)) entry.ultima = a;
    }
    porCliente.set(a.clientId, entry);
  }

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const personas: CampanaPersona[] = [...porCliente.entries()]
    .filter(([, v]) => v.veces > 0 && !v.proboCombo)
    .sort((a, b) => b[1].veces - a[1].veces)
    .map(([clientId, v]): CampanaPersona | null => {
      const cliente = clientMap[clientId];
      if (!cliente) return null;
      return {
        clientId,
        nombre: cliente.name,
        telefono: cliente.phone,
        detalle: `${v.veces} ${v.veces === 1 ? "vez" : "veces"} · Última: ${formatDateEs(v.ultima.start)}`,
      };
    })
    .filter((p): p is CampanaPersona => p !== null);

  if (personas.length === 0) return null;

  return {
    id: "upsell",
    titulo: `Ofrece ${comboService.name.toLowerCase()}`,
    resumenAQuien: `Piden ${baseService.name.toLowerCase()} pero nunca ${comboService.name.toLowerCase()}`,
    cifra: personas.length,
    cifraLabel: personas.length === 1 ? "clienta" : "clientas",
    personas,
    mensaje: `¿Ya has probado ${comboService.name.toLowerCase()}? A quienes reservan ${baseService.name.toLowerCase()} en ${salonName} les suele encantar — la próxima vez que vengas, pregúntanos.`,
    coste: COSTE_INCLUIDO,
  };
}

/* ---------------------------------------------------------------------- */
/* Montaje                                                                 */
/* ---------------------------------------------------------------------- */

export function buildCampanas(input: CampanasInput): Campana[] {
  const now = input.now ?? new Date();
  const candidatas = [
    clientesQueNoVuelven(input.appointments, input.clients, input.services, input.salonName, now),
    huecosFlojos(input.appointments, input.clients, input.employees, input.salonName, now, input.timeZone),
    segundaVisita(
      input.appointments,
      input.clients,
      input.services,
      input.employees,
      input.salonName,
      now,
    ),
    resenaTrasLaCita(input.appointments, input.clients, input.salonName, input.salonAddress, now),
    servicioQueMasDeja(input.appointments, input.clients, input.services, input.salonName, now),
  ];
  return candidatas.filter((c): c is Campana => c !== null);
}

/** «Este mes puedes recuperar N clientes y rellenar M huecos» — los dos únicos
 * números de las seis campañas que representan clientes/huecos recuperables. */
export function resumenDelMes(campanas: Campana[]): { recuperables: number; huecos: number } {
  const noVuelven = campanas.find((c) => c.id === "no-vuelven");
  const huecos = campanas.find((c) => c.id === "huecos-flojos");
  return {
    recuperables: noVuelven?.cifra ?? 0,
    huecos: huecos?.cifra ?? 0,
  };
}

/* ---------------------------------------------------------------------- */
/* Comparativa honesta con lo que cuestan otras plataformas                */
/* ---------------------------------------------------------------------- */

/**
 * Precios de referencia de plataformas de marketing que salones como este
 * pagan aparte (email por paquete de envíos, SMS por campaña, recordatorios
 * de WhatsApp por suscripción mensual). No son una estimación: son los
 * precios que un salón real paga hoy por cada uno de los tres canales.
 */
export const COMPARATIVA_OTRAS_PLATAFORMAS: { concepto: string; otras: string; siShow: string }[] = [
  {
    concepto: "Campaña de correo (por 1.000 envíos)",
    otras: "1 €",
    siShow: "Sin coste extra: lista y mensaje desde el panel",
  },
  {
    concepto: "Campaña de SMS",
    otras: "25 € cada campaña",
    siShow: "Sin coste extra: la mandas tú por WhatsApp en un toque",
  },
  // Lo que no existe no se vende: no hay recordatorio automático. Lo que hay
  // es el envío a mano, uno a uno, desde la hoja de mañana.
  { concepto: "Recordatorios por WhatsApp", otras: "35 €/mes", siShow: "Sin coste extra: los mandas tú con un toque desde la hoja de mañana" },
];
