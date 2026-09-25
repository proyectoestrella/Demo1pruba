/**
 * Lo que el asistente necesita saber del salón, INYECTADO al crearlo.
 *
 * El motor (src/lib/asistente/) no importa helpers de ninguna rama: los
 * recibe por aquí. Cada rama escribe su adaptador: `fuentes-backend.ts` en
 * codex/peluchic-backend y `fuentes-arena.ts` en codex/arena-frontend. Así el
 * motor se puede traer por cherry-pick sin conflictos.
 *
 * Tipos mínimos y ESTRUCTURALES: los `Appointment`, `Client`, `Employee`,
 * `Service` y `WaitlistEntry` de cualquiera de las dos ramas encajan sin
 * convertir nada. Los campos opcionales que una rama no tenga, simplemente no
 * vienen.
 *
 * Regla de oro: si una fuente no tiene el dato, devuelve `null` (o una lista
 * vacía) y el asistente dice «eso no lo tengo». Nunca un valor inventado.
 */

export type PlanSishow = "reservas" | "reservas-asistente" | "todo-incluido";

export interface CitaA {
  id: string;
  clientId: string;
  clientName: string;
  serviceIds: string[];
  employeeId: string;
  /** Instante ISO. */
  start: string;
  /** Minutos. */
  duration: number;
  priceEur: number;
  /** pending · confirmed · completed · cancelled · no-show · late · blocked */
  status: string;
  paidAt?: string;
  paymentMethod?: string;
  reminderSentAt?: string;
  colorFormula?: string;
}

export interface ClientaA {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** «AAAA-MM-DD» o ISO. */
  birthday?: string;
  createdAt?: string;
  manualBlock?: boolean;
  penaltyEur?: number;
}

export interface ProfesionalA {
  id: string;
  name: string;
}

export interface ServicioA {
  id: string;
  name: string;
  durationMin: number;
  priceEur: number;
  active?: boolean;
  category?: string;
}

export interface EsperaA {
  id: string;
  clientName: string;
  serviceId?: string;
  preferredEmployeeId?: string;
  preferredRange?: string;
  createdAt?: string;
}

export interface EstadoAsistente {
  salonNombre: string;
  /** Plan contratado. Si no se sabe, `reservas-asistente` (el que incluye el asistente). */
  plan: PlanSishow;
  ahora: Date;
  /** Zona IANA de la agenda (Europe/Madrid por defecto). */
  timeZone: string;
  citas: CitaA[];
  clientas: ClientaA[];
  equipo: ProfesionalA[];
  servicios: ServicioA[];
  listaEspera: EsperaA[];
}

export interface VisitaA {
  /** Instante ISO. */
  fecha: string;
  servicios: string[];
  profesional: string;
  importe: number;
  duracion?: number;
}

export interface FichaA {
  /** De la más reciente a la más antigua. */
  visitas: VisitaA[];
  ultimoColor?: { formula: string; fecha: string } | null;
  frecuenciaMediaDias?: number | null;
  gastoTotal: number;
  gastoUltimos12Meses: number;
  profesionalHabitual?: string | null;
  proximaCita?: { fecha: string; servicios: string[]; profesional: string } | null;
  /** Avisos y observaciones de la ficha, ya en texto. */
  avisos: string[];
  /** Duración real de la última vez para un servicio, si se conoce. */
  duracionRecordada?: (serviceIds: string[]) => number | null;
}

export interface HuecoA {
  profesionalId: string;
  /** Instantes ISO. */
  desde: string;
  hasta: string;
  minutos: number;
}

export interface JornadaA {
  trabaja: boolean;
  /** Tramos del día en «HH:MM». */
  franjas: Array<{ desde: string; hasta: string }>;
}

/** Estado de la señal de una cita (ver lib/senal.ts en BACKEND). */
export interface SenalCitaA {
  estado: "no_aplica" | "por_pedir" | "pedida" | "vencida" | "recibida" | "aplicada" | "devuelta" | "retenida" | "anulada";
  importeEur?: number;
  venceISO?: string;
  recibidaEur?: number;
}

