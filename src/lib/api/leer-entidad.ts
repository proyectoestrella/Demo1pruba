/**
 * Relee en el SERVIDOR la entidad a la que apunta un cambio, para decidir un
 * deshacer con lo que de verdad hay guardado y no solo con lo que este
 * navegador tiene cargado. Devuelve `null` si no se puede comprobar (entidad
 * sin lectura, tabla o columna ausentes): quien llama entonces se fía de la
 * comprobación local.
 */
import type { EntidadEnServidor } from "../cambios";
import { phoneKey, rowToAppointment, rowToClient, type AppointmentRow, type ClientRow } from "../salon-rows";

interface Lector {
  from: (tabla: string) => {
    select: (cols: string) => { eq: (c: string, v: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CambioParaLeer {
  tipo: string;
  entidad: string;
  idEntidad: string;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
}

function telefonoDe(c: CambioParaLeer): string {
  for (const lado of [c.despues, c.antes]) {
    const f = (lado.clienta ?? lado) as Record<string, unknown> | null;
    if (f && typeof f.phone === "string" && f.phone) return f.phone;
  }
  return "";
}

export async function leerEntidadServidor(
  sb: unknown,
  slug: string,
  c: CambioParaLeer,
  perfil?: Record<string, unknown> | null,
): Promise<EntidadEnServidor | null> {
  const db = sb as Lector;
  try {
    if (c.entidad === "cita") {
      const { data, error } = await db.from("appointments").select("*").eq("salon_slug", slug).eq("local_id", c.idEntidad).maybeSingle();
      if (error) return null;
      return data ? { existe: true, valor: rowToAppointment(data as AppointmentRow) as unknown as Record<string, unknown> } : { existe: false, valor: null };
    }
    if (c.entidad === "clienta") {
      let fila: unknown = null;
      if (ID_UUID.test(c.idEntidad)) {
        const r = await db.from("clients").select("*").eq("salon_slug", slug).eq("id", c.idEntidad).maybeSingle();
        if (r.error) return null;
        fila = r.data;
      }
      if (!fila) {
        const key = phoneKey(telefonoDe(c));
        // Sin id de servidor ni teléfono no hay forma de saber si existe: no se afirma nada.
        if (key.length < 6) return ID_UUID.test(c.idEntidad) ? { existe: false, valor: null } : null;
        const r = await db.from("clients").select("*").eq("salon_slug", slug).eq("phone_key", key).maybeSingle();
        if (r.error) return null;
        fila = r.data;
      }
      return fila ? { existe: true, valor: rowToClient(fila as ClientRow) as unknown as Record<string, unknown> } : { existe: false, valor: null };
    }
    if (c.entidad === "perfil") {
      if (!perfil) return null;
      return { existe: true, valor: { [c.idEntidad]: perfil[c.idEntidad] ?? null } };
    }
  } catch (err) {
    console.warn("leerEntidadServidor:", err);
  }
  return null;
}
