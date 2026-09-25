/**
 * Fuentes de prueba de la rama Arena sobre la demo PeluChic: el mismo perfil
 * que prueba-peluchic.ts de BACKEND (equipo, carta, horario y señal) con la
 * semilla de peluquería (ya trae lo cobrado), pero servido por el adaptador
 * del panel, `crearFuentesPanel`. Solo para tests; no lo importa el panel.
 */
import { salon, employeesForType, servicesForType } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import type { SalonProfile } from "../mock/types";
import type { PlanSishow } from "./fuentes";
import { crearFuentesPanel, type EstadoPanel } from "./fuentes-panel";
import { crearAsistente } from "./responder";

export const HORARIO_PELUCHIC = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "9:00–14:00", "Cerrado"];
const EQUIPO = ["María~Estilista, novias y peinados de evento", "Sara~Colorista, color y mechas/balayage", "Noelia~Estilista, recogidos y tratamientos"];
const CARTA = [
  "Corte y peinado~45~25~Peluquería",
  "Tinte~40~35~Peluquería",
  "Mechas / balayage~120~80~Peluquería",
  "Peinado de novia~90~90~Peluquería",
  "Recogido de evento~60~45~Peluquería",
  "Tratamiento capilar~30~20~Peluquería",
];

let cache: { estado: EstadoPanel; equipo: ReturnType<typeof employeesForType> } | null = null;

export function datosPeluChicArena() {
  if (cache) return cache;
  const equipo = employeesForType("peluqueria", EQUIPO, undefined, HORARIO_PELUCHIC);
  const servicios = servicesForType("peluqueria", CARTA);
  const seed = buildSeed("peluqueria", equipo, servicios, { duracionFlexible: true });
  const perfil: SalonProfile = {
    ...salon,
    id: "peluchic",
    slug: "peluchic",
    name: "PeluChic",
    tagline: "Peluquería",
    address: "Calle Princesa de Éboli, 100, 28050 Madrid",
    openingHours: HORARIO_PELUCHIC,
    depositEnabled: true,
    depositAmountEur: 20,
    depositBizumPhone: "666 77 67 31",
    duracionFlexible: true,
  };
  cache = { estado: { appointments: seed.appointments, clients: seed.clients, services: servicios, waitlist: seed.waitlist, salonProfile: perfil, realSalonSlug: null }, equipo };
  return cache;
}

export function asistentePeluChicArena(opciones: { ahora?: Date; plan?: PlanSishow } = {}) {
  const d = datosPeluChicArena();
  const fuentes = crearFuentesPanel(() => d.estado, () => d.equipo, { plan: opciones.plan, enlace: () => "/s/peluchic", ahora: opciones.ahora ? () => opciones.ahora! : undefined });
  return { datos: d, fuentes, asistente: crearAsistente(fuentes) };
}
