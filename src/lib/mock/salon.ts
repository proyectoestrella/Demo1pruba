import marioPhoto from "@/assets/stylist-mario.jpg";
import diegoPhoto from "@/assets/stylist-diego.jpg";
import rubenPhoto from "@/assets/stylist-ruben.jpg";
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
  rating: 4.8,
  reviewCount: 312,
  specialties: ["degradados", "barba a navaja", "afeitado clásico", "cortes de tijera"],
  heroImage: "",
};

export const services: Service[] = [
  {
    id: "corte",
    name: "Corte de caballero",
    description: "Lavado, corte y acabado.",
    durationMin: 30,
    priceEur: 15,
    active: true,
  },
  {
    id: "corte-barba",
    name: "Corte y barba",
    description: "El corte completo más el arreglo de barba.",
    durationMin: 45,
    priceEur: 23,
    active: true,
  },
  {
    id: "barba",
    name: "Arreglo de barba",
    description: "Toalla caliente, perfilado y aceite.",
    durationMin: 20,
    priceEur: 10,
    active: true,
  },
  {
    id: "afeitado",
    name: "Afeitado a navaja",
    description: "Afeitado clásico con toalla caliente y bálsamo.",
    durationMin: 30,
    priceEur: 16,
    active: true,
  },
  {
    id: "infantil",
    name: "Corte infantil",
    description: "Hasta 12 años, sin prisa.",
    durationMin: 25,
    priceEur: 12,
    active: true,
  },
  {
    id: "cejas",
    name: "Perfilado de cejas",
    description: "Con navaja o pinza.",
    durationMin: 10,
    priceEur: 5,
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
    id: "mario",
    name: "Mario",
    specialty: "Cortes clásicos y degradados",
    yearsExperience: 8,
    photo: marioPhoto,
    colorVar: "--stylist-mario",
    schedule: fullWeek,
  },
  {
    id: "diego",
    name: "Diego",
    specialty: "Degradados y diseño",
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
    name: "Ruben",
    specialty: "Barba y afeitado a navaja",
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
