import { useEffect, useRef } from "react";

import { getSalonProfile, listSalonData } from "./api/salons.functions";
import { registrarAviso } from "./avisos-sync";
import { blankDemoProfile } from "./demo-profile";
import { inferBusinessType } from "./business-type";
import { resolveActiveProfile } from "./salon-rows";
import { useSalonStore } from "./store";
import type { Appointment, Client, SalonProfile, WaitlistEntry } from "./mock/types";

/** Lo que dice el aviso cuando la agenda de un salón real no ha podido cargarse. */
export const MENSAJE_CARGA_FALLIDA = "No hemos podido cargar tus datos. Vuelve a intentarlo.";

/** Datos de agenda tal y como los devuelve el servidor. */
export interface DatosDelSalon {
  appointments: Appointment[];
  clients: Client[];
  waitlist: WaitlistEntry[];
}

/**
 * La parte de la store que esta resolución necesita. Se declara como interfaz
 * para poder probar el orden de las llamadas sin montar React ni la store.
 */
export interface StoreSalonReal {
  salonProfile: SalonProfile;
  setPublicBookingResolution: (value: {
    slug: string;
    status: "resolviendo" | "demo" | "real" | "fallo";
  }) => void;
  setRealSalonSlug: (slug: string | null) => void;
  updateSalonProfile: (patch: Partial<SalonProfile>) => void;
  applyBusinessType: (
    type: ReturnType<typeof inferBusinessType>,
    overrides?: {
      team?: SalonProfile["team"];
      menu?: SalonProfile["menu"];
      noShowFeeEur?: number;
      smartSpread?: boolean;
    },
  ) => void;
  vaciarDatosDeEjemplo: () => void;
  hydrateFromServer: (data: DatosDelSalon) => void;
}

export interface DepsSalonReal {
  getSalonProfile: (arg: { data: { slug: string } }) => Promise<{ profile: SalonProfile | null }>;
  listSalonData: (arg: {
    data: { slug: string; vista: "panel" | "publica" };
  }) => Promise<DatosDelSalon>;
  /** Estado actual de la store. Se pide cada vez, nunca se cachea. */
  store: () => StoreSalonReal;
  /** Pone un aviso delante del dueño. Ver lib/avisos-sync.ts. */
  avisar: (mensaje: string, reintentar?: () => void) => void;
  /** ¿Se ha desmontado ya el componente que pidió esto? */
  cancelado: () => boolean;
}

export type ResultadoSalonReal = "demo" | "real" | "fallo" | "cancelado";

/**
 * Decide si este slug es un salón REAL y, si lo es, lo carga.
 *
 * Es el único sitio que enciende el backend. El orden de las cuatro cosas que
 * pasan aquí es lo importante, y lo es por un motivo muy concreto:
 *
 *   1. Pregunta a Supabase por el slug.
 *   2. Si NO hay fila → `realSalonSlug` a null y se acabó. La página se
 *      comporta exactamente como antes: sigue leyendo el `?d=…` del enlace y
 *      SÍ usa los datos de ejemplo. Es el caso de las ~54 demos de venta.
 *   3. Si SÍ hay fila → ese perfil es la fuente de verdad, se aplica su tipo
 *      de negocio… y acto seguido se VACÍAN las citas y clientes de ejemplo
 *      que `applyBusinessType` acaba de sembrar. Un salón de pago prefiere
 *      ver su panel vacío un instante antes que ver clientes inventados.
 *   4. Solo cuando la agenda real ha llegado de verdad se enciende
 *      `realSalonSlug`. A partir de ese momento —y ni un milisegundo antes—
 *      todo lo que toque el dueño se sincroniza con Supabase.
 *
 * El paso 4 cierra dos agujeros que estaban abiertos:
 *
 *   - **La ventana de carrera.** `setRealSalonSlug` se hacía ANTES del
 *     `await listSalonData`. Entre una cosa y otra hay un viaje de red
 *     completo con el panel ya pintado e interactivo: cualquier cosa que el
 *     dueño tocara en esa ventana escribía sobre citas y clientes de EJEMPLO
 *     y los subía a la base de datos del salón de pago.
 *   - **El fallo permanente.** Si `listSalonData` fallaba, `realSalonSlug`
 *     se quedaba puesto y la store se quedaba con los datos de ejemplo: el
 *     panel quedaba «conectado» al salón real enseñando datos falsos, y el
 *     primer cambio subía una cita inventada. Ahora un fallo deja
 *     `realSalonSlug` a null (nada sube) y pone un aviso en pantalla.
 *
 * @param slug   salón a resolver.
 * @param scope  "panel" trae también los clientes; "publica" no — la lista de
 *               clientes es del dueño, no de quien abra el enlace.
 */
