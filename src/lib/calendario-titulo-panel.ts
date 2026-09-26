/**
 * Título del calendario (arriba a la izquierda), SIEMPRE con el año (lote 16):
 *   «Sábado, 26 de septiembre de 2026»
 *   «21 – 27 de septiembre de 2026»
 *   «28 de septiembre – 4 de octubre de 2026»
 *   «28 de diciembre de 2026 – 3 de enero de 2027»
 *   «Septiembre de 2026» (Mes)
 * Pura, con test.
 */
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function tituloCalendario(vista: "dia" | "varios" | "mes", dias: Date[], anchor: Date): string {
  if (vista === "mes") return `${capital(MESES[anchor.getMonth()])} de ${anchor.getFullYear()}`;
  if (vista === "varios" && dias.length > 1) {
    const pri = dias[0];
    const ult = dias[dias.length - 1];
    if (pri.getFullYear() !== ult.getFullYear())
      return `${pri.getDate()} de ${MESES[pri.getMonth()]} de ${pri.getFullYear()} – ${ult.getDate()} de ${MESES[ult.getMonth()]} de ${ult.getFullYear()}`;
    if (pri.getMonth() !== ult.getMonth())
      return `${pri.getDate()} de ${MESES[pri.getMonth()]} – ${ult.getDate()} de ${MESES[ult.getMonth()]} de ${ult.getFullYear()}`;
    return `${pri.getDate()} – ${ult.getDate()} de ${MESES[ult.getMonth()]} de ${ult.getFullYear()}`;
  }
  const d = vista === "varios" && dias.length === 1 ? dias[0] : anchor;
  return `${capital(DIAS[d.getDay()])}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
