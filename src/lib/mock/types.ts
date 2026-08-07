export type EmployeeId = "mario" | "diego" | "ruben";

export type AppointmentStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show"
  | "blocked";

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
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  employeeId: EmployeeId;
  /** ISO start datetime */
  start: string;
  /** minutes */
  duration: number;
  priceEur: number;
  status: AppointmentStatus;
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
}
