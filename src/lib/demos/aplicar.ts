import { useEffect, useMemo } from "react";

import { inferBusinessType } from "../business-type";
import { blankDemoProfile } from "../demo-profile";
import { useAccesosDemo } from "../accesos-maqueta";
import { salon } from "../mock/salon";
import type { SalonProfile } from "../mock/types";
import { conRegistroEnPausa, useSalonStore } from "../store";
import { useVersiones } from "../versiones-maqueta";
import { claveDelDia } from "../dia-cerrado-panel";
import { demoRegistrada, marcaDeDemo } from "./index";

/**
 * Cargar una demo registrada (lib/demos) en este navegador.
 *
 * Dos puertas, un mismo camino:
 *   - `/demo/<slug>` la carga SIEMPRE desde cero y entra al panel: es el enlace
 *     corto de la presentación.
 *   - `/s/<slug>` sin `?d=` la carga solo si este navegador no la tiene ya: así
 *     la reserva que se hace en la web se sigue viendo en el panel, y volver a
 *     la web no la borra.
 */

/**
 * Clave de localStorage con la demo registrada cargada: «slug@versión@día».
 * Lleva el día porque la agenda de una demo es relativa a hoy (y, si hoy el
 * salón cierra, abre igual: `SalonProfile.demoAbreHoy`): la de ayer no vale.
 */
const CLAVE_MARCA = "sishow-demo-registrada";
/**
 * Prefijo con el que la web pública recuerda el `?d=` de la pestaña (ver
 * `DEMO_SESSION_PREFIX` en routes/s.$salonSlug.tsx). `/demo/<slug>` lo borra
 * para que la URL corta enseñe la demo registrada y no un enlace anterior.
 */
const PREFIJO_ENLACE_PESTANA = "trimly-demo-link:";

/** Copia en memoria de la marca, para cuando no hay localStorage (modo privado, pruebas). */
let marcaEnMemoria: string | null = null;

function leerMarca(): string | null {
  try {
    const almacen = globalThis.localStorage;
    if (almacen) return almacen.getItem(CLAVE_MARCA);
  } catch {
    // Almacenamiento bloqueado: vale la copia en memoria.
  }
  return marcaEnMemoria;
}

function guardarMarca(marca: string): void {
  marcaEnMemoria = marca;
  try {
    globalThis.localStorage?.setItem(CLAVE_MARCA, marca);
  } catch {
    // Modo privado: la marca vive solo en esta visita.
  }
}

/** El perfil completo que se carga: el de ejemplo, en blanco lo de la demo anterior, y encima el registrado. */
export function perfilDeDemoRegistrada(perfil: SalonProfile): SalonProfile {
  return {
    ...salon,
    ...blankDemoProfile(),
    teamHours: undefined,
    teamIds: undefined,
    ...perfil,
  };
}

/**
 * Carga la demo registrada `slug` en la store. Sustituye el salón entero:
 * perfil, carta, equipo, citas, clientas, lista de espera, cobros apuntados a
 * mano y el historial de cambios — lo de otra demo no puede colarse en esta
 * (un cobro apuntado a «a123» de otra semilla caería en otra cita).
 *
 * `panel: true` (la puerta `/demo/<slug>`) además deja el panel como lo ve la
 * gerente, en el diseño de siempre, y olvida el `?d=` de esta pestaña.
 *
 * @returns `false` si no hay demo registrada con ese slug.
 */
export function cargarDemoRegistrada(slug: string, opciones: { panel?: boolean } = {}): boolean {
  const demo = demoRegistrada(slug);
  if (!demo) return false;
  const perfil = perfilDeDemoRegistrada(demo.perfil);
  const store = useSalonStore.getState();
  conRegistroEnPausa(() => {
    useSalonStore.setState({
      salonProfile: perfil,
      realSalonSlug: null,
      miembro: null,
      cambios: [],
      payments: [],
      lastFreedSlot: null,
      ...(opciones.panel ? { panelV2: false } : {}),
    });
    store.applyBusinessType(inferBusinessType(perfil.tagline, perfil.name), {
      team: perfil.team,
      menu: perfil.menu,
      noShowFeeEur: perfil.noShowFeeEur,
      smartSpread: perfil.smartSpread,
      duracionFlexible: perfil.duracionFlexible,
      mezcla: demo.mezcla,
      abrirHoy: true,
    });
  });
  store.markDemoActive();
  // Versiones de «Mi página» de una carga anterior de esta misma demo: fuera.
  useVersiones.setState((s) => ({ porSalon: { ...s.porSalon, [slug]: [] } }));
  if (opciones.panel) {
    // La gerente (la primera del equipo) mira el panel; los miembros de la
    // demo se regeneran con el equipo nuevo en cuanto se pinte.
    useAccesosDemo.setState({ miembros: null, claveEquipo: null, verComo: null });
    try {
      globalThis.sessionStorage?.removeItem(`${PREFIJO_ENLACE_PESTANA}${slug}`);
    } catch {
      // Sin sessionStorage no hay enlace anterior que olvidar.
    }
  }
  const marca = marcaDeHoy(slug);
  if (marca) guardarMarca(marca);
  return true;
}

