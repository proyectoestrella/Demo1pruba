/**
 * Teléfono de una clienta: validación y normalización compartidas por el
 * navegador (reserva pública) y el servidor (syncAppointment, saveClient).
 *
 * Se apoya en libphonenumber-js (metadatos `min`), el port de libphonenumber
 * de Google: valida longitud y prefijos por país y devuelve E.164.
 *
 * `phone_key` (últimos 9 dígitos, ver salon-rows.ts) NO cambia: el E.164 de un
 * número español termina en los mismos 9 dígitos que el formato antiguo, así
 * que una ficha guardada como "600 111 222" sigue casando con "+34600111222".
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

export interface PaisTelefono {
  code: CountryCode;
  name: string;
  prefix: string;
}

/** Lista corta de los países más frecuentes; el resto se escribe con su «+». */
export const PAISES_TELEFONO: PaisTelefono[] = [
  { code: "ES", name: "España", prefix: "+34" },
  { code: "PT", name: "Portugal", prefix: "+351" },
  { code: "FR", name: "Francia", prefix: "+33" },
  { code: "IT", name: "Italia", prefix: "+39" },
  { code: "DE", name: "Alemania", prefix: "+49" },
  { code: "GB", name: "Reino Unido", prefix: "+44" },
  { code: "MA", name: "Marruecos", prefix: "+212" },
  { code: "RO", name: "Rumanía", prefix: "+40" },
  { code: "CO", name: "Colombia", prefix: "+57" },
  { code: "VE", name: "Venezuela", prefix: "+58" },
  { code: "AR", name: "Argentina", prefix: "+54" },
  { code: "MX", name: "México", prefix: "+52" },
];

/** Valor del selector para «otro país»: el número se escribe con su prefijo. */
export const PAIS_OTRO = "OTRO";

const CIFRAS_ESPERADAS: Partial<Record<string, string>> = { ES: "son 9 cifras" };

export type ResultadoTelefono =
  | { ok: true; e164: string }
  | { ok: false; error: string };

/**
 * Valida `raw` para el país `pais` (código ISO o PAIS_OTRO). Si el texto
 * empieza por «+» o «00», manda el prefijo que trae.
 */
export function validarTelefono(raw: string | null | undefined, pais: string = "ES"): ResultadoTelefono {
  const texto = (raw ?? "").trim().replace(/^00/, "+");
  if (!texto) return { ok: false, error: "Escribe tu teléfono." };
  if (/[a-z]/i.test(texto)) return { ok: false, error: "El teléfono solo puede llevar cifras." };
  const conPrefijo = texto.startsWith("+");
  const paisInfo = PAISES_TELEFONO.find((p) => p.code === pais);
  if (!conPrefijo && !paisInfo) {
    return { ok: false, error: "Escribe el número con el prefijo de su país (por ejemplo, +351…)." };
  }
  const parsed = parsePhoneNumberFromString(texto, conPrefijo ? undefined : paisInfo!.code);
  if (parsed && parsed.isValid()) return { ok: true, e164: parsed.number };
  const destino = conPrefijo ? (parsed?.country ?? null) : paisInfo!.code;
  const nombre = PAISES_TELEFONO.find((p) => p.code === destino)?.name;
  if (!nombre) return { ok: false, error: "Ese teléfono no parece válido. Revisa el prefijo y las cifras." };
  const pista = CIFRAS_ESPERADAS[destino!];
  return { ok: false, error: `Ese teléfono no parece válido para ${nombre}${pista ? `: ${pista}` : ""}.` };
}

/**
 * Para datos que ya existen o llegan del panel (importaciones, fichas
 * antiguas): E.164 si es válido; si no, el texto tal cual, sin rechazar.
 */
export function normalizarTelefonoSiValido(raw: string | null | undefined, pais: string = "ES"): string {
  const r = validarTelefono(raw, pais);
  return r.ok ? r.e164 : (raw ?? "").trim();
}