export interface ReglaSenalA {
  activa: boolean;
  /** Frase de la regla: «20 € en los servicios de 90 min o más, con 2 h de plazo». */
  resumen: string;
}

export interface CampanaA {
  titulo: string;
  personas: number;
  /** Frase corta con la cifra que la justifica. */
  motivo?: string;
}

/** Resumen de un periodo con el MISMO cálculo que Analítica (resumenDePeriodo). */
export interface ResumenPeriodoA {
  citas: number;
  citasPrevias: number | null;
  /** % redondeado; null si no hay con qué comparar. */
  variacionCitas: number | null;
  ocupacion: number | null;
  ocupacionPrevia: number | null;
  variacionOcupacion: number | null;
  /** El periodo va a medias: el anterior se recortó al mismo tramo. */
  parcial: boolean;
}

export interface FuentesAsistente {
  /** Instantánea del salón. Se llama una vez por pregunta. */
  estado(): EstadoAsistente;

  /** Ficha calculada de una clienta, o `null` si no existe. */
  fichaClienta(clientaId: string): FichaA | null;

  /**
   * Opcional: resumen del periodo tal como lo calcula Analítica, para que el
   * asistente y la pantalla den las mismas cifras. Sin él, el motor calcula
   * por su cuenta. «desde»/«hasta» solo con tipo «personalizado».
   */
  resumenPeriodo?(p: { tipo: "hoy" | "semana" | "mes" | "personalizado"; desde?: string; hasta?: string }): ResumenPeriodoA | null;

  /** Huecos libres de un día («AAAA-MM-DD»), de 30 min o más por defecto. */
  huecos(dia: string, opciones?: { profesionalId?: string; minMinutos?: number }): HuecoA[] | null;
  /** Jornada de una profesional un día. */
  jornada(profesionalId: string, dia: string): JornadaA | null;
  /** «Mar–Vie 10:00–20:00 · Sáb 9:00–14:00». Sin id, el del salón. */
  horarioResumen(profesionalId?: string): string | null;
  /** Si el salón abre ese día y de qué hora a qué hora. */
  aperturaDelDia(dia: string): JornadaA | null;

  senal: {
    regla(): ReglaSenalA | null;
    estado(cita: CitaA): SenalCitaA | null;
    /** Lo que dice la web sobre cancelar. */
    politicaCancelacion(): string | null;
  };

  /** Textos de las preguntas del formulario de reserva (aplicables a esos servicios, si vienen). */
  preguntasReserva(serviceIds?: string[]): string[] | null;
  /** Recargo por plantón configurado. */
  recargo(): { activo: boolean; eur?: number; horasAviso?: number } | null;
  /** ¿La duración se fija al aceptar cada solicitud? */
  duracionFlexible(): boolean | null;
  /** Textos de los WhatsApp de confirmación y recordatorio. */
  plantillas(): { recordatorio?: string; confirmacion?: string } | null;
  /** URL de la página de reservas. */
  enlaceReservas(): string | null;
  /** ¿Tiene activado el calendario suscrito (Google/iPhone)? */
  calendarioSuscrito(): boolean | null;
  /** Color de cada servicio y profesional en el calendario, en palabras («lavanda»). */
  colores(): { servicios: Record<string, string>; profesionales: Record<string, string> } | null;
  /** ¿Puede reservar por internet? Con el motivo si no. */
  bloqueo(clientaId: string): { bloqueada: boolean; motivo?: string } | null;

  marketing: {
    campanas(): CampanaA[] | null;
    /** Clientas y huecos recuperables este mes. */
    recuperables(): { clientas: number; huecos: number } | null;
    /** Franja con menos ocupación de las últimas semanas. */
    franjaFloja(): { etiqueta: string; pct: number } | null;
    /** Clientas nuevas que aún no han vuelto. */
    segundaVisita(): { personas: number; dias: number } | null;
    /** Clientas a las que pedir reseña ahora. */
    resenas(): { personas: number; dias: number } | null;
  };
}
