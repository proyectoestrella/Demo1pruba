import marioPhoto from "@/assets/stylist-mario.jpg";
import diegoPhoto from "@/assets/stylist-diego.jpg";
import rubenPhoto from "@/assets/stylist-ruben.jpg";
import type { Employee, EmployeeId, SalonProfile, Service } from "./types";
import { DEFAULT_OPENING_HOURS } from "../opening-hours";
import {
  EMPLOYEE_OVERLAY,
  SERVICE_CATALOG,
  placeholderAvatar,
  showsRealPhotos,
  type BusinessType,
} from "../business-type";

export const salon: SalonProfile = {
  id: "los-mosqueteros",
  slug: "los-mosqueteros",
  name: "Barbería Pepe",
  tagline: "Barbería clásica",
  about:
    "Barbería de toda la vida en el corazón de la ciudad. Tres profesionales, una misma obsesión: que salgas de aquí sintiéndote como nuevo.",
  address: "Calle del Pez 23, Madrid",
  phone: "+34 910 000 000",
  instagram: "@barberiapepe",
  openingHours: DEFAULT_OPENING_HOURS,
  rating: 4.8,
  reviewCount: 312,
  specialties: ["degradados", "barba a navaja", "afeitado clásico", "cortes de tijera"],
  heroImage: "",
  photoCount: 0,
};

/**
 * Base del equipo: horario, color de marca, antigüedad y foto no cambian con
 * el tipo de negocio, solo el nombre y la especialidad (ver `business-type.ts`).
 * Se mantienen los mismos tres ids para no romper las citas de ejemplo, que
 * referencian `employeeId`.
 */
const fullWeek = [
  null, // Sun closed
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 18 },
];

const BASE_EMPLOYEES: Array<Omit<Employee, "name" | "specialty">> = [
  {
    id: "mario",
    yearsExperience: 8,
    photo: marioPhoto,
    colorVar: "--stylist-mario",
    schedule: fullWeek,
  },
  {
    id: "diego",
    yearsExperience: 6,
    photo: diegoPhoto,
    colorVar: "--stylist-diego",
    schedule: [
      null,
      null,
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 18 },
    ],
  },
  {
    id: "ruben",
    yearsExperience: 10,
    photo: rubenPhoto,
    colorVar: "--stylist-ruben",
    schedule: [
      null,
      { start: 12, end: 20 },
      { start: 12, end: 20 },
      null,
      { start: 12, end: 20 },
      { start: 12, end: 20 },
      { start: 10, end: 18 },
    ],
  },
];

/**
 * Versión pura, sin mutación: dado un tipo, el equipo que le corresponde.
 * La usan las páginas públicas (s.$salonSlug.*) para que el equipo salga
 * bien en el primer render del servidor — antes de que corra ningún efecto
 * de cliente — igual que ya hace `useDisplayProfile` con el resto del perfil.
 */
export function employeesForType(type: BusinessType): Employee[] {
  return buildEmployees(type);
}

function buildEmployees(type: BusinessType): Employee[] {
  return BASE_EMPLOYEES.map((base) => {
    const overlay = EMPLOYEE_OVERLAY[type][base.id as EmployeeId];
    return {
      ...base,
      name: overlay.name,
      specialty: overlay.specialty,
      // Las tres fotos de stock son barberos con navaja: fuera de barbería se
      // sustituyen por un avatar de iniciales, nunca por una cara que no
      // corresponde al oficio ni al género del nombre que se está mostrando.
      photo: showsRealPhotos(type) ? base.photo : placeholderAvatar(overlay.name, base.id),
    };
  });
}

/**
 * `employees`/`employeeMap` son arrays y objetos MUTADOS EN SITIO por
 * `setEmployeesForType`, no reasignados: así cualquier pantalla que los
 * importe de forma estática (`import { employees } from "@/lib/mock/salon"`)
 * ve el equipo del tipo activo en el siguiente render, sin tener que migrar
 * esa pantalla a leer de la store. El disparador vive en `store.ts`.
 */
export const employees: Employee[] = buildEmployees("barberia");
export const employeeMap: Record<string, Employee> = Object.fromEntries(
  employees.map((e) => [e.id, e]),
);

export function setEmployeesForType(type: BusinessType) {
  const next = buildEmployees(type);
  employees.length = 0;
  employees.push(...next);
  for (const key of Object.keys(employeeMap)) delete employeeMap[key];
  for (const e of employees) employeeMap[e.id] = e;
}

/**
 * Mismo patrón de mutación en sitio que `employees`, y por el mismo motivo:
 * hay pantallas (la carta pública, la lista de espera del panel, el diálogo
 * de nueva cita…) que importan `services`/`serviceMap` directamente de aquí
 * en vez de leerlos de la store.
 */
export const services: Service[] = SERVICE_CATALOG.barberia.map((s) => ({ ...s }));
export const serviceMap: Record<string, Service> = Object.fromEntries(
  services.map((s) => [s.id, s]),
);

export function setServicesForType(type: BusinessType) {
  const next = SERVICE_CATALOG[type].map((s) => ({ ...s }));
  services.length = 0;
  services.push(...next);
  for (const key of Object.keys(serviceMap)) delete serviceMap[key];
  for (const s of services) serviceMap[s.id] = s;
}

export const DEPOSIT_THRESHOLD_MIN = 90;
export const DEPOSIT_RATE = 0.2;

export function requiresDeposit(durationMin: number) {
  return durationMin > DEPOSIT_THRESHOLD_MIN;
}

export function depositFor(priceEur: number, durationMin: number) {
  return requiresDeposit(durationMin) ? Math.round(priceEur * DEPOSIT_RATE) : 0;
}
