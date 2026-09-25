export type EmployeeId = string;

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show"
  /**
   * Vino, pero tarde y sin avisar. Es un desenlace distinto de "no vino": el
   * servicio se hizo (y se cobra), pero la agenda se descolocó. Adam lo pidió
   * tal cual — con dos estados no podía distinguir al que le falla del que le
   * llega a deshora.
   */
  | "late"
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
  /** Franjas exactas en minutos desde medianoche; índice 0 = domingo. */
  scheduleRanges?: Array<Array<{ start: number; end: number }>>;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string; // ISO
  /** Indicaciones del salón sobre este cliente ("usa el número 8"). Del cliente, no de una cita. */
  notes?: string;
  /** Bloqueo explícito de reserva online, independiente de cualquier deuda. */
  manualBlock?: boolean;
  /** Código de la clienta en TPV 123, si vino de una importación. */
  tpvCode?: string;
  /** Cumpleaños "YYYY-MM-DD", si el salón lo conoce. */
  birthday?: string;
  /**
   * Política de plantón (ver `SalonProfile.noShowFeeEur`): importe pendiente
   * de cobrar, en euros. `undefined` o 0 = no debe nada. El dueño decide si
   * lo cobra o lo perdona — nunca se descuenta solo.
   */
  penaltyEur?: number;
  /** Motivo/fecha de la penalización, para enseñarlo junto al importe ("No vino el 12 sept · Corte"). */
  penaltyNote?: string;
  /**
   * Cuándo se aplicó la penalización (ISO). El bloqueo para volver a reservar
   * caduca solo a los 30 días contados desde aquí — ver `PENALTY_EXPIRY_DAYS`
   * en lib/plantones.ts. Una ficha sin esta fecha (las de antes de esto) se
   * comporta como siempre: el bloqueo no caduca hasta que el dueño lo cierre.
   */
  penaltyAt?: string;
  /**
   * El dueño ha decidido mantener el bloqueo más allá de los 30 días. Es una
   * decisión suya y explícita: por defecto el bloqueo se levanta solo.
   */
  penaltyKeep?: boolean;
  /**
   * Motivo de la penalización activa: no se presentó o llegó tarde. Ausente
   * en fichas antiguas (se tratan como "no se presentó", que era el único
   * motivo antes de esto). Ver RecargosPendientes.tsx.
   */
  penaltyReason?: "no_show" | "late";
  /** Minutos de retraso, solo cuando `penaltyReason === "late"`. */
  penaltyLateMinutes?: number;
  /** Cita que originó la penalización activa, para poder enseñar su fecha y servicio. */
  penaltyAppointmentId?: string;
  /**
   * El dueño ya ha visto este recargo y lo ha dejado pendiente a propósito
   * (acción "Mantener" en RecargosPendientes): deja de contar como "nuevo"
   * en el aviso de Hoy, pero sigue sin cobrar ni perdonar.
   */
  penaltyReviewedAt?: string;
  /**
   * ¿Esta deuda le impide volver a reservar por la web?
   *
   * `false` es la decisión que Tomás subrayó: "deuda anotada, pero que venga
   * igual y se la cobro en el siguiente corte". `true` o ausente = se
   * comporta como siempre (deber dinero bloquea la reserva online).
   */
  penaltyBlock?: boolean;
}

/**
 * Cómo se cobró una cita. Lo elige el dueño a mano en el cierre de caja: aquí
 * no se procesa ningún pago ni se conecta con ninguna pasarela.
 */
export type PaymentMethod = "efectivo" | "bizum" | "tarjeta";

