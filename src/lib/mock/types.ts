export type EmployeeId = "mario" | "diego" | "ruben";

export type AppointmentStatus =
  | "pending"
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
  /** Grupo del menú público ("Cortes", "Color"…). Ver lib/business-type.ts. */
  category?: string;
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
  /**
   * Política de plantón (ver `SalonProfile.noShowFeeEur`): importe pendiente
   * de cobrar, en euros. `undefined` o 0 = no debe nada. El dueño decide si
   * lo cobra o lo perdona — nunca se descuenta solo.
   */
  penaltyEur?: number;
  /** Motivo/fecha de la penalización, para enseñarlo junto al importe ("No vino el 12 sept · Corte"). */
  penaltyNote?: string;
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
  /** Siete cadenas, lunes a domingo: "10:00–13:30, 17:00–20:00" o "Cerrado". Ver lib/opening-hours.ts */
  openingHours: string[];
  /**
   * Cuántas fotos tiene el local en Google (0 = ninguna o no viene de Google).
   * La primera es la portada; el resto alimentan la galería a través de /api/foto.
   */
  photoCount?: number;
  /**
   * Qué fotos de la ficha de Google van a la galería, y en qué orden.
   * Cada entrada es `"<índice>~<pista>"` (ver lib/demo-photos.ts). Vacío = se
   * usan las de Google por orden, saltando la portada.
   */
  galleryPhotos?: string[];
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
  /**
   * Equipo real del salón, de 1 a 3 entradas ("Nombre" o "Nombre~Especialidad"
   * — ver `parseTeamEntry` en business-type.ts). Vacío o ausente = el equipo
   * de ejemplo de tres profesionales de siempre (`EMPLOYEE_OVERLAY`).
   */
  team?: string[];
  /**
   * Carta real del salón, de 1 a 12 entradas ("Nombre~minutos~precio" o
   * "...~Categoría" — ver `parseMenuEntry` en business-type.ts). Vacío o
   * ausente = el catálogo de ejemplo del tipo de negocio (`SERVICE_CATALOG`).
   */
  menu?: string[];
  /**
   * Política de plantón: importe en euros que se pide antes de poder volver a
   * reservar tras cancelar tarde o no presentarse. `undefined` o 0 =
   * desactivada — nada cambia respecto a como funcionaba antes. Ver
   * `Client.penaltyEur` y `AppointmentDetailSheet`.
   */
  noShowFeeEur?: number;
  /** Horas de antelación por debajo de las cuales cancelar cuenta como plantón. Por defecto 2. */
  noShowNoticeHours?: number;
  /**
   * Reparto de agenda: sugiere una hora más tranquila cuando el cliente elige
   * una franja "con espera" (12:00–14:00 o las últimas horas del día). `false`
   * o ausente = todo como siempre, sin etiquetas ni sugerencias.
   */
  smartSpread?: boolean;
  /** Minutos antes del cierre que dejan de ofertarse (0-240). Solo tiene efecto con `smartSpread`. */
  lastSlotBufferMin?: number;
  /**
   * Franjas prioritarias del dueño (paso 3 de la reserva): rangos "HH:mm-HH:mm"
   * que se muestran primero, con el resto de horas detrás de "Ver todas las
   * horas". De 0 a 3 rangos — ver `parsePriorityRange` en lib/reparto.ts.
   * Vacío o ausente = todas las horas se ven igual, como siempre.
   */
  priorityHours?: string[];
}
