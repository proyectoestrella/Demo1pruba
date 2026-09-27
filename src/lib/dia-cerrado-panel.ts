import { parseRanges, todayIndex } from "./opening-hours";

/**
 * Días en que el salón cierra (lote P).
 *
 * PeluChic cierra lunes y domingo, y la presentación a María es un lunes: el
 * panel abría en «Citas de hoy 0 · Hoy ya no queda ningún hueco» y la caja en
 * «0,00 € · vs ayer −100 %», que es verdad y no dice nada. En un día cerrado
 * el panel mira al siguiente día abierto (Hoy) o al último (Caja).
 *
 * Solo cuenta el horario del salón: un horario vacío o ilegible no cierra
 * nada, para no esconder la agenda de un salón que no lo ha rellenado.
 */

/** «AAAA-MM-DD» en hora local (mismo formato que `fechaLocal` de hoja-del-dia.ts). */
export function claveDelDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ¿Cierra el salón ese día, según su horario de siete cadenas (lunes a domingo)? */
export function cierraEseDia(openingHours: string[] | undefined, fecha: Date): boolean {
  if (!openingHours || openingHours.length !== 7) return false;
  // Si ningún día tiene franjas, el horario no dice nada: no se da por cerrado.
  if (openingHours.every((d) => parseRanges(d).length === 0)) return false;
  return parseRanges(openingHours[todayIndex(fecha)]).length === 0;
}

/**
 * El día abierto más cercano a `desde`, sin contarlo, hacia delante (`paso`
 * 1) o hacia atrás (-1). A las 00:00. `null` si en dos semanas no abre nunca.
 */
export function diaAbiertoMasCercano(openingHours: string[] | undefined, desde: Date, paso: 1 | -1): Date | null {
  if (!openingHours || openingHours.length !== 7) return null;
  for (let n = 1; n <= 14; n++) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + n * paso);
    if (parseRanges(openingHours[todayIndex(d)]).length > 0) return d;
  }
  return null;
}

/** «el martes», «el lunes 5» si no es de esta semana, para frases como «Así viene el martes». */
export function elDia(fecha: Date, ahora: Date): string {
  const dias = Math.round(
    (+new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) -
      +new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())) /
      86_400_000,
  );
  const semana = fecha.toLocaleDateString("es-ES", { weekday: "long" });
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (Math.abs(dias) < 7) return `el ${semana}`;
  return `el ${semana} ${fecha.getDate()}`;
}
