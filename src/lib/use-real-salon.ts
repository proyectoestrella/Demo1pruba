import { useEffect, useRef } from "react";

import { getSalonProfile, listSalonData } from "./api/salons.functions";
import { blankDemoProfile } from "./demo-profile";
import { inferBusinessType } from "./business-type";
import { resolveActiveProfile } from "./salon-rows";
import { useSalonStore } from "./store";
import type { SalonProfile } from "./mock/types";

/**
 * Decide si este slug es un salón REAL y, si lo es, lo carga.
 *
 * Es el único sitio que enciende el backend. Funciona así:
 *
 *   1. Pregunta a Supabase por el slug.
 *   2. Si NO hay fila → `realSalonSlug` a null y se acabó. La página se
 *      comporta exactamente como antes: sigue leyendo el `?d=…` del enlace, no
 *      se vuelve a llamar a Supabase y no cambia ni un píxel. Es el caso de las
 *      ~54 demos de venta del rutero.
 *   3. Si SÍ hay fila → ese perfil es la fuente de verdad: pisa lo que hubiera
 *      guardado en este navegador y lo que traiga el `?d=…` (así el enlace
 *      corto `/s/the-best-shave-barber`, sin coleta, funciona), se aplica su
 *      tipo de negocio, y se hidratan citas y clientes reales.
 *
 * El orden importa: el perfil se escribe en la store ANTES de encender
 * `realSalonSlug`, para que ese `updateSalonProfile` no rebote a Supabase el
 * perfil que se acaba de leer de Supabase.
 *
 * @param slug        salón a resolver. `undefined` = no hay nada que mirar.
 * @param scope       "panel" trae también los clientes; "publica" no — la lista
 *                    de clientes es del dueño, no de quien abra el enlace.
 */
export function useRealSalon(slug: string | undefined, scope: "panel" | "publica") {
  const resuelto = useRef<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    // Un slug se resuelve una vez por montaje: sin esto, cada render que
    // cambiara alguna dependencia relanzaría la consulta y la hidratación.
    if (resuelto.current === slug) return;
    resuelto.current = slug;

    let cancelado = false;

    (async () => {
      let remoto: SalonProfile | null = null;
      try {
        const res = await getSalonProfile({ data: { slug } });
        remoto = res.profile;
      } catch (err) {
        // Supabase caído o tabla inexistente: se trata como "no es real". Una
        // demo de venta en mitad de una reunión no se puede quedar en blanco
        // porque falle una consulta que a ella no le hace ninguna falta.
        console.error("No se pudo comprobar si el salón es real:", err);
        remoto = null;
      }
      if (cancelado) return;

      const store = useSalonStore.getState();
      const { profile, real } = resolveActiveProfile(store.salonProfile, remoto);

      if (!real) {
        store.setRealSalonSlug(null);
        return;
      }

      // 1. Perfil (todavía con realSalonSlug a null → no se reenvía a Supabase).
      store.updateSalonProfile({ ...blankDemoProfile(), ...profile, slug });
      // 2. Equipo, carta, y el resto del idioma del negocio.
      store.applyBusinessType(inferBusinessType(profile.tagline, profile.name), {
        team: profile.team,
        menu: profile.menu,
        noShowFeeEur: profile.noShowFeeEur,
        smartSpread: profile.smartSpread,
      });
      // 3. A partir de aquí, todo lo que toque el panel se sincroniza.
      store.setRealSalonSlug(slug);

      // 4. Agenda real. Va la última porque `applyBusinessType` acaba de
      //    rellenar citas y clientes de EJEMPLO: hay que pisarlos, no mezclarlos.
      try {
        const datos = await listSalonData({ data: { slug, scope } });
        if (cancelado) return;
        useSalonStore.getState().hydrateFromServer(datos);
      } catch (err) {
        console.error("No se pudo cargar la agenda del salón:", err);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [slug, scope]);
}

/** ¿Está este navegador gestionando un salón real? Devuelve el slug o `null`. */
export function useRealSalonSlug(): string | null {
  return useSalonStore((s) => s.realSalonSlug);
}
