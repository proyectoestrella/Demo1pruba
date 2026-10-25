/**
 * Solapes en la agenda: una sola regla para la web pública, el panel y el
 * servidor.
 *
 * Una cita puede dejar libre a la profesional durante la exposición de uno
 * de sus servicios. La clienta sigue contando para el aforo simultáneo, pero
 * ese tramo no choca con el trabajo activo de otra cita.
 *
 * Este módulo es deliberadamente puro: web pública, panel y servidor tienen
 * que preguntar aquí, no reconstruir la regla con intervalos por su cuenta.
 */
import type {
  Appointment,
  EmployeeId,
  ExposicionServicio,
  SalonProfile,
  Service,
} from "./mock/types";

export const ERROR_SOLAPE_PANEL = "RESERVA_SOLAPE_PANEL";
export const MAX_CLIENTAS_EXPOSICION_POR_DEFECTO = 6;

type ServicioParaExposicion = Pick<Service, "id" | "name" | "durationMin">;
type PerfilExposicion = Partial<
  Pick<SalonProfile, "exposicionServicios" | "maxClientasExposicion" | "lavado">
>;

export interface ContextoSolape {
  servicios?: Record<string, ServicioParaExposicion>;
  perfil?: PerfilExposicion;
}

export interface CitaParaSolape {
  id?: string;
  employeeId: EmployeeId | string;
  start: string;
  duration: number;
  serviceIds?: string[];
  status: string;
  /** Ver `Appointment.tramosActivos` (web pública). */
  tramosActivos?: Array<[number, number]>;
}

export interface HuecoPedido {
  employeeId: EmployeeId | string;
  /** Instante ISO de inicio. */
  start: string;
  /** Minutos. */
  duration: number;
  /** Servicios de la nueva cita, en el orden en que se harán. */
  serviceIds?: string[];
  /** La propia cita cuando se está moviendo: no se solapa consigo misma. */
  excluirId?: string;
}

/** ¿Cuenta esta cita como ocupación de la agenda? Canceladas y plantones, no. */
export function ocupaAgenda(status: string): boolean {
  return status !== "cancelled" && status !== "no-show";
}

function minutosNoNegativos(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? Math.max(0, Math.round(valor)) : 0;
}

function nombreComparable(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

/**
 * Configuración efectiva del servicio. Lo guardado manda incluso si vale 0;
 * sin entrada propia, los colores de PeluChic y cualquier servicio que se
 * llame «Color…» o «Barros tintóreos» reciben el valor acordado.
 */
export function exposicionDe(
  servicio: ServicioParaExposicion,
  perfil: PerfilExposicion = {},
): Required<ExposicionServicio> | undefined {
  const configuradas = perfil.exposicionServicios;
  if (configuradas && Object.prototype.hasOwnProperty.call(configuradas, servicio.id)) {
    const propia = configuradas[servicio.id] ?? {};
    return {
      aplicacionMin: minutosNoNegativos(propia.aplicacionMin),
      exposicionMin: minutosNoNegativos(propia.exposicionMin),
    };
  }

  const nombre = nombreComparable(servicio.name);
  const esCoberturaRapida =
    servicio.id === "color-10-minutos" || nombre === "color de cobertura en 10 minutos";
  if (esCoberturaRapida) return { aplicacionMin: 15, exposicionMin: 10 };
  if (
    servicio.id === "color-organico" ||
    nombre.startsWith("color") ||
    nombre === "barros tintoreos"
  ) {
    return { aplicacionMin: 15, exposicionMin: 30 };
  }
  return undefined;
}

/** El límite guardado, saneado; un valor ausente o inválido vuelve a 6. */
export function maxClientasExposicionDe(perfil: PerfilExposicion = {}): number {
  const valor = perfil.maxClientasExposicion;
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return MAX_CLIENTAS_EXPOSICION_POR_DEFECTO;
  }
  return Math.max(1, Math.round(valor));
}