/** Etiquetas en español de cada forma de cobro, en un solo sitio. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  bizum: "Bizum",
  tarjeta: "Tarjeta",
};

export interface Appointment {
  id: string;
  /**
   * Cita de otra profesional que el servidor manda SIN datos (lote 8): solo
   * inicio, duración y profesional, para calcular huecos y avisar de solapes.
   * Una estilista sin `cita.ver-todas` no la pinta ni la abre.
   */
  bloqueOcupado?: true;
  /** Procedencia del historial; ausente equivale a siShow. */
  origen?: "sishow" | "tpv123";
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
  /** Respuestas que la clienta dio al pedir la cita. No contienen datos de salud. */
  bookingAnswers?: BookingAnswers;
  /** Fórmula y notas de esta visita; el historial de la clienta se obtiene de sus citas. */
  colorFormula?: string;
  technicalNotes?: string;
  /**
   * Minutos de retraso con los que se presentó, cuando eso disparó un
   * recargo (política de plantón). Independiente de `status`: la cita puede
   * estar `completed` y aun así llevar este dato. Ver RecargosPendientes.tsx.
   */
  lateMinutes?: number;
  /**
   * Cierre de caja: cómo se cobró esta cita y cuándo se marcó como cobrada.
   * Las dos van juntas — marcar cobrada obliga a elegir forma de cobro. Nada
   * de esto mueve dinero: es el cuaderno del mostrador, en digital.
   */
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  /**
   * Fianza por Bizum (PeluChic): cuándo se abrió el WhatsApp para pedirla y
   * cuándo el salón marcó a mano que la señal había llegado. No hay pasarela
   * de pago ni comprobación automática: lo confirma una persona mirando su
   * banco.
   */
  depositRequestedAt?: string;
  /** Vencimiento de la señal. Al llegar la hora, solo avisa; no cancela la cita. */
  depositDueAt?: string;
  /** Plazo que se acordó al pedirla, para que «Dar más tiempo» use el mismo. */
  depositPeriodHours?: 1 | 2 | 3 | 4 | 12 | 24;
  depositReceivedAt?: string;
  /** Importe de la señal pedida, en euros — se congela al pedirla por si luego cambia en Ajustes. */
  depositEur?: number;
  /** Lo marca el salón después de enviar el recordatorio desde su WhatsApp. */
  reminderSentAt?: string;
  /**
   * Ciclo de vida de la señal (lib/senal.ts). `depositEur` es el importe
   * DEBIDO; lo recibido, aplicado o devuelto va aparte porque puede no
   * coincidir (reajuste al cambiar de servicio). Ausente = sin señal o cita
   * anterior al 25/09/2026 (se deduce de las fechas, ver `estadoSenal`).
   */
  depositStatus?: EstadoSenalGuardado;
  depositMethod?: MetodoSenal;
  depositReceivedEur?: number;
  depositAppliedAt?: string;
  depositAppliedEur?: number;
  depositRefundedAt?: string;
  depositRefundedEur?: number;
  depositRetainedAt?: string;
  depositNote?: string;
}

/** Estados que se guardan. `vencida` no se guarda: se calcula con la hora (ver `estadoSenal`). */
export type EstadoSenalGuardado = "por_pedir" | "pedida" | "recibida" | "aplicada" | "devuelta" | "retenida" | "anulada";
/** Cómo llegó la señal. siShow no la cobra: lo apunta la dueña. */
export type MetodoSenal = "bizum" | "efectivo" | "tarjeta" | "transferencia";

/**
 * Respuestas de la clienta al reservar: `{ idDePregunta: valor }`. Las
 * preguntas las define cada salón (`SalonProfile.preguntasReserva`, ver
 * lib/preguntas-reserva.ts). Las de siempre conservan sus ids: `hairLength`,
 * `hasColor` + `colorDetail`, `recentChemical` + `chemicalDetail`.
 */
export type BookingAnswers = Record<string, string | undefined>;

/** Tipos de pregunta del formulario de reserva. */
export type TipoPreguntaReserva = "texto" | "si_no" | "opcion" | "numero";

