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

/*
 * Formateadores creados UNA vez (barrido de calidad 2026-09-26):
 * `toLocaleDateString` construye un `Intl.DateTimeFormat` nuevo en cada
 * llamada, ~30 µs; en una lista de 600 clientas eran 20 ms solo en fechas.
 * La salida es idéntica. Una fecha que no se puede leer da «—» en vez de
 * «Invalid Date» (y en vez de la excepción que lanzaría `format`).
 */
const FMT_HORA = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
const FMT_CORTA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const FMT_LARGA = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const formatear = (f: Intl.DateTimeFormat, iso: string | number | Date) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? f.format(d) : "—";
};

/** Hora en 24 h, que es como se lee una agenda en España: "09:30". */
export const hora = (iso: string | number | Date) => formatear(FMT_HORA, iso);

/** Fecha corta: "20 sept". */
export const fechaCorta = (iso: string | number | Date) => formatear(FMT_CORTA, iso);

/** Fecha larga sin año: "domingo, 20 de septiembre". */
export const fechaLarga = (iso: string | number | Date) => formatear(FMT_LARGA, iso);

/**
 * Primera letra en mayúscula y el resto tal cual. En español solo va en
 * mayúscula la inicial: la clase `capitalize` de CSS convierte
 * "domingo, 20 de septiembre" en "Domingo, 20 De Septiembre", que está mal.
 */
export const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