interface Tramo {
  desde: number;
  hasta: number;
}

function seCruzan(a: Tramo, b: Tramo): boolean {
  return a.desde < b.hasta && b.desde < a.hasta;
}

function restaExposiciones(total: Tramo, exposiciones: Tramo[]): Tramo[] {
  const ordenadas = exposiciones
    .filter((t) => t.desde < t.hasta && seCruzan(total, t))
    .map((t) => ({ desde: Math.max(total.desde, t.desde), hasta: Math.min(total.hasta, t.hasta) }))
    .sort((a, b) => a.desde - b.desde || a.hasta - b.hasta);
  if (!ordenadas.length) return [total];

  const unidas: Tramo[] = [];
  for (const tramo of ordenadas) {
    const anterior = unidas.at(-1);
    if (anterior && tramo.desde <= anterior.hasta)
      anterior.hasta = Math.max(anterior.hasta, tramo.hasta);
    else unidas.push({ ...tramo });
  }

  const activos: Tramo[] = [];
  let cursor = total.desde;
  for (const exposicion of unidas) {
    if (cursor < exposicion.desde) activos.push({ desde: cursor, hasta: exposicion.desde });
    cursor = Math.max(cursor, exposicion.hasta);
  }
  if (cursor < total.hasta) activos.push({ desde: cursor, hasta: total.hasta });
  return activos;
}

/** Tramos en los que la profesional trabaja de forma activa en esta cita. */
export function tramosActivosDeCita(
  cita: Pick<CitaParaSolape, "start" | "duration" | "serviceIds" | "tramosActivos">,
  contexto: ContextoSolape = {},
): Tramo[] {
  const desde = Date.parse(cita.start);
  const hasta = desde + cita.duration * 60_000;
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return [];
  const total = { desde, hasta };
  if (cita.tramosActivos?.length) {
    return cita.tramosActivos
      .map(([a, b]) => ({ desde: desde + a * 60_000, hasta: Math.min(hasta, desde + b * 60_000) }))
      .filter((t) => t.desde < t.hasta);
  }
  const idsOriginales = cita.serviceIds ?? [];
  if (!idsOriginales.length || !contexto.servicios) return [total];

  const lavado = contexto.perfil?.lavado;
  const lavadoIncluido =
    !!lavado?.servicioId &&
    idsOriginales.includes(lavado.servicioId) &&
    idsOriginales.some((id) => id !== lavado.servicioId && (lavado.incluidoEn ?? []).includes(id));
  const ids = lavadoIncluido
    ? idsOriginales.filter((id) => id !== lavado?.servicioId)
    : idsOriginales;
  const servicios = ids.map((id) => contexto.servicios?.[id]);
  // Una cita libre o una carta que ya cambió ocupa todo: abrir un hueco sin
  // conocer su secuencia sería menos seguro que el comportamiento anterior.
  if (!servicios.length || servicios.some((servicio) => !servicio)) return [total];

  const exposiciones: Tramo[] = [];
  let cursor = desde;
  for (const servicio of servicios as ServicioParaExposicion[]) {
    if (cursor >= hasta) break;
    const duracion = minutosNoNegativos(servicio.durationMin) * 60_000;
    const finServicio = Math.min(cursor + duracion, hasta);
    const exposicion = exposicionDe(servicio, contexto.perfil);
    if (exposicion && exposicion.exposicionMin > 0) {
      const inicioExposicion = Math.min(cursor + exposicion.aplicacionMin * 60_000, finServicio);
      const finExposicion = Math.min(
        inicioExposicion + exposicion.exposicionMin * 60_000,
        finServicio,
      );
      if (inicioExposicion < finExposicion) {
        exposiciones.push({ desde: inicioExposicion, hasta: finExposicion });
      }
    }
    cursor = finServicio;
  }
  return restaExposiciones(total, exposiciones);
}

