/**
 * Copy compartida por las páginas públicas de reserva
 * (s.$salonSlug.index.tsx, s.$salonSlug.book.tsx, s.$salonSlug.confirmation.tsx).
 *
 * Antes este fichero llevaba el catálogo de servicios y de empleados en
 * español, todo en la variante de barbería (SERVICE_ES, CATEGORY_LABELS,
 * EMPLOYEE_ES). Ya no hace falta: el catálogo y el equipo activos —
 * lib/mock/salon.ts, mutados por tipo desde lib/business-type.ts— llevan su
 * nombre, descripción y categoría correctos de origen, así que las tres
 * páginas leen `service.name`/`service.category`/`employee.specialty`
 * directamente en vez de pasarlos por un diccionario aparte.
 */

/** Formats a euro amount as Spanish currency, e.g. 38 -> "38,00 €". */
export const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
