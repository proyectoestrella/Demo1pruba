import type { Appointment, SalonProfile } from "./mock/types";

/**
 * Preferencias del calendario del panel: vista con la que abre, primer día de
 * la semana y horas visibles de la rejilla. Viven en el perfil del salón
 * (`salonProfile.calendario`), así que se guardan con el resto de ajustes.
 * Funciones puras, sin React ni store.
 */

export type VistaCalendario = NonNullable<NonNullable<SalonProfile["calendario"]>["vista"]>;
export type PrimerDia = 0 | 1 | 6;

export interface PreferenciasCalendario {
  vista: VistaCalendario;
  primerDia: PrimerDia;
  desde: number;
  hasta: number;
}

export const VISTAS_CALENDARIO: { id: VistaCalendario; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "tres", label: "3 días" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "cronograma", label: "Cronograma" },
];

export const PRIMEROS_DIAS: { id: PrimerDia; label: string }[] = [
  { id: 1, label: "Lunes" },
  { id: 0, label: "Domingo" },
  { id: 6, label: "Sábado" },
];

export const PREFERENCIAS_POR_DEFECTO: PreferenciasCalendario = { vista: "semana", primerDia: 1, desde: 8, hasta: 21 };

/** Completa y sanea lo guardado: horas enteras entre 0 y 24, y al menos dos horas visibles. */
export function preferenciasDe(guardadas: SalonProfile["calendario"] | undefined): PreferenciasCalendario {
  const p = { ...PREFERENCIAS_POR_DEFECTO, ...(guardadas ?? {}) };
  const vista = VISTAS_CALENDARIO.some((v) => v.id === p.vista) ? p.vista : PREFERENCIAS_POR_DEFECTO.vista;
  const primerDia = PRIMEROS_DIAS.some((d) => d.id === p.primerDia) ? p.primerDia : 1;
  let desde = Math.min(22, Math.max(0, Math.round(Number(p.desde))));
  let hasta = Math.min(24, Math.max(2, Math.round(Number(p.hasta))));
  if (!Number.isFinite(desde)) desde = PREFERENCIAS_POR_DEFECTO.desde;
  if (!Number.isFinite(hasta)) hasta = PREFERENCIAS_POR_DEFECTO.hasta;
  if (hasta - desde < 2) hasta = Math.min(24, desde + 2);
  if (hasta - desde < 2) desde = hasta - 2;
  return { vista, primerDia, desde, hasta };
}

/** Primer día de la semana que contiene `d`, según la preferencia. */
export function inicioDeSemana(d: Date, primerDia: PrimerDia): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() - primerDia + 7) % 7));
  return x;
}

/**
 * Días que enseña una vista de rejilla: uno, tres seguidos desde el ancla, o
 * los siete de la semana empezando en el primer día elegido.
 */
export function diasDeRejilla(anchor: Date, vista: "dia" | "tres" | "semana", primerDia: PrimerDia): Date[] {
  const inicio = vista === "semana" ? inicioDeSemana(anchor, primerDia) : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const n = vista === "dia" ? 1 : vista === "tres" ? 3 : 7;
  return Array.from({ length: n }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

/** Cuántos días avanza la flecha en cada vista (el mes se mueve aparte). */
export function pasoDeVista(vista: VistaCalendario): number {
  return vista === "semana" ? 7 : vista === "tres" ? 3 : 1;
}

/** Minutos del día que ocupa cada cita (sin las canceladas). */
export function tramosDeCitas(citas: Appointment[]): { ini: number; fin: number }[] {
  return citas
    .filter((a) => a.status !== "cancelled")
    .map((a) => {
      const d = new Date(a.start);
      const ini = d.getHours() * 60 + d.getMinutes();
      return { ini, fin: ini + a.duration };
    });
}

/**
 * Horas del día entero que hace falta pintar para no esconder ninguna cita:
 * las visibles, ensanchadas por las CITAS que caen fuera. Es lo que enseña
 * «Ver todo el día»; por defecto la rejilla respeta las horas elegidas.
 */
export function horasDeRejilla(pref: Pick<PreferenciasCalendario, "desde" | "hasta">, minutosOcupados: { ini: number; fin: number }[]): { desde: number; hasta: number } {
  let desde = pref.desde;
  let hasta = pref.hasta;
  for (const t of minutosOcupados) {
    desde = Math.min(desde, Math.floor(t.ini / 60));
    hasta = Math.max(hasta, Math.ceil(t.fin / 60));
  }
  return { desde: Math.max(0, desde), hasta: Math.min(24, hasta) };
}

/** Cuántas citas quedan, entera o en parte, fuera de las horas visibles. */
export function citasFueraDeHoras(tramos: { ini: number; fin: number }[], horas: { desde: number; hasta: number }): number {
  return tramos.filter((t) => t.ini < horas.desde * 60 || t.fin > horas.hasta * 60).length;
}

/** Máximo de días que enseña «Elegir días». */
export const MAX_DIAS_ELEGIDOS = 14;

/**
 * Valida el rango de «Elegir días» (fechas `aaaa-mm-dd` de los campos de
 * fecha) y devuelve el primer día y cuántos son, o el motivo por el que no.
 */
export function rangoDeDias(desde: string, hasta: string): { inicio: Date; n: number } | { error: string } {
  const leer = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const a = leer(desde);
  const b = leer(hasta);
  if (!a || !b) return { error: "Elige las dos fechas." };
  const n = Math.round((+b - +a) / 86_400_000) + 1;
  if (n < 1) return { error: "La fecha final va después de la inicial." };
  if (n > MAX_DIAS_ELEGIDOS) return { error: `Como mucho ${MAX_DIAS_ELEGIDOS} días seguidos.` };
  return { inicio: a, n };
}

/** Los `n` días seguidos desde `inicio`. */
export function diasDesde(inicio: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}
