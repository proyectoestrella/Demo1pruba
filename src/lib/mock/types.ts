export type EmployeeId = "mario" | "diego" | "ruben";

export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "no-show" | "blocked";

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceEur: number;
  image?: string;
  /** Whether the service is currently offered / bookable. Defaults to true when absent. */
  active?: boolean;
}

export interface Employee {
  id: EmployeeId;
  name: string;
  specialty: string;
  yearsExperience: number;
  photo: string;
  /** CSS variable name like --stylist-mario */
  colorVar: string;
  /** working hours per weekday 0-6 (Sun-Sat). null = day off */
  schedule: Array<{ start: number; end: number } | null>;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string; // ISO
  /** Indicaciones del salón sobre este cliente ("usa el número 8"). Del cliente, no de una cita. */
  notes?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  /**
   * Servicios reservados, en el orden en que se eligieron. Casi siempre uno;
   * "corte y luego barba" son dos. `duration` y `priceEur` ya llevan la suma.
   */
  serviceIds: string[];
  employeeId: EmployeeId;
  /** ISO start datetime */
  start: string;
  /** minutes */
  duration: number;
  priceEur: number;
  status: AppointmentStatus;
  /**
   * Cuándo confirmó el CLIENTE que viene (ISO). Es distinto de `status`, que es
   * lo que gestiona el salón: "confirmada" en la agenda solo significa que está
   * puesta, no que el cliente haya dicho nada.
   *
   * Hoy solo se marca a mano desde el panel — no hay canal (WhatsApp, SMS ni
   * email) por el que el cliente pueda confirmar. Ver `markClientConfirmed`.
   */
  clientConfirmedAt?: string;
  /** Title for blocked time entries */
  note?: string;
}

export interface WaitlistEntry {
  id: string;
  clientName: string;
  phone: string;
  serviceId: string;
  preferredEmployeeId: EmployeeId | "any";
  preferredRange: string;
  createdAt: string;
}

/** A single row in the salon's opening-hours table (e.g. "Mon–Fri" / "10:00 — 20:00"). */
export interface SalonHours {
  day: string;
  value: string;
}

/** Editable salon profile shown/edited in Settings. Mirrors the shape of `salon` in mock/salon.ts. */
export interface SalonProfile {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  about: string;
  address: string;
  phone: string;
  instagram: string;
  hours: SalonHours[];
  /** Nota media mostrada en el hero y en la sección de reseñas. */
  rating: number;
  /** Número de reseñas que acompaña a la nota. */
  reviewCount: number;
  /** Palabras que rotan tras "Especialistas en" — lo que se hace en ESTE salón. */
  specialties: string[];
  /**
   * URL de la foto de portada. Vacío = la foto de ejemplo que trae la app.
   * Es una URL y no un fichero subido a propósito: así viaja dentro del enlace
   * de la demo y el salón la ve en su móvil, que es de lo que se trata.
   */
  heroImage?: string;
}
