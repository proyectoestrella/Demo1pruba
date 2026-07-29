import inesPhoto from "@/assets/stylist-ines.jpg";
import manuelaPhoto from "@/assets/stylist-manuela.jpg";
import lunaPhoto from "@/assets/stylist-luna.jpg";
import type { Employee, SalonProfile, Service } from "./types";

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
  hours: [
    { day: "Mon–Fri", value: "10:00 — 20:00" },
    { day: "Saturday", value: "10:00 — 18:00" },
    { day: "Sunday", value: "Closed" },
  ],
};

export const services: Service[] = [
  {
    id: "haircut",
    name: "Corte de caballero",
    description: "Lavado, corte de firma y acabado.",
    durationMin: 45,
    priceEur: 38,
    active: true,
  },
  {
    id: "beard",
    name: "Arreglo de barba",
    description: "Toalla caliente, perfilado y cuidado.",
    durationMin: 30,
    priceEur: 22,
    active: true,
  },
  {
    id: "color",
    name: "Color",
    description: "Color de un tono, brillo y matiz final.",
    durationMin: 90,
    priceEur: 75,
    active: true,
  },
  {
    id: "highlights",
    name: "Mechas",
    description: "Iluminación pintada a mano, tono y tratamiento.",
    durationMin: 150,
    priceEur: 140,
    active: true,
  },
  {
    id: "keratin",
    name: "Tratamiento de keratina",
    description: "Alisado con proteína, dura 12 semanas.",
    durationMin: 180,
    priceEur: 180,
    active: true,
  },
  {
    id: "styling",
    name: "Peinado",
    description: "Secado o peinado para eventos especiales.",
    durationMin: 45,
    priceEur: 40,
    active: true,
  },
];

const fullWeek = [
  null, // Sun closed
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 20 },
  { start: 10, end: 18 },
];

export const employees: Employee[] = [
  {
    id: "ines",
    name: "Ines",
    specialty: "Cortes clásicos y degradados",
    yearsExperience: 8,
    photo: inesPhoto,
    colorVar: "--stylist-ines",
    schedule: fullWeek,
  },
  {
    id: "manuela",
    name: "Manuela",
    specialty: "Color y canas",
    yearsExperience: 6,
    photo: manuelaPhoto,
    colorVar: "--stylist-manuela",
    schedule: [null, null, { start: 10, end: 20 }, { start: 10, end: 20 }, { start: 10, end: 20 }, { start: 10, end: 20 }, { start: 10, end: 18 }],
  },
  {
    id: "luna",
    name: "Luna",
    specialty: "Barba y tratamientos",
    yearsExperience: 10,
    photo: lunaPhoto,
    colorVar: "--stylist-luna",
    schedule: [null, { start: 12, end: 20 }, { start: 12, end: 20 }, null, { start: 12, end: 20 }, { start: 12, end: 20 }, { start: 10, end: 18 }],
  },
];

export const employeeMap: Record<string, Employee> = Object.fromEntries(
  employees.map((e) => [e.id, e]),
);

export const serviceMap: Record<string, Service> = Object.fromEntries(
  services.map((s) => [s.id, s]),
);

export const DEPOSIT_THRESHOLD_MIN = 90;
export const DEPOSIT_RATE = 0.2;

export function requiresDeposit(durationMin: number) {
  return durationMin > DEPOSIT_THRESHOLD_MIN;
}

export function depositFor(priceEur: number, durationMin: number) {
  return requiresDeposit(durationMin) ? Math.round(priceEur * DEPOSIT_RATE) : 0;
}
