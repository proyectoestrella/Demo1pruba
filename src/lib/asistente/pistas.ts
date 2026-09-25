/**
 * Pistas: reglas legibles que refuerzan una intención cuando la pregunta
 * trae su expresión característica. Se aplican sobre el texto NORMALIZADO y
 * ENMASCARADO (sin tildes; zzclienta, zzpro, zzservicio, zzdia, zzperiodo).
 * Suman a la puntuación de parecido: no deciden solas, pero separan familias
 * vecinas («señales pendientes» frente a «vencidas» o «recibidas»).
 *
 * Cada regla nombra un concepto, no una frase concreta.
 */
export interface Pista {
  id: string;
  re: RegExp;
  /** Refuerzo. Por defecto 0,3. */
  peso?: number;
}

const CLI = "zzclienta";
const PRO = "zzpro";
const SER = "zzservicio";
const COLOR = "(?:zzservicio|colou?r\\w*|formula\\w*|tint\\w*)";
const DINERO = "(?:dinero|caja|factur\\w*|cobr\\w*|ingres\\w*|gan\\w*|sac\\w*|euros|pasta)";
const SENAL = "(?:senal\\w*|fianza\\w*|deposito\\w*|bizum\\w*)";
const COMO = "(?:^|\\b)(?:como|donde)\\b";

const r = (s: string) => new RegExp(s);

