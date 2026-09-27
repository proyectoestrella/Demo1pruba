import { msDe } from "./instante-cita";
import type { Appointment, Client, SalonProfile, Service } from "./mock/types";
import { fechaCorta } from "./copy";
import type { Campana, CampanaPersona } from "./campanas";

/**
 * Campañas que salen de la realidad de CADA salón (lote P): su temporada de
 * eventos y sus propios canales —boletín, tienda, Instagram—. Igual que el
 * resto de lib/campanas.ts, son reglas sobre sus citas: sin modelo de
 * lenguaje, sin inventar nada. Si el salón no tiene servicios de evento, ni
 * boletín ni tienda, estas campañas no salen.
 */

const DAY_MS = 86_400_000;
const COSTE_INCLUIDO = "Incluido en tu cuota";

/** Canales propios del salón que las campañas pueden recordar. */
export type CanalesSalon = Pick<SalonProfile, "enlaces" | "boletin">;

/** Servicios de un día señalado: novias, recogidos, comuniones, invitadas, eventos y maquillaje. */
const EVENTO = /novia|boda|recogido|evento|fiesta|comuni[oó]n|madrina|invitad|maquillaje|focos/i;

/**
 * La temporada que toca preparar según el mes: lo que se reserva con
 * antelación en una peluquería que hace bodas, comuniones y eventos.
 */
export function temporadaDeEventos(now: Date): { titulo: string; gancho: string } {
  const mes = now.getMonth(); // 0 = enero
  if (mes >= 8 && mes <= 9) return { titulo: "Bodas de otoño y fiestas de fin de año", gancho: "bodas de otoño, cenas de empresa y Nochevieja" };
  if (mes >= 10) return { titulo: "Fiestas de Navidad y Nochevieja", gancho: "cenas de Navidad y Nochevieja" };
  if (mes <= 2) return { titulo: "Comuniones y bodas de primavera", gancho: "comuniones y bodas de primavera" };
  if (mes <= 5) return { titulo: "Comuniones, bodas y graduaciones", gancho: "comuniones, bodas y graduaciones" };
  return { titulo: "Bodas y eventos de verano", gancho: "bodas y eventos de verano" };
}

/**
 * «Novias y eventos de temporada»: clientas que en el último año pidieron un
 * servicio de día señalado (novia, recogido, invitada, maquillaje…), sin
 * cita futura, para que reserven con tiempo el siguiente. `null` si la carta
 * no tiene servicios de evento o nadie los ha pedido.
 */
export function eventosDeTemporada(
  appointments: Appointment[],
  clients: Client[],
  services: Service[],
  salonName: string,
  now: Date = new Date(),
): Campana | null {
  const deEvento = new Set(services.filter((s) => EVENTO.test(s.name)).map((s) => s.id));
  if (deEvento.size === 0) return null;
  const nowMs = +now;
  const nombre = new Map(services.map((s) => [s.id, s.name]));
  const ultimaPorClienta = new Map<string, Appointment>();
  const conCitaFutura = new Set<string>();
  for (const a of appointments) {
    const ms = msDe(a);
    if ((a.status === "pending" || a.status === "confirmed") && ms > nowMs) conCitaFutura.add(a.clientId);
    if (a.status !== "completed" || ms > nowMs || nowMs - ms > 365 * DAY_MS) continue;
    if (!a.serviceIds.some((id) => deEvento.has(id))) continue;
    const previa = ultimaPorClienta.get(a.clientId);
    if (!previa || ms > msDe(previa)) ultimaPorClienta.set(a.clientId, a);
  }
  const fichas = new Map(clients.map((c) => [c.id, c]));
  const personas: CampanaPersona[] = [...ultimaPorClienta.entries()]
    .filter(([id]) => !conCitaFutura.has(id) && fichas.has(id))
    .sort((a, b) => msDe(b[1]) - msDe(a[1]))
    .map(([id, a]) => {
      const c = fichas.get(id) as Client;
      const servicio = a.serviceIds.map((s) => nombre.get(s)).find((n) => n && EVENTO.test(n)) ?? "Evento";
      return { clientId: id, nombre: c.name, telefono: c.phone, detalle: `${servicio} · ${fechaCorta(a.start)}` };
    });
  if (personas.length === 0) return null;
  const temporada = temporadaDeEventos(now);
  return {
    id: "eventos-temporada",
    titulo: temporada.titulo,
    resumenAQuien: "Vinieron a peinarse para un día señalado en el último año",
    cifra: personas.length,
    cifraLabel: personas.length === 1 ? "clienta" : "clientas",
    personas,
    mensaje: `Hola, soy de ${salonName}. Ya estamos preparando ${temporada.gancho}: si tienes algún evento, resérvate el peinado y el maquillaje con tiempo, que los sábados vuelan.`,
    coste: COSTE_INCLUIDO,
  };
}

/**
 * «Tu boletín y tu tienda»: a quien vino en el último mes, una invitación a
 * seguir al salón por sus propios canales. Solo sale si el salón tiene
 * boletín o tienda, y el mensaje solo nombra lo que existe.
 */
export function boletinYTienda(
  appointments: Appointment[],
  clients: Client[],
  salonName: string,
  canales: CanalesSalon | undefined,
  now: Date = new Date(),
): Campana | null {
  const boletin = canales?.boletin?.texto && canales.boletin.url ? canales.boletin : undefined;
  const tienda = canales?.enlaces?.tienda;
  if (!boletin && !tienda) return null;
  const nowMs = +now;
  const ultima = new Map<string, Appointment>();
  for (const a of appointments) {
    const ms = msDe(a);
    if (a.status !== "completed" || ms > nowMs || nowMs - ms > 30 * DAY_MS) continue;
    const previa = ultima.get(a.clientId);
    if (!previa || ms > msDe(previa)) ultima.set(a.clientId, a);
  }
  const fichas = new Map(clients.map((c) => [c.id, c]));
  const personas: CampanaPersona[] = [...ultima.entries()]
    .filter(([id]) => fichas.has(id))
    .sort((a, b) => msDe(b[1]) - msDe(a[1]))
    .map(([id, a]) => {
      const c = fichas.get(id) as Client;
      return { clientId: id, nombre: c.name, telefono: c.phone, detalle: `Vino el ${fechaCorta(a.start)}` };
    });
  if (personas.length === 0) return null;
  const partes = [`Gracias por venir a ${salonName}.`];
  if (boletin) partes.push(`Para enterarte de nuestras promociones, ofertas y eventos, apúntate a nuestro boletín: ${boletin.url}`);
  if (tienda) partes.push(`Y si buscas un regalo, pásate por nuestra tienda online: ${tienda}`);
  return {
    id: "boletin-tienda",
    titulo: boletin && tienda ? "Tu boletín y tu tienda" : boletin ? "Tu boletín" : "Tu tienda online",
    resumenAQuien: "Vinieron en el último mes",
    cifra: personas.length,
    cifraLabel: personas.length === 1 ? "clienta" : "clientas",
    personas,
    mensaje: partes.join(" "),
    coste: COSTE_INCLUIDO,
  };
}

/** Coletilla de Instagram para el mensaje de reseña, si el salón lo tiene. */
export function coletillaInstagram(canales: CanalesSalon | undefined): string {
  const ig = canales?.enlaces?.instagram;
  return ig ? ` Y si te apetece enseñarlo, etiquétanos en Instagram: ${ig}` : "";
}
