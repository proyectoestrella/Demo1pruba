/**
 * Deuda por plantón: qué citas quedan por resolver, cuánto se debe y a quién
 * hay que cobrárselo hoy.
 *
 * El encargo de Adam (THE BEST SHAVE & BARBER) es este y no otro: que el
 * sistema le ayude con los plantones. La lógica ya existía repartida entre la
 * ficha del cliente y el detalle de la cita, pero no se veía; aquí vive el
 * cálculo, sin store ni React, para que las tres pantallas que lo enseñan
 * (inicio, agenda y ficha) digan exactamente lo mismo y se pueda probar con
 * `bun test`.
 *
 * Vocabulario, a propósito: "deuda", "no vino", "vino tarde", "se la cobras
 * cuando vuelva". Nada de "penalización" ni "estado del cliente" — eso es
 * lenguaje de software, y quien lee esta pantalla es un barbero entre cliente
 * y cliente. Y una honestidad que se repite en pantalla: aquí no se cobra
 * nada solo, solo se anota y se avisa.
 */
import { eur } from "./copy";
import type { Appointment, AppointmentStatus, Client } from "./mock/types";

const DAY_MS = 86_400_000;

/**
 * Los tres desenlaces de una cita que ya pasó. Eran dos ("vino" / "no vino");
 * el de en medio lo pidió Tomás tras usar el panel de Adam: quien llega tarde
 * y sin avisar no es un plantón, pero tampoco una visita normal.
 */
export type Desenlace = "vino" | "tarde" | "no-vino";

/** A qué estado de la cita corresponde cada desenlace. */
export const ESTADO_POR_DESENLACE: Record<Desenlace, AppointmentStatus> = {
  vino: "completed",
  tarde: "late",
  "no-vino": "no-show",
};

/** Cómo se dice cada desenlace en el panel. Un solo sitio: lo usan tres pantallas. */
export const TEXTO_DESENLACE: Record<Desenlace, string> = {
  vino: "Vino",
  tarde: "Vino tarde sin avisar",
  "no-vino": "No vino",
};

/** Estados que significan "esta cita ya está resuelta, no hay nada que preguntar". */
const YA_RESUELTA: AppointmentStatus[] = ["completed", "late", "no-show", "cancelled", "blocked"];

/** Cuántos días hacia atrás se sigue preguntando por una cita sin resolver. */
export const DIAS_POR_RESOLVER = 14;

/**
 * ¿Hay que preguntar qué pasó con esta cita?
 *
 * Sí cuando ya terminó (hora de inicio + duración) y sigue en "pendiente" o
 * "confirmada": nadie dijo si la persona apareció. Se deja un margen hacia
 * atrás para no arrastrar el histórico entero el primer día.
 */
export function necesitaDesenlace(
  a: Appointment,
  now: Date = new Date(),
  diasAtras = DIAS_POR_RESOLVER,
): boolean {
  if (YA_RESUELTA.includes(a.status)) return false;
  const fin = +new Date(a.start) + (a.duration || 0) * 60_000;
  if (!Number.isFinite(fin)) return false;
  const ahora = now.getTime();
  return fin <= ahora && fin >= ahora - diasAtras * DAY_MS;
}

/** Las citas que esperan respuesta, de la más reciente a la más antigua. */
export function citasSinDesenlace(
  appts: Appointment[],
  now: Date = new Date(),
  diasAtras = DIAS_POR_RESOLVER,
): Appointment[] {
  return appts
    .filter((a) => necesitaDesenlace(a, now, diasAtras))
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));
}

/** Lo que un cliente debe, ya interpretado. `null` si no debe nada. */
export interface Deuda {
  /** Importe pendiente, en euros. Siempre > 0. */
  eur: number;
  /** De qué viene ("No vino el 12 sept"), si se apuntó. */
  nota?: string;
  /** Cuándo se anotó (ISO). */
  desde?: string;
  /** ¿Le impide reservar por la web? */
  bloquea: boolean;
  /** El bloqueo lo mantiene el dueño a mano y no caduca solo. */
  mantenido: boolean;
}

export function deudaDe(client: Client | undefined | null): Deuda | null {
  const importe = client?.penaltyEur ?? 0;
  if (!client || importe <= 0) return null;
  return {
    eur: importe,
    nota: client.penaltyNote,
    desde: client.penaltyAt,
    // Ausente = como siempre: deber dinero bloquea la reserva online. Solo un
    // `false` explícito (la decisión "déjasela anotada") deja de bloquear.
    bloquea: client.penaltyBlock !== false,
    mantenido: !!client.penaltyKeep,
  };
}

/** Todos los que deben algo, de más a menos. */
export function clientesConDeuda(clients: Client[]): Client[] {
  return clients
    .filter((c) => (c.penaltyEur ?? 0) > 0)
    .sort((a, b) => (b.penaltyEur ?? 0) - (a.penaltyEur ?? 0));
}

/** Cuánta gente debe y cuánto suma. Es el titular de la pantalla de inicio. */
export function resumenDeDeuda(clients: Client[]): { personas: number; eur: number } {
  const conDeuda = clientesConDeuda(clients);
  return {
    personas: conDeuda.length,
    eur: conDeuda.reduce((s, c) => s + (c.penaltyEur ?? 0), 0),
  };
}

/** Un cliente que debe dinero y viene hoy: el momento exacto de cobrárselo. */
export interface CobroDeHoy {
  client: Client;
  cita: Appointment;
  eur: number;
}

/**
 * Quién de los que deben tiene cita HOY y todavía no ha pasado por caja.
 *
 * Es el aviso que Tomás pidió que saltara a la vista al abrir el panel:
 * "el momento de cobrar es cuando lo tienes delante".
 */
export function cobrosDeHoy(
  appts: Appointment[],
  clients: Client[],
  now: Date = new Date(),
): CobroDeHoy[] {
  const deudores = new Map(clientesConDeuda(clients).map((c) => [c.id, c]));
  if (deudores.size === 0) return [];
  const citas = appts
    .filter((a) => {
      if (a.status === "cancelled" || a.status === "no-show" || a.status === "blocked")
        return false;
      const d = new Date(a.start);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        deudores.has(a.clientId)
      );
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  // Una sola línea por persona aunque tenga dos citas hoy: se debe una vez.
  const vistos = new Set<string>();
  const salida: CobroDeHoy[] = [];
  for (const cita of citas) {
    if (vistos.has(cita.clientId)) continue;
    vistos.add(cita.clientId);
    const client = deudores.get(cita.clientId)!;
    salida.push({ client, cita, eur: client.penaltyEur ?? 0 });
  }
  return salida;
}

/** Frase corta con la deuda, para un badge o una línea de lista. */
export function textoDeuda(deuda: Deuda | null): string | null {
  if (!deuda) return null;
  return `Debe ${eur(deuda.eur)}`;
}
