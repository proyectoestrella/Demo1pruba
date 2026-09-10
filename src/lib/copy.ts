/**
 * Centralized Spanish copy shared across the public booking pages
 * (s.$salonSlug.index.tsx, s.$salonSlug.book.tsx, s.$salonSlug.confirmation.tsx).
 * Previously duplicated verbatim in each of those files — keep it here and
 * import from here instead of re-declaring local copies.
 */

/** Spanish name/description overrides for services, keyed by service id. */
export const SERVICE_ES: Record<string, { name: string; description: string }> = {
  corte: { name: "Corte de caballero", description: "Lavado, corte y acabado." },
  "corte-barba": {
    name: "Corte y barba",
    description: "El corte completo más el arreglo de barba.",
  },
  barba: { name: "Arreglo de barba", description: "Toalla caliente, perfilado y aceite." },
  afeitado: {
    name: "Afeitado a navaja",
    description: "Afeitado clásico con toalla caliente y bálsamo.",
  },
  infantil: { name: "Corte infantil", description: "Hasta 12 años, sin prisa." },
  cejas: { name: "Perfilado de cejas", description: "Con navaja o pinza." },
};

/** Maps a service id to the display category it belongs to in the menu. */
export const CATEGORY_LABELS: Record<string, string> = {
  corte: "Cortes",
  "corte-barba": "Cortes",
  infantil: "Cortes",
  barba: "Barba y afeitado",
  afeitado: "Barba y afeitado",
  cejas: "Barba y afeitado",
};

/** Display order for service categories throughout the booking flow. */
export const CATEGORY_ORDER = ["Cortes", "Barba y afeitado"];

/** Spanish specialty copy for employees, keyed by employee id (barbershop language). */
export const EMPLOYEE_ES: Record<string, { specialty: string }> = {
  mario: { specialty: "Cortes clásicos y degradados" },
  diego: { specialty: "Degradados y diseño" },
  ruben: { specialty: "Barba y afeitado a navaja" },
};

/** Formats a euro amount as Spanish currency, e.g. 38 -> "38,00 €". */
export const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
