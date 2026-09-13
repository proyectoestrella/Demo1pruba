/**
 * Las palabras que se pasean bajo la portada.
 *
 * Estaban escritas en el código y eran todas de barbería —«barba a navaja»,
 * «toalla caliente»—, así que una peluquería de señoras veía su nombre encima
 * de la carta de servicios de otro oficio. Lo primero es usar lo que el salón
 * haya escrito de sí mismo; si no ha escrito nada, se cae a un juego que al
 * menos corresponda a lo que hace.
 */

const POR_TIPO: Array<{ prueba: RegExp; palabras: string[] }> = [
  {
    prueba: /barber|caballero|shave/i,
    palabras: ["Degradados", "Barba a navaja", "Toalla caliente", "Apurado", "Sin esperas"],
  },
  {
    prueba: /est[ée]tica|belleza|beauty|nails|u[ñn]as|spa/i,
    palabras: ["Color", "Manicura", "Tratamientos", "Peinados", "Sin esperas"],
  },
  {
    prueba: /peluquer|estilista|hair|sal[óo]n/i,
    palabras: ["Color", "Mechas", "Corte", "Peinados", "Sin esperas"],
  },
];

/** Genérico y cierto para cualquier salón: no dice de qué oficio es. */
const NEUTRAS = ["Corte", "Color", "Peinados", "Cuidado del cabello", "Sin esperas"];

export function cintaDeSalon(tagline: string | undefined, specialties: string[] = []): string[] {
  const propias = specialties.map((s) => s.trim()).filter(Boolean);
  if (propias.length >= 3) {
    // Se escriben en minúscula en Ajustes y aquí se ven grandes.
    return propias.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  }
  const encontrado = POR_TIPO.find((t) => t.prueba.test(tagline ?? ""));
  return encontrado ? encontrado.palabras : NEUTRAS;
}