export async function resolverSalonReal(
  slug: string,
  scope: "panel" | "publica",
  deps: DepsSalonReal,
): Promise<ResultadoSalonReal> {
  deps.store().setPublicBookingResolution({ slug, status: "resolviendo" });
  let remoto: SalonProfile | null = null;
  try {
    const res = await deps.getSalonProfile({ data: { slug } });
    remoto = res.profile;
  } catch (err) {
    // Sin respuesta no sabemos si el slug es real o demo. La reserva pública
    // no puede confirmar una cita local fingiendo que se guardó en servidor.
    console.error("No se pudo comprobar si el salón es real:", err);
    if (deps.cancelado()) return "cancelado";
    deps.store().setRealSalonSlug(null);
    deps.store().setPublicBookingResolution({ slug, status: "fallo" });
    return "fallo";
  }
  if (deps.cancelado()) return "cancelado";

  const store = deps.store();
  const { profile, real } = resolveActiveProfile(store.salonProfile, remoto);

  if (!real) {
    store.setRealSalonSlug(null);
    store.setPublicBookingResolution({ slug, status: "demo" });
    return "demo";
  }

  // Mientras se carga, este navegador NO está conectado a nada: así ningún
  // cambio del dueño puede viajar a Supabase antes de tener los datos reales.
  store.setRealSalonSlug(null);
  // 1. Perfil (con realSalonSlug a null → no se reenvía a Supabase).
  store.updateSalonProfile({ ...blankDemoProfile(), ...profile, slug });
  // 2. Equipo, carta, y el resto del idioma del negocio.
  store.applyBusinessType(inferBusinessType(profile.tagline, profile.name), {
    team: profile.team,
    menu: profile.menu,
    noShowFeeEur: profile.noShowFeeEur,
    smartSpread: profile.smartSpread,
  });
  // 3. `applyBusinessType` acaba de sembrar citas y clientes de EJEMPLO, que
  //    en un salón de pago no son de nadie. Fuera: mejor vacío que falso.
  store.vaciarDatosDeEjemplo();

  // 4. Agenda real. Solo si llega se enciende la sincronización.
  const intentar = async (): Promise<ResultadoSalonReal> => {
    try {
      // `vista` es solo lo que ESTA pantalla necesita. Lo que de verdad se
      // entrega lo recorta el servidor según quién esté llamando: pedir
      // "panel" sin ser miembro del salón devuelve la vista pública, sin una
      // sola ficha de cliente. Ver lib/api/autorizacion.ts.
      const datos = await deps.listSalonData({ data: { slug, vista: scope } });
      if (deps.cancelado()) return "cancelado";
      const ahora = deps.store();
      ahora.hydrateFromServer(datos);
      ahora.setRealSalonSlug(slug);
      ahora.setPublicBookingResolution({ slug, status: "real" });
      return "real";
    } catch (err) {
      console.error("No se pudo cargar la agenda del salón:", err);
      if (deps.cancelado()) return "cancelado";
      // Sin datos no hay conexión: nada de lo que se toque debe subir.
      deps.store().setRealSalonSlug(null);
      deps.store().setPublicBookingResolution({ slug, status: "fallo" });
      deps.avisar(MENSAJE_CARGA_FALLIDA, () => {
        deps.store().setPublicBookingResolution({ slug, status: "resolviendo" });
        void intentar();
      });
      return "fallo";
    }
  };

  return intentar();
}

/** Repite la identificación desde la reserva pública tras un fallo de red. */
export function reintentarSalonPublico(slug: string): Promise<ResultadoSalonReal> {
  return resolverSalonReal(slug, "publica", {
    getSalonProfile,
    listSalonData,
    store: () => useSalonStore.getState(),
    avisar: registrarAviso,
    cancelado: () => false,
  });
}

/**
 * «Un slug se resuelve una vez por montaje», con una salvedad que costó un
 * panel entero: la limpieza del efecto LIBERA el slug.
 *
 * Antes la referencia se quedaba con el slug aunque el efecto se limpiara.
 * En desarrollo React monta, limpia y vuelve a montar cada efecto en la
 * MISMA instancia (modo estricto): la primera consulta quedaba cancelada y
 * la segunda se saltaba porque «ya estaba resuelto», así que el panel de un
 * salón real se quedaba para siempre en «resolviendo» con los datos de la
 * web pública (visto el 25/09/2026 en la prueba real). Ahora, si la
 * resolución se cancela, el siguiente montaje la vuelve a lanzar.
 */
export function guardaDeResolucion() {
  let actual: string | null = null;
  return {
    /** ¿Hay que lanzar la resolución de este slug? */
    entrar(slug: string): boolean {
      if (actual === slug) return false;
      actual = slug;
      return true;
    },
    /** La resolución de este slug se ha cancelado: el próximo montaje la repite. */
    salir(slug: string): void {
      if (actual === slug) actual = null;
    },
  };
}

/** Resuelve el salón real de este slug durante la vida del componente. */
export function useRealSalon(slug: string | undefined, scope: "panel" | "publica") {
  const guarda = useRef(guardaDeResolucion());

  useEffect(() => {
    if (!slug) return;
    if (!guarda.current.entrar(slug)) return;

    let cancelado = false;

    void resolverSalonReal(slug, scope, {
      getSalonProfile,
      listSalonData,
      store: () => useSalonStore.getState(),
      avisar: registrarAviso,
      cancelado: () => cancelado,
    });

    return () => {
      cancelado = true;
      guarda.current.salir(slug);
    };
  }, [slug, scope]);
}

/** ¿Está este navegador gestionando un salón real? Devuelve el slug o `null`. */
export function useRealSalonSlug(): string | null {
  return useSalonStore((s) => s.realSalonSlug);
}
