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

/**
 * Euros sin decimales, para cifras grandes de resumen: 1234 -> "1.234 €".
 * Se usa donde el céntimo no aporta (caja del mes, totales de analítica);
 * para un precio concreto de un servicio o una cita, `eur`.
 */
export const eurRedondo = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;

/** Porcentaje a la española, con espacio antes del signo: 87 -> "87 %". */
export const pct = (n: number) => `${Math.round(n)} %`;

/** Hora en 24 h, que es como se lee una agenda en España: "09:30". */
export const hora = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** Fecha corta: "20 sept". */
export const fechaCorta = (iso: string | number | Date) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/** Fecha larga sin año: "domingo, 20 de septiembre". */
export const fechaLarga = (iso: string | number | Date) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

/**
 * Primera letra en mayúscula y el resto tal cual. En español solo va en
 * mayúscula la inicial: la clase `capitalize` de CSS convierte
 * "domingo, 20 de septiembre" en "Domingo, 20 De Septiembre", que está mal.
 */
export const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
