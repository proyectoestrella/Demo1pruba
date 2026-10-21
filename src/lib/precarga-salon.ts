/**
 * Precarga de la entrada al panel (rendimiento, 21-oct).
 *
 * Antes la carga inicial iba en serie: acceso → (montar React) → perfil →
 * agenda, tres idas y vueltas al servidor una detrás de otra. Ahora el perfil
 * (público) sale a la vez que el acceso, y la agenda en cuanto el acceso dice
 * que es un salón real con permiso. `resolverSalonReal` consume estas promesas
 * en el mismo orden de siempre: lo que cambia es cuándo se PIDEN, no cuándo
 * se APLICAN a la store.
 *
 * Cada promesa se usa una sola vez (se entrega y se olvida) y caduca a los
 * 10 s: nunca se sirven datos viejos de una entrada anterior.
 */
import { getSalonProfile, listSalonData } from "./api/salons.functions";

type Promesa<T> = { p: Promise<T>; en: number };
const VIDA_MS = 10_000;

function almacen<T>(pedir: (slug: string) => Promise<T>) {
  const m = new Map<string, Promesa<T>>();
  return {
    precargar(slug: string) {
      const e = m.get(slug);
      if (e && Date.now() - e.en < VIDA_MS) return;
      const p = pedir(slug);
      p.catch(() => {}); // el error lo ve quien la consuma
      m.set(slug, { p, en: Date.now() });
    },
    tomar(slug: string): Promise<T> | null {
      const e = m.get(slug);
      m.delete(slug);
      return e && Date.now() - e.en < VIDA_MS ? e.p : null;
    },
  };
}

const perfiles = almacen((slug) => getSalonProfile({ data: { slug } }));
const agendas = almacen((slug) => listSalonData({ data: { slug, vista: "panel" } }));

export const precargarPerfilDelSalon = (slug: string) => perfiles.precargar(slug);
export const precargarDatosDelSalon = (slug: string) => agendas.precargar(slug);

/** `getSalonProfile` que aprovecha la precarga si la hay. */
export const getSalonProfilePrecargado: typeof getSalonProfile = ((arg: { data: { slug: string } }) =>
  perfiles.tomar(arg.data.slug) ?? getSalonProfile(arg)) as typeof getSalonProfile;

/** `listSalonData` que aprovecha la precarga (solo vista panel). */
export const listSalonDataPrecargado: typeof listSalonData = ((arg: {
  data: { slug: string; vista: "panel" | "publica" };
}) => (arg.data.vista === "panel" ? agendas.tomar(arg.data.slug) : null) ?? listSalonData(arg)) as typeof listSalonData;