export interface PreguntaReserva {
  /** Estable: es la clave de la respuesta guardada. No cambiar al editar el texto. */
  id: string;
  texto: string;
  tipo: TipoPreguntaReserva;
  /** Con `opcion`: las opciones, en orden. */
  opciones?: string[];
  obligatoria: boolean;
  activa: boolean;
  /** Ids de servicio a los que aplica. Vacío o ausente = a todos. */
  servicios?: string[];
  /**
   * Con `si_no`: si la respuesta es «Sí», se pide un detalle que se guarda
   * con esta clave (p. ej. «¿Cuál es tu color?» en `colorDetail`).
   */
  detalle?: { id: string; texto: string; obligatorio: boolean };
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
  /** El salón fija la duración al aceptar cada solicitud. */
  duracionFlexible?: boolean;
  phone: string;
  instagram: string;
  /** Siete cadenas, lunes a domingo: "10:00–13:30, 17:00–20:00" o "Cerrado". Ver lib/opening-hours.ts */
  openingHours: string[];
  /** Zona horaria IANA de la agenda ("Europe/Madrid" por defecto). Ver lib/zona-horaria.ts. */
  timeZone?: string;
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
   * Equipo real del salón, de 1 a 6 entradas ("Nombre" o "Nombre~Especialidad"
   * — ver `parseTeamEntry` en business-type.ts). Vacío o ausente = el equipo
   * de ejemplo de tres profesionales de siempre (`EMPLOYEE_OVERLAY`).
   */
  team?: string[];
  /** Identificadores estables alineados con team, para conservar las citas al renombrar o quitar a alguien. */
  teamIds?: string[];
  /** Horario semanal por posición del equipo; cada día conserva el formato de openingHours. */
  teamHours?: string[][];
  /** Estado de la tarjeta de primeros pasos. */
  setupChecklistHidden?: boolean;
  setupChecklistDone?: number[];
  /**
   * Carta real del salón, de 1 a 12 entradas ("Nombre~minutos~precio" o
   * "...~Categoría" — ver `parseMenuEntry` en business-type.ts). Vacío o
   * ausente = el catálogo de ejemplo del tipo de negocio (`SERVICE_CATALOG`).
   */
  menu?: string[];
  /**
   * Preguntas frecuentes propias del salón, de 1 a 8 entradas
   * ("Pregunta~Respuesta" — ver `parseFaqEntry` en lib/faq.ts). Vacío o
   * ausente = las cuatro preguntas que la app genera sola a partir del tipo de
   * negocio y de la política de plantón (`faqPorDefecto`).
   */
  faq?: string[];
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
  /**
   * Fianza por Bizum (María, PeluChic): pedir una señal por WhatsApp antes de
   * confirmar la cita de una clienta nueva. `false` o ausente = el botón no
   * aparece y nada cambia. No hay pasarela: se abre WhatsApp con el mensaje
   * escrito y el salón marca a mano cuando el Bizum llega.
   */
  depositEnabled?: boolean;
  /** Número al que se pide el Bizum. Va escrito en el mensaje de WhatsApp. */
  depositBizumPhone?: string;
  /** Importe de la señal en euros. Por defecto 10. */
  depositAmountEur?: number;
  /** Horas para hacer el Bizum. María pidió de 1 a 4 (ver lib/senal.ts, VENTANAS_SENAL). */
  depositDeadlineHours?: 1 | 2 | 3 | 4 | 12 | 24;
  /** Señal de importe fijo (`depositAmountEur`) o porcentaje del servicio (`depositPercent`). Por defecto, fijo. */
  depositMode?: "fijo" | "porcentaje";
  depositPercent?: number;
  /** A qué reservas se pide: todas (por defecto), solo clientas nuevas, a partir de X min, o una lista de servicios. */
  depositAppliesTo?: "todas" | "nuevas" | "duracion" | "servicios";
  depositMinMinutes?: number;
  depositServiceIds?: string[];
  /** La reserva por la web nace con la señal pedida y enseña el Bizum. Por defecto, la pide la dueña por WhatsApp. */
  depositAuto?: boolean;
  /** Una señal vencida libera el hueco sola. Por defecto no: avisa y decide la dueña. */
  depositAutoRelease?: boolean;
  /** Horas antes de la cita hasta las que cancelar devuelve la señal. Por defecto, `noShowNoticeHours` o 24. */
  depositCancelHours?: number;
  /** Plantilla del WhatsApp de la señal. Ver `mensajeSenal` en lib/senal.ts. */
  depositTemplate?: string;
  /** Ausente: se decide por el tipo de negocio. */
  bookingQuestionsEnabled?: boolean;
  bookingQuestionsRequired?: boolean;
  /**
   * Preguntas propias del formulario de reserva, en orden. Ausente = las de
   * siempre según el tipo de negocio y los dos interruptores de arriba (nada
   * cambia en salones existentes). Ver lib/preguntas-reserva.ts.
   */
  preguntasReserva?: PreguntaReserva[];
}