function excedeCapacidad(
  otras: readonly CitaParaSolape[],
  nueva: CitaParaSolape,
  maximo: number,
): boolean {
  const inicio = Date.parse(nueva.start);
  const fin = inicio + nueva.duration * 60_000;
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return false;
  const intervalos = otras
    .map((cita) => {
      const desde = Date.parse(cita.start);
      return { desde, hasta: desde + cita.duration * 60_000 };
    })
    .filter((tramo) => tramo.desde < fin && tramo.hasta > inicio);
  const instantes = [
    inicio,
    ...intervalos.flatMap((tramo) => [Math.max(inicio, tramo.desde), Math.min(fin, tramo.hasta)]),
  ]
    .filter((instante) => instante < fin)
    .sort((a, b) => a - b);
  return instantes.some(
    (instante) =>
      1 + intervalos.filter((tramo) => tramo.desde <= instante && tramo.hasta > instante).length >
      maximo,
  );
}

/**
 * Citas que impiden añadir la nueva: porque chocan sus tramos activos o
 * porque al sumarla se supera el máximo de clientas presentes.
 */
export function conflictosDeAgenda<T extends CitaParaSolape>(
  appointments: readonly T[],
  nueva: CitaParaSolape,
  contexto: ContextoSolape = {},
  excluirId?: string,
): T[] {
  const otras = appointments.filter(
    (cita) =>
      cita.id !== excluirId && cita.employeeId === nueva.employeeId && ocupaAgenda(cita.status),
  );
  const activosNueva = tramosActivosDeCita(nueva, contexto);
  const choquesActivos = otras.filter((cita) => {
    const activosOtra = tramosActivosDeCita(cita, contexto);
    return activosNueva.some((a) => activosOtra.some((b) => seCruzan(a, b)));
  });
  if (excedeCapacidad(otras, nueva, maxClientasExposicionDe(contexto.perfil))) {
    const inicio = Date.parse(nueva.start);
    const fin = inicio + nueva.duration * 60_000;
    for (const cita of otras) {
      const otroInicio = Date.parse(cita.start);
      if (
        otroInicio < fin &&
        otroInicio + cita.duration * 60_000 > inicio &&
        !choquesActivos.includes(cita)
      ) {
        choquesActivos.push(cita);
      }
    }
  }
  return choquesActivos;
}

/** Regla booleana única que comparten huecos, servidor y avisos del panel. */
export function cabeCitaEnAgenda(
  appointments: readonly CitaParaSolape[],
  nueva: CitaParaSolape,
  contexto: ContextoSolape = {},
  excluirId?: string,
): boolean {
  return conflictosDeAgenda(appointments, nueva, contexto, excluirId).length === 0;
}

/** Las citas de esa profesional que realmente impiden el hueco pedido. */
export function solapaConAgenda(
  appointments: Appointment[],
  hueco: HuecoPedido,
  contexto: ContextoSolape = {},
): Appointment[] {
  return conflictosDeAgenda(
    appointments,
    {
      employeeId: hueco.employeeId,
      start: hueco.start,
      duration: hueco.duration,
      serviceIds: hueco.serviceIds,
      status: "pending",
    },
    contexto,
    hueco.excluirId,
  );
}

/**
 * Para la web pública: los tramos activos de una cita en minutos desde su
 * inicio, o `undefined` si ocupa todo su tiempo (lo normal).
 */
export function tramosActivosEnMinutos(
  cita: Pick<CitaParaSolape, "start" | "duration" | "serviceIds">,
  contexto: ContextoSolape,
): Array<[number, number]> | undefined {
  const inicio = Date.parse(cita.start);
  const tramos = tramosActivosDeCita(cita, contexto);
  if (tramos.length === 1 && tramos[0].desde === inicio && tramos[0].hasta === inicio + cita.duration * 60_000) return undefined;
  return tramos.map((t) => [Math.round((t.desde - inicio) / 60_000), Math.round((t.hasta - inicio) / 60_000)]);
}