export const PISTAS: Pista[] = [
  // ── Hoy ──
  { id: "proxima-cita", re: r(`\\b(?:siguiente|proxima cita|a quien le toca|quien (?:esta|hay|viene) ahora|ahora (?:esta|hay)|ahora mismo|en el sillon|en la silla)\\b`) },
  { id: "lista-citas-hoy", re: r(`\\b(?:que citas me quedan|citas que (?:me )?quedan|lista de (?:las )?citas|quienes vienen|que me queda (?:hoy|por hoy)|que queda hoy)\\b`) },
  { id: "huecos-hoy", re: r(`\\b(?:huecos?|libres?|sitio|disponib\\w*|queda sitio|algo libre|tiempo libre|libra\\w*)\\b`), peso: 0.4 },
  { id: "ocupacion-hoy", re: r(`\\b(?:ocupaci\\w*|ocupad[oa]s?|porcentaje|llen[oa]s?|cargad[oa]s?|reservad[oa]s?)\\b`), peso: 0.4 },
  { id: "ingresos-hoy", re: r(`\\b${DINERO}\\b.*\\bhoy\\b|\\bhoy\\b.*\\b${DINERO}\\b`) },
  { id: "pendiente-de-ti", re: r(`\\b(?:que|algo) (?:tengo )?pendiente\\b|\\bpor resolver\\b|\\bme falta por hacer\\b|\\balgo esperandome\\b|\\bque me espera\\b`), peso: 0.35 },
  { id: "solicitudes-pendientes", re: r(`\\b(?:solicitud\\w*|peticion\\w*|por confirmar|sin (?:aceptar|confirmar))\\b`) },
  { id: "por-marcar", re: r(`\\bsin (?:marcar|cerrar)\\b|\\bpor marcar\\b|\\bmarcar si vin|\\bno he marcado\\b|\\bsin desenlace\\b`), peso: 0.4 },
  { id: "abierto-ahora", re: r(`\\b(?:estamos abiertos|esta abierto|abrimos hoy|abierto (?:ahora|hoy)|hasta que hora abr\\w*)\\b`) },
  { id: "colores-hoy", re: r(`\\b(?:colores|formulas|tintes)\\b.*\\bhoy\\b|\\bhoy\\b.*\\b(?:colores|formulas)\\b`) },
  // ── Agenda ──
  { id: "citas-hoy", re: r(`^(?!.*campan)(?:.*\\bcuant[ao]s? (?:citas|clientas|gente)\\b|.*\\bnumero de citas\\b|.*\\bagenda de\\b|.*\\bque (?:tengo|hay) (?:hoy|manana|zzdia)\\b|.*\\bquien(?:es)? viene (?:hoy|manana|zzdia)\\b|.*\\breparten\\b)`), peso: 0.4 },
  { id: "primer-hueco-servicio", re: r(`\\b(?:primer hueco|cuando (?:cabe|caben|hay sitio)|donde cabe|puedo meter)\\b.*${SER}|${SER}.*\\b(?:primer hueco|cabe)\\b`), peso: 0.4 },
  { id: "hueco-profesional", re: r(`\\b(?:hueco|libre|puede|primer hueco)\\b.*${PRO}|${PRO}.*\\b(?:hueco|libre|puede)\\b`), peso: 0.4 },
  { id: "recordatorios-manana", re: r(`\\brecordatorio\\w*|\\brecordar\\b`), peso: 0.25 },
  { id: "lista-espera", re: r(`\\blista de espera\\b|\\bespera(?:ndo|n)? (?:hueco|para)\\b|\\bquien(?:es)? espera\\w*`), peso: 0.5 },
  { id: "franja-floja", re: r(`\\b(?:franja|hora|dia)\\b.*\\b(?:floj\\w*|peor)\\b|\\bflojea\\b|\\bmenos gente\\b`) },
  { id: "dia-mas-lleno", re: r(`\\bdia\\b.*\\bmas (?:citas|lleno|trabajo|cargad\\w*)\\b|\\bque dia (?:hay|vamos) mas\\b|\\bdia mas lleno\\b`), peso: 0.4 },
  { id: "cancelaciones", re: r(`\\b(?:cancelaci\\w*|cancelad\\w*|cancelaron|anulad\\w*|anularon|ha anulado|han cancelado)\\b`) },
  { id: "plantones", re: r(`\\b(?:planton\\w*|no (?:vino|vinieron|ha venido|se presentaron|se presento)|faltaron|dado planton)\\b`) },
  // ── Clientas ──
  { id: "proxima-cita-clienta", re: r(`${CLI}.*\\b(?:cita|viene)\\b|\\b(?:cuando viene|proxima cita de|cuando le toca|cuando vuelve)\\b.*${CLI}`), peso: 0.4 },
  { id: "ultima-visita-clienta", re: r(`\\b(?:ultima (?:vez|visita)|cuando vino|hace que no viene|que se hizo)\\b.*${CLI}|${CLI}.*\\b(?:ultima vez|vino)\\b`), peso: 0.4 },
  { id: "ultimo-color-clienta", re: r(`${COLOR}.*${CLI}|${CLI}.*${COLOR}`), peso: 0.4 },
  { id: "frecuencia-clienta", re: r(`\\b(?:cada cuant\\w*|frecuencia)\\b`) },
  { id: "gasto-clienta", re: r(`\\b(?:gast\\w*|dejado)\\b.*${CLI}|${CLI}.*\\bgast\\w*`), peso: 0.4 },
  { id: "datos-clienta", re: r(`\\b(?:telefono|movil|email|correo|mail|contact\\w*|llamar)\\b.*${CLI}`), peso: 0.4 },
  { id: "notas-clienta", re: r(`\\b(?:notas?|apuntad\\w*|observaci\\w*|algo que saber)\\b.*${CLI}`), peso: 0.4 },
  { id: "clientas-total", re: r(`\\bcuantas clientas (?:tengo|hay|tenemos)\\b|\\bnumero de clientas\\b|\\bcartera\\b|\\bclientas en total\\b`) },
  { id: "clientas-nuevas", re: r(`\\bnuev[oa]s\\b|\\bprimera vez\\b`), peso: 0.25 },
  { id: "clientas-recurrentes", re: r(`\\b(?:repit\\w*|vuelv\\w*|fiel\\w*|recurrente\\w*)\\b`), peso: 0.3 },
  { id: "clientas-inactivas", re: r(`\\bno (?:vuelven|vuelve|han vuelto)\\b|\\bsin venir\\b|\\bhace (?:mucho|tiempo) que no viene\\b|\\bperdidas\\b|\\blleva(?:n)? tiempo sin\\b|\\binactiv\\w*`), peso: 0.45 },
  { id: "mejores-clientas", re: r(`\\bmejores clientas\\b|\\btop\\b|\\bmas gastan\\b|\\bmas dinero me deja\\b|\\bque mas (?:gasta|deja)\\b`), peso: 0.4 },
  { id: "color-pendiente", re: r(`\\b(?:falta|sin) (?:el )?(?:color|anotar|apuntar)\\b|\\bcolor(?:es)? (?:pendiente|sin anotar)\\b|\\bformulas? (?:me )?faltan\\b|\\bsin anotar\\b|\\bsin (?:el )?${COLOR} (?:anotad|apuntad)\\w*`), peso: 0.4 },
  { id: "cumpleanos", re: r(`\\bcumple\\w*`), peso: 0.5 },
  { id: "clientas-con-deuda", re: r(`\\b(?:debe|deben|deba|deban|deuda\\w*)\\b|\\b(?:tiene|tienen) recargo\\b|\\brecargos? pendientes?\\b`), peso: 0.5 },
  { id: "clienta-bloqueada", re: r(`\\bbloquead[oa]s?\\b|\\bbloqueo\\b|\\b(?:bloque\\w*|puede reservar)\\b.*${CLI}|${CLI}.*\\b(?:bloque\\w*|puede reservar)\\b`), peso: 0.4 },
  { id: "buscar-clienta", re: r(`^(?:busca|buscame|quien es|ficha de|abre (?:la )?ficha de)\\b.*${CLI}`), peso: 0.45 },
  // ── Equipo ──
  { id: "horario-profesional", re: r(`\\b(?:horario|trabaja|entra|a que hora)\\b.*${PRO}|${PRO}.*\\b(?:horario|trabaja)\\b`), peso: 0.35 },
  { id: "quien-trabaja", re: r(`\\bquien(?:es)? (?:trabaja\\w*|viene a trabajar|esta trabajando|esta en el salon trabajando)\\b`), peso: 0.45 },
  { id: "citas-profesional-periodo", re: r(`\\b(?:cuantas (?:citas|clientas)|atendid\\w*|como va|que tal va|como lo lleva)\\b.*${PRO}|${PRO}.*\\bcitas\\b`) },
  { id: "ocupacion-profesional", re: r(`\\b(?:ocupaci\\w*|ocupad\\w*|llen[oa]|cargad[oa]|porcentaje)\\b.*${PRO}|${PRO}.*\\b(?:ocupad\\w*|cargad[oa]|llen[oa])\\b`), peso: 0.4 },
  { id: "dinero-profesional", re: r(`${DINERO}.*${PRO}|${PRO}.*${DINERO}`), peso: 0.4 },
  { id: "lo-que-mas-hace", re: r(`\\b(?:mas (?:hace|le piden|pide|trabaja)|especializ\\w*|servicios hace mas)\\b.*${PRO}|${PRO}.*\\bmas (?:hace|trabaja)\\b`), peso: 0.55 },
  { id: "profesional-habitual", re: r(`\\bcon quien (?:va|suele)\\b|\\bquien (?:le hace|la atiende|atiende a)\\b`), peso: 0.45 },
  // ── Servicios ──
  { id: "precio-servicio", re: r(`\\b(?:precio|cuesta|vale|cobramos por|a cuanto esta)\\b.*${SER}|${SER}.*\\b(?:precio|cuesta)\\b`), peso: 0.4 },
  { id: "duracion-servicio", re: r(`\\b(?:dura|duracion|tarda|tiempo lleva)\\b.*${SER}|${SER}.*\\b(?:dura|tarda)\\b`), peso: 0.4 },
  { id: "servicio-mas-pedido", re: r(`\\bmas pedid\\w*|\\bestrella\\b|\\bque (?:se hace|piden|se pide) mas\\b|\\bservicio se hace mas\\b|\\bpiden mas\\b|\\bmas se pide\\b`), peso: 0.4 },
  { id: "servicio-mas-rentable", re: r(`\\brentab\\w*|\\brenta\\b|\\ba cuenta\\b|\\bpor hora\\b`), peso: 0.55 },
  { id: "carta", re: r(`\\b(?:carta|lista de precios|que servicios (?:tengo|hay|ofrezco)|que ofrecemos|que se puede reservar)\\b`), peso: 0.45 },
  { id: "veces-servicio", re: r(`\\b(?:cuant[oa]s veces|cuant[oa]s ${SER}|numero de ${SER})\\b|\\bveces\\b.*${SER}`), peso: 0.4 },
  { id: "dinero-servicio", re: r(`${DINERO}.*${SER}|${SER}.*${DINERO}|\\b(?:han|ha) dejado\\b.*${SER}|${SER}.*\\bdejado\\b`), peso: 0.4 },
  // ── Dinero ──
  { id: "cobrado-periodo", re: r(`${DINERO}`), peso: 0.15 },
  { id: "previsto-periodo", re: r(`\\bprevist\\w*|\\bque dinero entra\\b|\\bvoy a cobrar\\b`), peso: 0.35 },
  { id: "estimacion-mes", re: r(`\\bestimaci\\w*|\\bcerraremos\\b|\\bllegaremos\\b|\\bacabaremos\\b|\\bvoy a hacer\\b|\\bvamos a hacer\\b|\\bva a acabar\\b|\\bacabar el mes\\b|\\bcobrado mas previsto\\b`), peso: 0.45 },
  { id: "cobro-por-metodo", re: r(`\\b(?:tarjeta|efectivo|forma de pago|metodo de pago|desglose)\\b|\\bcobr\\w* (?:por|en) bizum\\b`), peso: 0.45 },
  { id: "comparar-periodos", re: r(`\\bcompar\\w*|\\bmejor que\\b|\\bpeor que\\b|\\brespecto\\b|\\bfrente a\\b|\\bcontra (?:el|la) (?:anterior|pasad[oa])\\b`), peso: 0.45 },
  { id: "precio-medio", re: r(`\\b(?:ticket medio|precio medio|promedio)\\b|\\b(?:de media|media|medio)\\b.*\\b(?:cita|deja|dinero|clienta|precio|euros|gasta)\\b|\\b(?:cita|deja|dinero|clienta|precio|euros|gasta)\\b.*\\b(?:de media|medio|media)\\b(?! hora)`), peso: 0.4 },
  { id: "resumen-mes", re: r(`\\b(?:resumen|balance)\\b(?!.*correo)|\\b(?:que tal|como) (?:va|vamos)\\b.*\\b(?:mes|zzperiodo)\\b|\\bcifras (?:clave|del mes)\\b`), peso: 0.35 },
  // ── Señal ──
  { id: "senales-pendientes", re: r(`${SENAL}.*\\b(?:pendiente\\w*|esper\\w*|tiene que pagar|faltan|pedidas|no han llegado|aun no)\\b|\\b(?:pendiente\\w*|esper\\w*|tiene que pagar)\\b.*${SENAL}`), peso: 0.45 },
  { id: "senales-vencidas", re: r(`\\b(?:vencid\\w*|caducad\\w*|plazo)\\b`), peso: 0.35 },
  { id: "senales-recibidas", re: r(`${SENAL}.*\\b(?:recibid\\w*|cobrad\\w*|(?<!no )han llegado|me han llegado)\\b|\\b(?:recibid\\w*|cobrad\\w*|me han llegado)\\b.*${SENAL}`), peso: 0.45 },
  { id: "regla-senal", re: r(`\\b(?:cuanto pido|regla|configurad\\w*|a quien (?:le )?pido|como tengo (?:puesta|configurada))\\b.*${SENAL}|${SENAL}.*\\b(?:regla|configurad\\w*)\\b`), peso: 0.6 },
  { id: "senal-cita", re: r(`${SENAL}.*${CLI}|${CLI}.*${SENAL}`), peso: 0.4 },
  // ── Marketing ──
  { id: "campanas", re: r(`\\bcampan\\w*(?!.*(?:todas|golpe|masiv|automat|a la vez|solas|sola\\b))|\\bmarketing\\b|\\bmandar a las clientas\\b`), peso: 0.45 },
  { id: "recuperables", re: r(`\\brecuper\\w*|\\bvolver a traer\\b|\\bhacer volver\\b`), peso: 0.5 },
  { id: "huecos-flojos", re: r(`\\b(?:llenar|lleno|ofrecer|ofrezco|rellen\\w*)\\b.*\\b(?:huecos?|horas|martes|tardes|flojos?|malas|franja)\\b|\\bfranja floja\\b.*\\b(?:ofrezco|ofrecer|a quien)\\b`), peso: 0.5 },
  { id: "segunda-visita", re: r(`\\b(?:una (?:sola )?vez|segunda visita|no (?:han )?repetido|no volvio)\\b|\\bnuev[oa]s? que no (?:han )?(?:vuelto|repetido)\\b`), peso: 0.5 },
  { id: "resenas", re: r(`\\bresen\\w*|\\bopinion\\w*`), peso: 0.45 },
  // ── Configuración ──
  { id: "horario-salon", re: r(`\\bhorario\\b(?!.*${PRO})|\\ba que hora (?:abrimos|abre|cerramos)\\b|\\bque dias abr\\w*`), peso: 0.3 },
  { id: "enlace-reservas", re: r(`\\b(?:enlace|link|url)\\b|\\bmi (?:pagina|web)\\b(?!.*(?:no|funciona))|\\bdonde reservan\\b`), peso: 0.4 },
  { id: "politica-cancelacion", re: r(`\\bpolitica\\b|\\bcancelar gratis\\b|\\bantelacion\\b|\\bweb (?:dice|pone)\\b.*\\bcancel`), peso: 0.45 },
  { id: "preguntas-reserva", re: r(`\\bpregunt\\w*\\b.*\\b(?:reserv\\w*|formulario)\\b|\\bles pido cuando reservan\\b`), peso: 0.45 },
  { id: "plantones-config", re: r(`\\b(?:penaliz\\w*|recargo|cobro algo|que pasa si no)\\b`), peso: 0.45 },
  { id: "mensajes-whatsapp", re: r(`\\b(?:que dice|texto|mensaje)\\b.*\\b(?:recordatorio|whatsapp|confirmacion)\\b|\\bque les mando por whatsapp\\b`), peso: 0.4 },
  { id: "duracion-flexible", re: r(`\\bflexible\\b|\\bfijo yo\\b|\\bdecide cuanto dura\\b|\\bduracion\\b.*\\b(?:al confirmar|se decide|al aceptar|la fijo)\\b`), peso: 0.45 },
  { id: "calendario-suscrito", re: r(`\\bgoogle calendar\\b|\\biphone\\b|\\bcalendario (?:de google|del movil)\\b|\\bsincroniz\\w*\\b(?!.*(?:dos sentidos|tpv))`), peso: 0.4 },
  { id: "equipo-y-colores", re: r(`\\bcolor(?:es)?\\b.*\\b(?:calendario|agenda|cada una|cada servicio)\\b|\\bde que color sale\\b|zzservicio (?:de cada|del calendario)|${COLOR}\\b.*\\b(?:calendario|agenda)\\b`), peso: 0.45 },
  // ── Ayuda y charla ──
  { id: "que-puedo-preguntar", re: r(`\\b(?:que|cuales) (?:te puedo preguntar|preguntas entiendes)\\b|\\bejemplos\\b|\\bpuedo preguntar\\w*\\b|\\bcategorias de preguntas\\b|\\bque tipo de cosas\\b`), peso: 0.45 },
  { id: "como-preguntar", re: r(`\\bcomo (?:te pregunto|tengo que escribirte|te hablo|te escribo)\\b|\\b(?:consejos|trucos)\\b.*\\bpregunt\\w*|\\bpreguntar(?:te)? mejor\\b`), peso: 0.5 },
  { id: "despedida", re: r(`\\b(?:despedida|adios|chao|hasta luego|nos vemos)\\b`), peso: 0.45 },
  { id: "buen-trabajo", re: r(`\\b(?:bien hecho|crack|genial|eres (?:un|una) \\w+|que bien|maquina|buen (?:curro|trabajo))\\b`), peso: 0.4 },
  { id: "no-entiendo", re: r(`\\bno (?:te |me )?(?:has |he )?entend\\w*`), peso: 0.6 },
  { id: "ayuda-humana", re: r(`\\b(?:persona|humano|alguien de verdad|ayuda de alguien|hablar con (?:alguien|una persona))\\b`), peso: 0.4 },
  { id: "broma", re: r(`\\b(?:chiste|broma|gracios\\w*|divertid\\w*)\\b`), peso: 0.45 },
  // ── Fuera de plan ──
  { id: "plan-mas-profesionales", re: r(`\\b(?:otra|mas|nueva) (?:peluquera|profesional|estilista|chica|empleada)\\b|\\bser (?:4|5|6|cuatro|cinco|seis)\\b`), peso: 0.45 },
  { id: "plan-segunda-pagina", re: r(`\\b(?:segunda|otra) (?:pagina|web)\\b`), peso: 0.45 },
  { id: "plan-dominio-propio", re: r(`\\bdominio\\b|\\bzzdominio\\b|\\bpropia (?:web|url|direccion)\\b`), peso: 0.5 },
  { id: "plan-informe-mensual", re: r(`\\binforme\\b|\\b(?:resumen|informe)\\b.*\\b(?:correo|email|mail)\\b`), peso: 0.45 },
  { id: "plan-whatsapp-automatico", re: r(`\\bwhatsapp\\b.*\\b(?:conteste|contesta|(?:solos|solas|sola|solo|automatic\\w*|de golpe|a la vez|sin tocar))\\b|\\brespuestas automaticas\\b|\\b(?:mensaje|confirmacion)\\w*\\b.*\\bautomatic\\w*`), peso: 0.5 },
  { id: "plan-recordatorio-automatico", re: r(`\\brecordatorio\\w*\\b.*\\b(?:solos|solas|sola|solo|automatic\\w*|de golpe|a la vez|sin tocar)\\b|\\b(?:solos|solas|sola|solo|automatic\\w*|de golpe|a la vez|sin tocar)\\b.*\\brecordatorio\\w*`), peso: 0.55 },
  { id: "plan-importar-mensual", re: r(`\\btpv\\b.*\\b(?:cada mes|automatic\\w*|sincroniz\\w*|actualiz\\w*)\\b|\\b(?:cada mes|sincroniz\\w*)\\b.*\\btpv\\b`), peso: 0.5 },
  { id: "plan-asistente", re: r(`\\basistente\\b.*\\b(?:contesta|incluido|plan|responde)\\b`), peso: 0.45 },
  { id: "no-hace-facturas", re: r(`\\b(?:hacer|sacar|emitir) (?:una )?(?:factura|ticket)\\b|\\bverifactu\\b|\\bticket\\b(?! medio)|\\bfacturas\\b`), peso: 0.45 },
  { id: "no-cobra-tarjeta", re: r(`\\btarjeta\\b.*\\b(?:web|online|reserv\\w*|senal\\w*)\\b|\\bpaguen online\\b|\\bpasarela\\b|\\bpagar online\\b`), peso: 0.55 },
  { id: "no-escribe-google", re: r(`\\bcalendario de la clienta\\b|\\bdos sentidos\\b|\\b(?:se cambia|cambia tambien|se actualiza|se mueve)\\b.*\\bgoogle\\b`), peso: 0.55 },
  { id: "no-campanas-automaticas", re: r(`\\bmasiv\\w*|\\btodas (?:a la vez|de golpe)\\b|\\bcampan\\w*.*\\b(?:solos|solas|sola|solo|automatic\\w*|de golpe|a la vez|sin tocar)\\b`), peso: 0.55 },
  // ── Dudas técnicas ──
  { id: "tec-crear-cita", re: r(`${COMO}.*\\b(?:creo|crear|meto|meter|apunto|hago|doy|dar)\\b.*\\bcita\\b`), peso: 0.45 },
  { id: "tec-mover-cita", re: r(`${COMO}.*\\b(?:cambio|muevo|mover|paso)\\b.*\\bcita\\b|\\bmover (?:una )?cita\\b`), peso: 0.45 },
  { id: "tec-confirmar", re: r(`${COMO}.*\\b(?:confirmo|acepto|apruebo|confirmar|aceptar)\\b|\\bdonde (?:confirmo|acepto|le doy a confirmar)\\b`), peso: 0.5 },
  { id: "tec-cancelar", re: r(`${COMO}.*\\b(?:cancelo|anulo|borro|elimino|rechazo|rechazar)\\b`), peso: 0.5 },
  { id: "tec-anotar-color", re: r(`${COMO}.*\\b(?:apunto|anoto|guardo|pongo)\\b.*${COLOR}`), peso: 0.5 },
  { id: "tec-importar-tpv", re: r(`\\b(?:importo|importar|traer|traigo|subir|subo|paso)\\b.*\\b(?:tpv\\w*|excel)\\b(?!.*cada mes)`), peso: 0.45 },
  { id: "tec-senal", re: r(`${COMO}.*\\b(?:activo|pongo|pido|configuro|funciona)\\b.*${SENAL}`), peso: 0.5 },
  { id: "tec-horario", re: r(`${COMO}.*\\b(?:cambio|cierro|pongo|modifico)\\b.*\\b(?:horario|dia|vacaciones|festivo)\\b`), peso: 0.5 },
  { id: "tec-precios", re: r(`${COMO}.*\\bcambio\\b.*\\bprecio\\b|\\b(?:anadir|crear) (?:un )?(?:servicio|zzservicio)\\b|\\bnuevo servicio\\b`), peso: 0.5 },
  { id: "tec-no-llegan-reservas", re: r(`\\bno (?:me )?llegan\\b|\\bnadie reserva\\b|\\bweb no funciona\\b`), peso: 0.5 },
  { id: "tec-no-sale-cita", re: r(`\\bno (?:encuentro|me aparece|aparece|me sale|sale|veo)\\b.*\\bcita\\b|\\bperdido una cita\\b`), peso: 0.5 },
  { id: "tec-whatsapp-no-abre", re: r(`\\bwhatsapp\\b.*\\bno (?:se )?(?:abre|manda|envia|funciona|va)\\b|\\bno (?:se )?abre (?:el )?whatsapp\\b`), peso: 0.5 },
  { id: "tec-panel-lento", re: r(`\\b(?:lent[oa]s?|lentisim[oa]|cargando|no carga|tarda mucho en cargar|se queda (?:pillad[oa]|colgad[oa]))\\b`), peso: 0.5 },
  { id: "tec-contrasena", re: r(`\\bcontrasena\\b|\\bno puedo entrar\\b|\\bacceso\\b|\\bolvidado la clave\\b|\\bno me llega el enlace\\b|\\bno (?:me acuerdo|recuerdo)\\b.*\\b(?:acceder|entrar|clave)\\b|\\bcomo (?:entro|accedo)\\b`), peso: 0.55 },
  { id: "gracias", re: r(`\\bgracias\\b|\\bte lo agradezco\\b`), peso: 0.45 },
  { id: "como-estas", re: r(`\\bque tal (?:estas|vas|andas|te va)\\b|\\bcomo (?:estas|andas|te va)\\b`), peso: 0.45 },
  { id: "que-sabes-hacer", re: r(`\\bque (?:puedes|sabes) hacer\\b|\\bpara que sirves\\b|\\bque haces\\b`), peso: 0.45 },
  { id: "plan-mas-profesionales", re: r(`\\bcuant[ao]s (?:profesionales|peluqueras|empleadas|estilistas)\\b.*\\b(?:plan|deja|puedo)\\b|\\blimite de (?:profesionales|equipo)\\b`), peso: 0.5 },
  // Marcadores léxicos de plan: suman a la función de plan aunque la pregunta se parezca a una de negocio.
  { id: "plan-informe-mensual", re: r(`\\b(?:descarg\\w*|export\\w*)\\b.*\\b(?:resumen|informe|mes|datos)\\b|\\b(?:por|al) (?:correo|email|mail)\\b|\\bcada mes\\b.*\\b(?:resumen|informe)\\b`), peso: 0.35 },
  { id: "plan-mas-profesionales", re: r(`\\b(?:cuarta|quinta|sexta|otra mas) (?:profesional|peluquera|estilista|chica)\\b|\\bmas de (?:3|tres) (?:profesionales|peluqueras|estilistas)\\b`), peso: 0.55 },
  { id: "plan-recordatorio-automatico", re: r(`\\brecordatorio\\w*.*\\b(?:todos juntos|juntos|a la vez|envi\\w* solo)\\b`), peso: 0.5 },
  { id: "plan-whatsapp-automatico", re: r(`\\b(?:envi\\w*|mand\\w*) solo\\b|\\bsale automatic\\w*`), peso: 0.45 },
  { id: "no-escribe-google", re: r(`\\bgoogle\\b.*\\b(?:se actualiza aqui|aqui tambien|en los dos)\\b|\\bsi cambio algo en (?:el )?google\\b`), peso: 0.55 },
  { id: "plan-importar-mensual", re: r(`\\b(?:tpv\\w*|excel)\\b.*\\b(?:cuando quiera|siempre que|automatic\\w*|cada mes|sincroniz\\w*)\\b`), peso: 0.5 },
];

const POR_INTENCION = new Map<string, Pista[]>();
for (const p of PISTAS) POR_INTENCION.set(p.id, [...(POR_INTENCION.get(p.id) ?? []), p]);

/** Refuerzo de cada intención para esta pregunta enmascarada (solo las que tienen pista que casa). */
export function refuerzos(enmascarado: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of PISTAS) if (p.re.test(enmascarado)) out.set(p.id, Math.max(out.get(p.id) ?? 0, p.peso ?? 0.3));
  return out;
}
