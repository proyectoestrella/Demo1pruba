/**
 * Fuentes de prueba sobre la demo PeluChic: el perfil del enlace ?d= de la
 * demo (equipo, carta, horario y señal) con la semilla de peluquería. Solo
 * para tests; no lo importa el panel.
 */
import { salon } from "../mock/salon";
import { employeesForType, servicesForType } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import type { SalonProfile } from "../mock/types";
import { crearFuentesBackend, type DatosBackend } from "./fuentes-backend";
import type { PlanSishow } from "./fuentes";
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

type DatosPeluChic = Omit<DatosBackend, "ahora" | "plan">;

let cache: DatosPeluChic | null = null;

/**
 * La semilla sale del reloj del sistema (`buildSeed` pone las citas de «hoy»
 * y del sábado alrededor de `new Date()`), así que se cachea la primera.
 * `{ nueva: true }` construye una aparte sin tocar la caché: es lo que usan
 * los tests que fijan el reloj (`setSystemTime`) para no depender del día
 * real (un domingo, con el salón cerrado, la demo no trae las solicitudes
 * de hoy).
 */
export function datosPeluChic(opciones: { nueva?: boolean } = {}): DatosPeluChic {
  if (cache && !opciones.nueva) return cache;
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
    timeZone: "Europe/Madrid",
  };
  const datos: DatosPeluChic = { citas: seed.appointments, clientes: seed.clients, equipo, servicios, listaEspera: seed.waitlist, perfil, enlace: "/s/peluchic" };
  if (!opciones.nueva) cache = datos;
  return datos;
}

export function asistentePeluChic(opciones: { ahora?: Date; plan?: PlanSishow; base?: DatosPeluChic } = {}) {
  const { base, ...resto } = opciones;
  const datos = { ...(base ?? datosPeluChic()), ...resto };
  const fuentes = crearFuentesBackend(datos);
  return { datos, fuentes, asistente: crearAsistente(fuentes) };
}