/** La marca que tendría hoy esta demo registrada. */
function marcaDeHoy(slug: string): string | null {
  const marca = marcaDeDemo(slug);
  return marca ? `${marca}@${claveDelDia(new Date())}` : null;
}

/** ¿Guarda esta pestaña un `?d=` de este slug (la web lo recuerda para sobrevivir a una recarga)? */
export function enlaceDemoEnPestana(slug: string): boolean {
  try {
    return Boolean(globalThis.sessionStorage?.getItem(`${PREFIJO_ENLACE_PESTANA}${slug}`));
  } catch {
    return false;
  }
}

/**
 * ¿Tiene ya este navegador cargada esta demo registrada, en su versión actual?
 *
 * La marca sola no basta: si después se abrió un `?d=` de este mismo slug, el
 * perfil guardado es el del enlace (que deja en blanco los textos de la carta,
 * ver `CamposSinHeredar`) y la próxima visita sin `?d=` tiene que volver a
 * cargar la registrada.
 */
export function demoRegistradaCargada(slug: string): boolean {
  const marca = marcaDeHoy(slug);
  const perfil = useSalonStore.getState().salonProfile;
  return (
    marca !== null &&
    leerMarca() === marca &&
    perfil.slug === slug &&
    (demoRegistrada(slug)?.perfil.descripcionesServicios === undefined || perfil.descripcionesServicios !== undefined)
  );
}

/**
 * ¿Está este navegador enseñando la demo registrada `slug`, pero cargada otro
 * día o con otra versión de sus datos? Solo si lo guardado sigue siendo ella
 * (con sus textos de la carta): un `?d=` abierto encima manda y no se toca.
 */
export function demoRegistradaCaducada(slug: string): boolean {
  const perfil = useSalonStore.getState().salonProfile;
  return (
    demoRegistrada(slug) !== undefined &&
    perfil.slug === slug &&
    perfil.descripcionesServicios !== undefined &&
    Boolean(leerMarca()?.startsWith(`${slug}@`)) &&
    !demoRegistradaCargada(slug)
  );
}

/**
 * El panel (`/app`) de una demo registrada cargada otro día la vuelve a
 * cargar: «Hoy» tiene que ser hoy. Es lo que pasa si se abre `/demo/peluchic`
 * el domingo para tenerlo listo y la presentación es el lunes.
 */
export function useDemoRegistradaAlDia(hayEnlaceDemo: boolean): void {
  const slug = useSalonStore((s) => s.salonProfile.slug);
  const esDemo = useSalonStore((s) => s.demoActive && !s.realSalonSlug);
  useEffect(() => {
    if (hayEnlaceDemo || !esDemo || !demoRegistradaCaducada(slug)) return;
    cargarDemoRegistrada(slug);
  }, [hayEnlaceDemo, esDemo, slug]);
}

/**
 * La vía «demo registrada» de la web pública (`/s/<slug>` sin `?d=`).
 *
 * Devuelve `true` si este slug tiene demo registrada: la web tiene salón que
 * enseñar aunque no venga en el enlace. Y la carga en la store cuando toca:
 * sin `?d=` (ni en el enlace ni en la pestaña), sin salón real resuelto con
 * ese slug, y si este navegador no la tiene ya cargada.
 *
 * Un salón REAL con el mismo slug manda: `useRealSalon` pisa lo cargado aquí
 * en cuanto Supabase responde, igual que pisa un `?d=`.
 */
export function useDemoRegistrada(slug: string, hayEnlaceDemo: boolean): boolean {
  const existe = useMemo(() => demoRegistrada(slug) !== undefined, [slug]);
  useEffect(() => {
    if (!existe || hayEnlaceDemo || enlaceDemoEnPestana(slug)) return;
    if (useSalonStore.getState().realSalonSlug === slug) return;
    if (demoRegistradaCargada(slug)) return;
    cargarDemoRegistrada(slug);
  }, [existe, hayEnlaceDemo, slug]);
  return existe;
}
