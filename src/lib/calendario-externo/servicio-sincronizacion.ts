/**
 * La orquestación de la sincronización, sin Supabase ni HTTP dentro: todo lo
 * que habla con el mundo entra por `AdaptadorCalendario` (ya atado a UNA
 * conexión concreta — credencial y calendario resueltos por quien llama) y
 * `DepsMapeo`. Igual que `autorizacion.ts`/`autorizacion.server.ts`: la
 * lógica se prueba aquí sin red; el cableado real vive en
 * `calendario-externo.server.ts`.
 */
import { icalUidDeCita, type BloqueoExterno, type CitaParaCalendario, type MapeoEvento } from "./tipos";

export interface AdaptadorCalendario {
  crear(cita: CitaParaCalendario): Promise<{ eventoExternoId: string; etag: string | null }>;
  /** Devuelve "no-existe" si el evento ya no está en el externo (lo borró la profesional a mano). */
  actualizar(
    eventoExternoId: string,
    etag: string | null,
    cita: CitaParaCalendario,
  ): Promise<{ eventoExternoId: string; etag: string | null } | "no-existe">;
  borrar(eventoExternoId: string, etag: string | null): Promise<void>;
}

export interface DepsMapeo {
  obtenerMapeo(conexionId: string, citaId: string): Promise<MapeoEvento | null>;
  guardarMapeo(m: Omit<MapeoEvento, "id">): Promise<void>;
  borrarMapeo(conexionId: string, citaId: string): Promise<void>;
}

export type ResultadoSincronizacion = { ok: true } | { ok: false; error: string };

