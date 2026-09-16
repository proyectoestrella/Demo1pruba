/**
 * Las palabras que se pasean bajo la portada.
 *
 * Estaban escritas en el código y eran todas de barbería —«barba a navaja»,
 * «toalla caliente»—, así que una peluquería de señoras veía su nombre encima
 * de la carta de servicios de otro oficio. Lo primero es usar lo que el salón
 * haya escrito de sí mismo; si no ha escrito nada, se cae a un juego que al
 * menos corresponda a lo que hace.
 *
 * El tipo se deduce con `inferBusinessType` (lib/business-type.ts), la única
 * fuente de esa deducción en todo el repo — antes esta función tenía su
 * propia expresión regular, distinta de la de `WorkGallery.tsx` y la de
 * `s.$salonSlug.index.tsx`, y las tres podían no coincidir entre sí.
 */
import { inferBusinessType, type BusinessType } from "./business-type";

const PALABRAS_POR_TIPO: Record<BusinessType, string[]> = {
  barberia: ["Degradados", "Barba a navaja", "Toalla caliente", "Apurado", "Sin esperas"],
  estetica: ["Color", "Manicura", "Tratamientos", "Peinados", "Sin esperas"],
  peluqueria: ["Color", "Mechas", "Corte", "Peinados", "Sin esperas"],
  unisex: ["Cortes", "Color", "Barba", "Peinados", "Sin esperas"],
};

/** Genérico y cierto para cualquier salón: no dice de qué oficio es. */
const NEUTRAS = ["Corte", "Color", "Peinados", "Cuidado del cabello", "Sin esperas"];

export function cintaDeSalon(tagline: string | undefined, specialties: string[] = []): string[] {
  const propias = specialties.map((s) => s.trim()).filter(Boolean);
  if (propias.length >= 3) {
    // Se escriben en minúscula en Ajustes y aquí se ven grandes.
    return propias.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  }
  // Sin tagline no hay pista real: `inferBusinessType("")` caería en
  // "peluquería" por defecto, que es una palabra tan inventada como
  // cualquier otra cuando el salón no ha escrito nada de sí mismo.
  if (!tagline?.trim()) return NEUTRAS;
  return PALABRAS_POR_TIPO[inferBusinessType(tagline)];
}
