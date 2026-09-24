import marioPhoto from "@/assets/stylist-mario.jpg";
import diegoPhoto from "@/assets/stylist-diego.jpg";
import rubenPhoto from "@/assets/stylist-ruben.jpg";
import type { Employee, EmployeeId, SalonProfile, Service } from "./types";
import { DEFAULT_OPENING_HOURS, parseRanges } from "../opening-hours";
import {
  EMPLOYEE_OVERLAY,
  MAX_MENU_ENTRIES,
  MAX_SALON_TEAM_ENTRIES,
  SERVICE_CATALOG,
  parseMenuEntry,
  parseTeamEntry,
  placeholderAvatar,
  showsRealPhotos,
  slugForId,
  type BusinessType,
  type MenuOverrideEntry,
  type TeamOverrideEntry,
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
 * Equipo real de un enlace de demo (clave "e"): de 1 a 3 nombres, en el orden
 * en que se dieron. Se valida y recorta aquí también (no solo al decodificar
 * el enlace en demo-profile.ts) porque `team` puede llegar de otras fuentes
 * — una demo guardada, el formulario de app.demos.tsx — que no pasan por esa
 * validación. `null` si no hay ningún nombre aprovechable: el llamante debe
 * tratarlo como "sin equipo real", igual que si `team` no viniera.
 */
function resolveTeamOverrides(team?: string[]): TeamOverrideEntry[] | null {
  if (!team?.length) return null;
  const clean = team
    .map((t) => parseTeamEntry(t))
    .filter((t): t is TeamOverrideEntry => t !== null)
    .slice(0, MAX_SALON_TEAM_ENTRIES);
  return clean.length ? clean : null;
}

/**
 * Versión pura, sin mutación: dado un tipo (y, si el enlace trae equipo
 * real, el equipo), el equipo que le corresponde. La usan las páginas
 * públicas (s.$salonSlug.*) para que el equipo salga bien en el primer
 * render del servidor — antes de que corra ningún efecto de cliente — igual
 * que ya hace `useDisplayProfile` con el resto del perfil.
 */
export function employeesForType(
  type: BusinessType,
  team?: string[],
  teamHours?: string[][],
  openingHours?: string[],
  teamIds?: string[],
): Employee[] {
  return buildEmployees(type, team, teamHours, openingHours, teamIds);
}

function buildEmployees(
  type: BusinessType,
  team?: string[],
  teamHours?: string[][],
  openingHours?: string[],
  teamIds?: string[],
): Employee[] {
  // Equipo real: define cuántos profesionales tiene el salón. Los ids,
  // colores y horarios se toman de BASE_EMPLOYEES por orden (mario, diego,
  // ruben) — solo cambian nombre y especialidad, y sobra el resto del equipo
  // de ejemplo si el enlace trae menos de tres.
  const overrides = resolveTeamOverrides(team);
  const base = overrides
    ? Array.from({ length: overrides.length }, (_, i) => {
        const original = BASE_EMPLOYEES[i % BASE_EMPLOYEES.length];
        return i < BASE_EMPLOYEES.length ? original : { ...original, id: `profesional-${i + 1}` };
      })
    : BASE_EMPLOYEES;

  return base.map((baseEmp, i) => {
    const overlayId = BASE_EMPLOYEES[i % BASE_EMPLOYEES.length].id as EmployeeId;
    const overlay = EMPLOYEE_OVERLAY[type][overlayId];
    const name = overrides?.[i]?.name ?? overlay.name;
    const specialty = overrides?.[i]?.specialty ?? overlay.specialty;
    const horario = Array.from({ length: 7 }, (_, jsDay) => {
      const diaPerfil = (jsDay + 6) % 7;
      const horarioPersonal = teamHours?.[i]?.[diaPerfil];
      const personal = horarioPersonal !== undefined
        ? parseRanges(horarioPersonal)
        : openingHours
          ? parseRanges(openingHours[diaPerfil])
          : baseEmp.schedule[jsDay]
            ? [{ start: baseEmp.schedule[jsDay]!.start * 60, end: baseEmp.schedule[jsDay]!.end * 60 }]
            : [];
      const salon = openingHours ? parseRanges(openingHours[diaPerfil]) : personal;
      return personal.flatMap((p) =>
        salon.flatMap((s) => {
          const start = Math.max(p.start, s.start);
          const end = Math.min(p.end, s.end);
          return end > start ? [{ start, end }] : [];
        }),
      );
    });
    const jornada = horario.map((franjas) =>
      franjas.length
        ? {
            start: Math.min(...franjas.map((f) => f.start)) / 60,
            end: Math.max(...franjas.map((f) => f.end)) / 60,
          }
        : null,
    );
    return {
      ...baseEmp,
      id: (teamIds?.[i] ?? baseEmp.id) as EmployeeId,
      name,
      specialty,
      schedule: jornada,
      scheduleRanges: horario,
      // Las tres fotos de stock son barberos con navaja: fuera de barbería se
      // sustituyen por un avatar de iniciales, nunca por una cara que no
      // corresponde al oficio ni al género del nombre que se está mostrando
      // (sea de ejemplo o real, venga del enlace).
      photo: showsRealPhotos(type) ? baseEmp.photo : placeholderAvatar(name, baseEmp.id),
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

export function setEmployeesForType(
  type: BusinessType,
  team?: string[],
  teamHours?: string[][],
  openingHours?: string[],
  teamIds?: string[],
) {
  const next = buildEmployees(type, team, teamHours, openingHours, teamIds);
  employees.length = 0;
  employees.push(...next);
  for (const key of Object.keys(employeeMap)) delete employeeMap[key];
  for (const e of employees) employeeMap[e.id] = e;
}

/**
 * Carta real de un enlace de demo (clave "m"): de 1 a 12 servicios, en el
 * orden en que se dieron. Igual que `resolveTeamOverrides`, se valida aquí
 * también por si `menu` llega de una fuente que no pasó por demo-profile.ts.
 */
function resolveMenuOverrides(menu?: string[]): MenuOverrideEntry[] | null {
  if (!menu?.length) return null;
  const clean = menu
    .map((m) => parseMenuEntry(m))
    .filter((m): m is MenuOverrideEntry => m !== null)
    .slice(0, MAX_MENU_ENTRIES);
  return clean.length ? clean : null;
}

/**
 * Versión pura, sin mutación: dado un tipo (y, si el enlace trae carta real,
 * la carta), el catálogo que le corresponde. Igual que `employeesForType`,
 * la usan las páginas públicas para que el primer render — incluido el del
 * servidor — ya salga con la carta correcta.
 */
export function servicesForType(type: BusinessType, menu?: string[]): Service[] {
  const overrides = resolveMenuOverrides(menu);
  if (!overrides) return SERVICE_CATALOG[type];

  // Ids a partir del nombre, únicos por si dos servicios de la carta se
  // llaman igual — sin eso el segundo pisaría al primero en serviceMap.
  const usedIds = new Set<string>();
  return overrides.map((entry) => {
    const base = slugForId(entry.name);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return {
      id,
      name: entry.name,
      description: "",
      durationMin: entry.durationMin,
      priceEur: entry.priceEur,
      category: entry.category ?? "Servicios",
      active: true,
    };
  });
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

export function setServicesForType(type: BusinessType, menu?: string[]) {
  const next = servicesForType(type, menu).map((s) => ({ ...s }));
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