function mensaje(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Lleva una cita (creada, movida o cancelada en siShow) a UNA conexión. Si
 * `escribirCitas` está apagado en esa conexión, no hace nada y se reporta
 * éxito: apagarlo no es un fallo, es la decisión del salón.
 */
export async function sincronizarCitaSaliente(
  cita: CitaParaCalendario,
  accion: "upsert" | "borrar",
  conexion: { id: string; escribirCitas: boolean },
  adaptador: AdaptadorCalendario,
  deps: DepsMapeo,
): Promise<ResultadoSincronizacion> {
  if (!conexion.escribirCitas) return { ok: true };

  const previo = await deps.obtenerMapeo(conexion.id, cita.id);

  if (accion === "borrar") {
    if (!previo) return { ok: true }; // nunca se escribió (p. ej. se activó la conexión después)
    try {
      await adaptador.borrar(previo.eventoExternoId, previo.etag);
    } catch (err) {
      return { ok: false, error: mensaje(err) };
    }
    await deps.borrarMapeo(conexion.id, cita.id);
    return { ok: true };
  }

  try {
    if (!previo) {
      const creado = await adaptador.crear(cita);
      await deps.guardarMapeo({
        conexionId: conexion.id,
        citaId: cita.id,
        eventoExternoId: creado.eventoExternoId,
        etag: creado.etag,
        icalUid: icalUidDeCita(cita.id),
      });
      return { ok: true };
    }

    const resultado = await adaptador.actualizar(previo.eventoExternoId, previo.etag, cita);
    if (resultado === "no-existe") {
      // Lo borró la profesional a mano en el calendario externo: se
      // recrea con un evento nuevo, no se puede "revivir" el mismo id.
      const creado = await adaptador.crear(cita);
      await deps.guardarMapeo({
        conexionId: conexion.id,
        citaId: cita.id,
        eventoExternoId: creado.eventoExternoId,
        etag: creado.etag,
        icalUid: icalUidDeCita(cita.id),
      });
      return { ok: true };
    }
    await deps.guardarMapeo({
      conexionId: conexion.id,
      citaId: cita.id,
      eventoExternoId: resultado.eventoExternoId,
      etag: resultado.etag,
      icalUid: icalUidDeCita(cita.id),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mensaje(err) };
  }
}

/** Un evento tal y como lo devuelve el proveedor al listar, ya resuelto si es un eco propio o no. */
export interface EventoExternoListado {
  eventoExternoId: string;
  /** null si el proveedor dice que se borró (Google: status "cancelled"; Apple: ya no aparece en el listado). */
  intervalo: { start: string; end: string } | null;
  resumen: string | null;
  /** El id de cita de siShow si el evento lleva la marca propia (eco); null si es ocupado de verdad. */
  citaIdPropio: string | null;
}

export interface DiffBloqueos {
  aCrear: Array<Omit<BloqueoExterno, "conexionId">>;
  aActualizar: Array<{ eventoExternoId: string; startAt: string; endAt: string; resumen: string | null }>;
  aBorrar: string[]; // eventoExternoId
}

/**
 * Calcula qué hay que crear/actualizar/borrar en `calendario_bloqueos_externos`
 * a partir de lo que ha devuelto el proveedor y lo que ya había guardado.
 *
 * Puro: ni escribe ni lee nada, solo compara. Si `bloquearHuecos` está
 * apagado, el resultado es "borra todo lo que hubiera, no crees nada": es lo
 * que hace que apagar el interruptor limpie lo que ya se había importado.
 */
export function diffBloqueosExternos(
  eventos: EventoExternoListado[],
  previos: BloqueoExterno[],
  salonSlug: string,
  employeeId: string | null,
  bloquearHuecos: boolean,
): DiffBloqueos {
  if (!bloquearHuecos) {
    return { aCrear: [], aActualizar: [], aBorrar: previos.map((p) => p.eventoExternoId) };
  }
  const previosPorId = new Map(previos.map((p) => [p.eventoExternoId, p]));
  const vistos = new Set<string>();
  const aCrear: DiffBloqueos["aCrear"] = [];
  const aActualizar: DiffBloqueos["aActualizar"] = [];
  const aBorrar: string[] = [];

  for (const ev of eventos) {
    // Un eco propio (nuestra propia cita, escrita por nosotros) nunca es un
    // "hueco ocupado por lo externo": ya está bloqueado por la cita misma.
    if (ev.citaIdPropio) continue;
    if (!ev.intervalo) {
      // Cancelado/borrado en el externo.
      if (previosPorId.has(ev.eventoExternoId)) aBorrar.push(ev.eventoExternoId);
      continue;
    }
    vistos.add(ev.eventoExternoId);
    const previo = previosPorId.get(ev.eventoExternoId);
    if (!previo) {
      aCrear.push({
        salonSlug,
        employeeId,
        eventoExternoId: ev.eventoExternoId,
        startAt: ev.intervalo.start,
        endAt: ev.intervalo.end,
        resumen: ev.resumen,
      });
    } else if (previo.startAt !== ev.intervalo.start || previo.endAt !== ev.intervalo.end || previo.resumen !== ev.resumen) {
      aActualizar.push({ eventoExternoId: ev.eventoExternoId, startAt: ev.intervalo.start, endAt: ev.intervalo.end, resumen: ev.resumen });
    }
  }
  // Lo que había guardado y ya no aparece en absoluto en el listado (Apple:
  // desaparecido del PROPFIND; no es el caso "cancelled" de arriba).
  for (const previo of previos) {
    if (!vistos.has(previo.eventoExternoId) && !aBorrar.includes(previo.eventoExternoId)) {
      const siguesLoQueSeEnumeró = eventos.some((e) => e.eventoExternoId === previo.eventoExternoId);
      if (!siguesLoQueSeEnumeró) aBorrar.push(previo.eventoExternoId);
    }
  }
  return { aCrear, aActualizar, aBorrar };
}

/** Minutos mínimos entre dos sincronizaciones de la misma conexión pedidas desde el panel. */
export const MINUTOS_ENTRE_SINCRONIZACIONES_PANEL = 5;

/** ¿Toca sincronizar esta conexión? Pura: sin sincronización previa, sí; si no, cuando han pasado los minutos. */
export function tocaSincronizar(ultimaSincronizacion: string | null, ahora: Date, minutos = MINUTOS_ENTRE_SINCRONIZACIONES_PANEL): boolean {
  if (!ultimaSincronizacion) return true;
  const t = Date.parse(ultimaSincronizacion);
  return !Number.isFinite(t) || ahora.getTime() - t >= minutos * 60_000;
}
