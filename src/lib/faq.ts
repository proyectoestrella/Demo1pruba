/**
 * Las preguntas frecuentes de la web pública.
 *
 * Hasta ahora se generaban enteras en la página (`faqFor`) a partir del tipo
 * de negocio y de la política de plantón: ciertas, pero de nadie. El dueño no
 * podía añadir la suya ("¿tenéis parking?", "¿hacéis a domicilio?") ni
 * corregir una respuesta que en su local no es verdad.
 *
 * Ahora el perfil puede traer `faq`, con el mismo formato de cadenas con `~`
 * que ya usan `team` y `menu` — así viaja igual dentro del enlace de la demo y
 * dentro del `profile` jsonb del salón real, sin tocar el esquema de Supabase.
 * Vacío o ausente = las de siempre, sin que cambie un píxel.
 */
import { professionalWord, type BusinessType } from "./business-type";
import { DEPOSIT_RATE, DEPOSIT_THRESHOLD_MIN } from "./mock/salon";
import { eur } from "./copy";

export const MAX_FAQ_ENTRIES = 8;
export const FAQ_QUESTION_MAX = 120;
export const FAQ_ANSWER_MAX = 600;

export interface FaqEntry {
  q: string;
  a: string;
}

/** "Pregunta~Respuesta" → entrada válida, o `null` si falta cualquiera de las dos. */
export function parseFaqEntry(raw: string): FaqEntry | null {
  const parts = String(raw).split("~");
  const q = (parts[0] ?? "").trim().slice(0, FAQ_QUESTION_MAX);
  // La respuesta puede llevar "~" dentro sin que se parta en dos: todo lo que
  // venga después de la primera es parte de la respuesta.
  const a = parts.slice(1).join("~").trim().slice(0, FAQ_ANSWER_MAX);
  if (!q || !a) return null;
  return { q, a };
}

/** Cadena canónica de una pregunta, para guardar en el perfil o en el enlace. */
export function formatFaqEntry(entry: FaqEntry): string {
  return `${entry.q}~${entry.a}`;
}

/**
 * Las preguntas que se generan solas a partir de lo que la app ya sabe hacer.
 * Son el punto de partida del editor y lo que se sigue enseñando si el salón
 * no ha escrito las suyas.
 */
export function faqPorDefecto(
  tipo: BusinessType,
  noShowFeeEur: number,
  noShowNoticeHours: number,
): FaqEntry[] {
  const palabra = professionalWord(tipo);
  const respuestaCancelacion =
    noShowFeeEur > 0
      ? `Sí. Hasta ${noShowNoticeHours} h antes puedes cancelar o mover la cita sin coste desde el enlace que recibes al reservar. Pasada esa hora, la siguiente reserva lleva ${eur(noShowFeeEur)} de penalización.`
      : "Sí. Hasta 24 horas antes puedes cancelar o mover la cita sin coste desde el enlace que recibes al reservar.";
  return [
    { q: "¿Puedo cancelar o cambiar la cita?", a: respuestaCancelacion },
    {
      q: "¿Hace falta pagar por adelantado?",
      a: `Solo en los servicios largos, de más de ${DEPOSIT_THRESHOLD_MIN} minutos: se pide un depósito del ${Math.round(
        DEPOSIT_RATE * 100,
      )}% que se descuenta del total y se abona en el salón.`,
    },
    {
      q: "¿Atendéis sin cita previa?",
      a: "Si hay hueco, sí — pero la agenda suele ir llena. Reservar online es la forma segura de tener sitio.",
    },
    {
      q: `¿Puedo elegir ${palabra}?`,
      a: "Claro. En el paso 2 de la reserva eliges profesional, o dejas «cualquiera disponible» si lo que te corre prisa es la hora.",
    },
  ];
}

/**
 * Lo que se pinta en la sección «Preguntas frecuentes».
 *
 * Si el perfil trae preguntas propias, mandan enteras: el dueño que escribe
 * las suyas no quiere las nuestras detrás. Si no trae ninguna válida, se
 * devuelven las generadas, exactamente como antes.
 */
export function faqPublica(
  tipo: BusinessType,
  noShowFeeEur: number,
  noShowNoticeHours: number,
  propias: string[] | undefined,
): FaqEntry[] {
  const limpias = (propias ?? [])
    .map(parseFaqEntry)
    .filter((e): e is FaqEntry => e !== null)
    .slice(0, MAX_FAQ_ENTRIES);
  if (limpias.length > 0) return limpias;
  return faqPorDefecto(tipo, noShowFeeEur, noShowNoticeHours);
}
