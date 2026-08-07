/**
 * Centralized Spanish copy shared across the public booking pages
 * (s.$salonSlug.index.tsx, s.$salonSlug.book.tsx, s.$salonSlug.confirmation.tsx).
 * Previously duplicated verbatim in each of those files — keep it here and
 * import from here instead of re-declaring local copies.
 */

/** Spanish name/description overrides for services, keyed by service id. */
export const SERVICE_ES: Record<string, { name: string; description: string }> = {
  haircut: { name: "Corte de caballero", description: "Lavado, corte de firma y acabado." },
  beard: { name: "Arreglo de barba", description: "Toalla caliente, perfilado y cuidado." },
  color: { name: "Color", description: "Color de un tono, brillo y matiz final." },
  highlights: { name: "Mechas", description: "Iluminación pintada a mano, tono y tratamiento." },
  keratin: { name: "Tratamiento de keratina", description: "Alisado con proteína, dura 12 semanas." },
  styling: { name: "Peinado", description: "Secado o peinado para eventos especiales." },
};

/** Maps a service id to the display category it belongs to in the menu. */
export const CATEGORY_LABELS: Record<string, string> = {
  haircut: "Cortes",
  styling: "Cortes",
  beard: "Barbería",
  color: "Color",
  highlights: "Color",
  keratin: "Tratamientos",
};

/** Display order for service categories throughout the booking flow. */
export const CATEGORY_ORDER = ["Cortes", "Barbería", "Color", "Tratamientos"];

/** Spanish specialty copy for employees, keyed by employee id (barbershop language). */
export const EMPLOYEE_ES: Record<string, { specialty: string }> = {
  mario: { specialty: "Cortes clásicos y degradados" },
  diego: { specialty: "Color y canas" },
  ruben: { specialty: "Barba y tratamientos" },
};

/** Formats a euro amount as Spanish currency, e.g. 38 -> "38,00 €". */
export const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
