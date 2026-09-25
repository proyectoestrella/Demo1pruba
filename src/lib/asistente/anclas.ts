/**
 * Mínimo de vocabulario del salón. Una pregunta de negocio, de plan o
 * técnica tiene que nombrar algo del salón: una entidad reconocida (clienta,
 * profesional, servicio) o una palabra de este léxico. Si no, no es del
 * dominio y el asistente dice «No lo sé seguro» en vez de adivinar
 * («¿cuánto vale el iPhone?», «¿cuándo es la luna llena este mes?»).
 *
 * Las fechas NO anclan: «este mes» sale en preguntas de todo tipo. Tampoco
 * palabras genéricas («vale», «nuevo», «hoy»). La charla y la ayuda no
 * necesitan ancla: se reconocen por sus propias pistas.
 */
const LEXICO = new RegExp(
  "\\b(?:" +
    [
      // agenda y citas
      "citas?", "agenda\\w*", "huecos?", "libres?", "sitio", "reserv\\w*", "solicitud\\w*", "turnos?", "visitas?",
      "vien\\w*", "vinieron", "vino a", "no vino", "venir", "venid[oa]s?", "cabina", "curr(?:o|ar|an|a)", "tengo lio", "me viene\\w*", "chica", "chicas", "senora\\w*", "tia", "sms", "vuelv\\w*", "volv\\w*", "repit\\w*", "siguiente", "quedan?", "queda",
      "recordatorio\\w*", "recordar", "espera\\w*", "franjas?", "flo(?:j|ja|jo|jea)\\w*", "cancel\\w*", "anul\\w*",
      "planton\\w*", "faltar\\w*", "faltaron", "presentad\\w*", "presentaron", "ocupaci\\w*", "ocupad\\w*",
      "marcar", "marcad\\w*", "pendientes?", "abiert\\w*", "abr\\w*", "cerrad\\w*", "cierr\\w*", "sillon", "cargad\\w*",
      // personas
      "clientas?", "clientes?", "gente", "cartera", "nuevas?", "inactiv\\w*", "fiel\\w*", "recurrente\\w*",
      "profesional\\w*", "equipo", "estilista\\w*", "peluquer\\w*", "trabaj\\w*", "librar", "libran", "horario\\w*",
      "telefono", "movil", "email", "correo", "contact\\w*", "notas?", "apunt\\w*", "anot\\w*", "observaci\\w*",
      "cumple\\w*", "deb\\w*", "deuda\\w*", "recargo\\w*", "bloque\\w*", "ficha\\w*", "gastad[oa]", "gasta", "gastan", "gastado",
      // servicios y dinero
      "servicios?", "carta", "precios", "tarifa\\w*", "duraci\\w*", "duran?", "tarda", "pedid\\w*", "piden", "pide",
      "rentab\\w*", "estrella", "colou?r\\w*", "formula\\w*", "tint\\w*", "veces",
      "dinero", "caja", "factur\\w*", "cobr\\w*", "ingres\\w*", "ganad\\w*", "ganamos", "sacado", "sacamos", "sacar", "saco", "euros", "pasta",
      "previst\\w*", "estimaci\\w*", "tarjeta", "efectivo", "bizum\\w*", "ticket", "resumen", "balance",
      "compar\\w*",
      // señal y marketing
      "senal\\w*", "fianza\\w*", "deposito\\w*", "plazo", "vencid\\w*", "campan\\w*", "marketing", "recuper\\w*",
      "resen\\w*", "opinion\\w*",
      // configuración, plan y técnica
      "salon", "web", "pagina", "enlace", "link", "url", "politica", "preguntas?", "formulario", "penaliz\\w*",
      "whatsapp", "mensaje\\w*", "confirm\\w*", "flexible", "calendario", "google", "sincroniz\\w*", "plan", "planes",
      "asistente", "tpv\\w*", "excel", "import\\w*", "automatic\\w*", "dominio", "informe", "export\\w*",
      "contrasena", "clave", "acceso", "acced\\w*", "entrar", "panel", "lent[oa]s?", "lentisim\\w*", "cargando", "carga", "pantalla", "aplicacion",
      "app", "crear", "creo", "meter", "meto", "mover", "muevo", "borr\\w*", "rechaz\\w*", "tpv123", "zzdominio",
    ].join("|") +
    ")\\b",
);

/** ¿Nombra la pregunta enmascarada algo del salón? Las entidades cuentan como ancla. */
/** Expresiones del salón que no son un sustantivo («qué tengo mañana», «cómo vamos este mes»). */
const FRASES_ANCLA = [
  /\b(?:hoy|manana|zzdia|zzperiodo|zzfranja)\b.*\b(?:que (?:tengo|hay|tenemos)|quien(?:es)? (?:esta|viene)|cuant[oa]s)\b|\b(?:que (?:tengo|hay|tenemos)|quien(?:es)? (?:esta|viene)|cuant[oa]s)\b.*\b(?:hoy|manana|zzdia|zzperiodo|zzfranja)\b/,
  /\b(?:como|que tal) (?:va|vamos|fue|ha ido)\b.*\b(?:zzperiodo|mes|semana|anterior)\b|\b(?:mejor|peor) que\b|\bfrente a\b/,
  /\b(?:estamos|vamos|va) (?:de )?llen[oa]s?\b|\bmas llen[oa]\b|\bcomo de llen[oa]s?\b/,
  /\ba quien le toca\b|\bfalta por hacer\b|\bpor resolver\b|\bsin cerrar\b|\bpor horas\b|\bjornada\b|\bla lista\b/,
  /\b(?:cerraremos|acabaremos|terminaremos|llegaremos)\b|\bforma de pago\b|\bdesglose\b|\bprimera vez\b|\bcomo va el dia\b|\bel dia de hoy\b|\b(?:de )?(?:la )?semana\b.*\b(?:citas?|dinero|cobr\w*|llen\w*|ocupa\w*)|\bpor horas\b/,
  /\bhora va peor\b|\ba cuenta\b|\bofrecemos\b|\bllegaremos\b|\bvoy a hacer\b|\brellen\w*|\bllenar\b|\bavisar\b|\bsin aparecer\b|\bse presenta\w*|\bmas hace\b|\bvale el dia\b/,
];

export function tieneAncla(enmascarado: string): boolean {
  if (/\bzz(?:clienta|pro|servicio)\b/.test(enmascarado)) return true;
  return LEXICO.test(enmascarado) || FRASES_ANCLA.some((r) => r.test(enmascarado));
}
