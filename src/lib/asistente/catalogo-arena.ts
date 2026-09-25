/**
 * Catálogo del asistente generado desde la especificación de FRONTEND
 * (AlmacenExterno/sishow-asistente/preguntas-universo.md, §1-11). NO incluye
 * §12 (plan no incluido) ni §13 (dudas técnicas): esas no se enseñan en
 * «Cómo usar el asistente».
 *
 * CONECTAR: cuando llegue el motor de BACKEND, la página de ayuda y las
 * sugerencias leen su catálogo (`src/lib/asistente/guia.ts`) en vez de este.
 * Generado; no editar a mano: se regenera desde el .md.
 */
export type CategoriaAsistente = "hoy" | "agenda" | "clientas" | "equipo" | "servicios" | "dinero" | "senal" | "marketing" | "configuracion" | "ayuda";

export interface FamiliaAsistente {
  id: string;
  categoria: CategoriaAsistente;
  responde: string;
  ejemplos: string[];
  respuesta: string;
  accion: string | null;
}

export const CATEGORIAS: { id: CategoriaAsistente; titulo: string }[] = [
  { id: "hoy", titulo: "Hoy" },
  { id: "agenda", titulo: "Agenda" },
  { id: "clientas", titulo: "Clientas" },
  { id: "equipo", titulo: "Equipo" },
  { id: "servicios", titulo: "Servicios" },
  { id: "dinero", titulo: "Dinero" },
  { id: "senal", titulo: "Señal" },
  { id: "marketing", titulo: "Marketing" },
  { id: "configuracion", titulo: "Configuración" },
  { id: "ayuda", titulo: "Ayuda" },
];

export const FAMILIAS: FamiliaAsistente[] = [
  {
    "id": "citas-hoy",
    "categoria": "hoy",
    "responde": "cuántas citas hay hoy y cómo se reparten entre el equipo.",
    "ejemplos": [
      "cuantas citas tengo hoy",
      "citas hoy",
      "cuanta gente viene hoy",
      "q tengo hoy",
      "cuantas clientas hoy",
      "como vamos hoy de citas",
      "hoy cuantas",
      "cuants citas oy"
    ],
    "respuesta": "Hoy tienes 18 citas: 5 de María, 6 de Sara y 7 de Noelia.",
    "accion": "Ver calendario"
  },
  {
    "id": "citas-hoy-profesional",
    "categoria": "hoy",
    "responde": "cuántas citas tiene hoy una profesional y la próxima.",
    "ejemplos": [
      "cuantas tiene sara hoy",
      "q tiene noelia hoy",
      "citas de maria hoy",
      "agenda de sara",
      "noelia hoy",
      "cuantas le quedan a sara",
      "sara esta llena?"
    ],
    "respuesta": "Sara tiene 6 citas hoy; la siguiente es Daniela a las 14:25.",
    "accion": "Ver calendario"
  },
  {
    "id": "proxima-cita",
    "categoria": "hoy",
    "responde": "quién está ahora y quién viene después.",
    "ejemplos": [
      "quien viene ahora",
      "siguiente cita",
      "kien es la proxima",
      "quien esta ahora con maria",
      "a q hora es la siguiente",
      "q viene despues",
      "proxima clienta"
    ],
    "respuesta": "Ahora está Adriana García con Noelia; la siguiente es Marisol a las 17:00, dentro de 20 min.",
    "accion": "Abrir cita"
  },
  {
    "id": "lista-citas-hoy",
    "categoria": "hoy",
    "responde": "la lista de lo que queda hoy, por hora.",
    "ejemplos": [
      "q citas me quedan",
      "que queda hoy",
      "lista de hoy",
      "quien viene esta tarde",
      "citas de la tarde",
      "resto del dia",
      "que tengo por la mañana"
    ],
    "respuesta": "Te quedan 3: 17:00 Marisol (Mechas), 18:30 Pablo (Corte) y 19:00 Silvia (Tinte).",
    "accion": "Ver hoja del día"
  },
  {
    "id": "huecos-hoy",
    "categoria": "hoy",
    "responde": "cuántos huecos libres de 30 min o más quedan hoy, cuánto tiempo suman y de quién.",
    "ejemplos": [
      "huecos hoy",
      "tengo hueco hoy",
      "hay sitio esta tarde",
      "algun hueco libre",
      "huecos de sara hoy",
      "cabe alguien hoy",
      "puedo meter a alguien hoy",
      "hueco para hoy"
    ],
    "respuesta": "Quedan 3 huecos (3 h 30 en total): Sara a las 18:45, Noelia a las 18:45 y María a las 19:00.",
    "accion": "Nueva cita"
  },
  {
    "id": "ocupacion-hoy",
    "categoria": "hoy",
    "responde": "el % de la jornada del equipo que ya está reservado hoy.",
    "ejemplos": [
      "como de llena esta la agenda hoy",
      "ocupacion hoy",
      "% hoy",
      "estamos llenos hoy",
      "cuanto tenemos ocupado",
      "nivel de agenda hoy"
    ],
    "respuesta": "La agenda de hoy está al 53 %. Aún caben 3 citas.",
    "accion": null
  },
  {
    "id": "ingresos-hoy",
    "categoria": "dinero",
    "responde": "lo que vale el día, lo cobrado y lo que queda por cobrar.",
    "ejemplos": [
      "cuanto llevo hoy",
      "cuanto he hecho hoy",
      "caja de hoy",
      "cuanto he cobrado hoy",
      "q llevamos hoy",
      "facturado hoy",
      "cuanta pasta hoy",
      "ingresos hoy"
    ],
    "respuesta": "Hoy llevas 335 € cobrados de 675 €; quedan 340 € por cobrar.",
    "accion": null
  },
  {
    "id": "pendiente-de-ti",
    "categoria": "hoy",
    "responde": "lo que espera a María: solicitudes, citas por marcar y señales vencidas.",
    "ejemplos": [
      "q tengo pendiente",
      "que me falta por hacer",
      "pendientes",
      "q tengo q hacer hoy",
      "algo pendiente?",
      "que esta sin resolver",
      "tareas de hoy"
    ],
    "respuesta": "Tienes 9 cosas: 3 solicitudes por confirmar y 6 citas por marcar. Empieza por las solicitudes.",
    "accion": "Ver Hoy"
  },
  {
    "id": "solicitudes-pendientes",
    "categoria": "hoy",
    "responde": "las reservas de la web que esperan confirmación.",
    "ejemplos": [
      "solicitudes",
      "cuantas solicitudes tengo",
      "reservas sin confirmar",
      "q me han pedido",
      "nuevas reservas",
      "alguien ha reservado",
      "peticiones"
    ],
    "respuesta": "Tienes 3 solicitudes: Cristina (hoy 10:00), Elena (hoy 10:00) y Marisol (hoy 17:00).",
    "accion": "Confirmar la primera"
  },
  {
    "id": "por-marcar",
    "categoria": "hoy",
    "responde": "las citas pasadas en las que no se ha dicho si vino.",
    "ejemplos": [
      "quien no he marcado",
      "citas sin marcar",
      "vinieron todas?",
      "cuantas por marcar",
      "q me falta marcar",
      "no he dicho si vino"
    ],
    "respuesta": "Te faltan 6 por marcar, la más antigua de hoy a las 14:05 (Silvia).",
    "accion": "Marcar ahora"
  },
  {
    "id": "abierto-ahora",
    "categoria": "configuracion",
    "responde": "si el salón está abierto y hasta qué hora.",
    "ejemplos": [
      "estamos abiertos",
      "a q hora cerramos hoy",
      "hasta q hora abrimos",
      "abrimos el lunes?",
      "horario de hoy",
      "cierro a las 8?"
    ],
    "respuesta": "Sí, hoy abrís hasta las 20:00.",
    "accion": null
  },
  {
    "id": "colores-hoy",
    "categoria": "clientas",
    "responde": "quién viene hoy con color y qué fórmula lleva, o si le falta.",
    "ejemplos": [
      "q colores hay hoy",
      "quien viene a tinte hoy",
      "formulas de hoy",
      "tintes de hoy",
      "color de las de hoy",
      "q hay q preparar hoy"
    ],
    "respuesta": "Hoy hay 4 de color. A Paula Vega le pusiste 5.0 en raíz, oxidante 20 vol. A Daniela Díaz le falta el color anotado.",
    "accion": "Ver hoja del día"
  },
  {
    "id": "citas-dia",
    "categoria": "agenda",
    "responde": "las citas de un día concreto.",
    "ejemplos": [
      "citas el sabado",
      "q tengo el martes",
      "cuantas citas el 3",
      "agenda del jueves",
      "quien viene el 3 de octubre",
      "citas pasado mañana",
      "sabado como va"
    ],
    "respuesta": "El sábado 26 tienes 16 citas, de 9:00 a 14:00.",
    "accion": "Ver ese día"
  },
  {
    "id": "citas-manana",
    "categoria": "agenda",
    "responde": "las citas de mañana, por hora.",
    "ejemplos": [
      "kien viene mñn",
      "citas mañana",
      "q tengo mañana",
      "mañana cuantas",
      "agenda de mañana",
      "quien viene mañana por la mañana",
      "primera de mañana"
    ],
    "respuesta": "Mañana tienes 16 citas; la primera es Pablo a las 9:00 con Sara.",
    "accion": "Ver hoja de mañana"
  },
  {
    "id": "huecos-dia",
    "categoria": "agenda",
    "responde": "los huecos libres de un día, por profesional.",
    "ejemplos": [
      "huecos sabado",
      "hay hueco el martes",
      "sitio el jueves por la tarde",
      "huecos de noelia el viernes",
      "hueco de 2 horas el sabado",
      "tengo algo libre el 3"
    ],
    "respuesta": "El sábado hay 2 huecos: María de 12:00 a 13:00 y Noelia de 13:15 a 14:00.",
    "accion": "Nueva cita"
  },
  {
    "id": "primer-hueco-servicio",
    "categoria": "agenda",
    "responde": "el primer hueco donde cabe un servicio.",
    "ejemplos": [
      "cuando puedo meter unas mechas",
      "primer hueco para tinte",
      "cuando hay sitio para un recogido",
      "proximo hueco de 2h",
      "cuando cabe un corte con sara",
      "hueco para novia"
    ],
    "respuesta": "Unas mechas (2 h) caben el martes 29 a las 16:00 con Sara.",
    "accion": "Dar la cita"
  },
  {
    "id": "hueco-profesional",
    "categoria": "agenda",
    "responde": "cuándo tiene hueco una profesional.",
    "ejemplos": [
      "cuando tiene hueco sara",
      "noelia esta libre esta semana?",
      "huecos de maria",
      "cuando puede maria",
      "sara tiene sitio mañana",
      "tiene sitio noelia el sabado",
      "sara libre cuando",
      "hueco con maria la semana q viene"
    ],
    "respuesta": "Sara tiene el primer hueco mañana a las 12:30 (1 h 15). Esta semana le quedan 5 huecos.",
    "accion": "Ver calendario de Sara"
  },
  {
    "id": "citas-periodo",
    "categoria": "agenda",
    "responde": "cuántas citas hay en un periodo y cómo se compara con el anterior.",
    "ejemplos": [
      "cuantas citas esta semana",
      "citas del mes",
      "cuantas citas el mes pasado",
      "como va la semana",
      "citas este año",
      "semana q viene cuantas"
    ],
    "respuesta": "Esta semana llevas 87 citas, un 11 % más que la pasada.",
    "accion": "Ver Analítica"
  },
  {
    "id": "ocupacion-periodo",
    "categoria": "agenda",
    "responde": "la ocupación media del equipo en un periodo.",
    "ejemplos": [
      "ocupacion de la semana",
      "como de llenos estamos este mes",
      "% de ocupacion",
      "estamos llenas?",
      "ocupacion de noelia",
      "quien tiene mas trabajo"
    ],
    "respuesta": "Este mes estáis al 69 %: Noelia 74 %, Sara 70 %, María 62 %.",
    "accion": null
  },
  {
    "id": "proxima-cita-clienta",
    "categoria": "agenda",
    "responde": "cuándo viene una clienta.",
    "ejemplos": [
      "cuando viene marta",
      "marta tiene cita?",
      "q dia viene lucia gomez",
      "proxima cita de elena",
      "cuando le toca a paula",
      "viene esta semana cristina?"
    ],
    "respuesta": "Marta Ruiz viene el jueves 2 a las 13:50 a Mechas / balayage con María.",
    "accion": "Abrir ficha"
  },
  {
    "id": "recordatorios-manana",
    "categoria": "agenda",
    "responde": "a quién hay que mandar recordatorio para mañana.",
    "ejemplos": [
      "a quien recuerdo",
      "recordatorios",
      "q recordatorios faltan",
      "he recordado a todas?",
      "mensajes de mañana",
      "avisar a las de mañana"
    ],
    "respuesta": "Te faltan 16 recordatorios para mañana. Se mandan uno a uno desde tu WhatsApp.",
    "accion": "Ver hoja de mañana"
  },
  {
    "id": "lista-espera",
    "categoria": "agenda",
    "responde": "quién está en la lista de espera y para qué.",
    "ejemplos": [
      "quien esta en espera",
      "lista de espera",
      "alguien esperando hueco",
      "quien quiere tinte en espera",
      "espera de sara",
      "cuantas en espera"
    ],
    "respuesta": "Hay 4 en lista de espera; para Tinte está Lucía Sanz (martes por la tarde).",
    "accion": "Ver lista de espera"
  },
  {
    "id": "franja-floja",
    "categoria": "agenda",
    "responde": "la franja con menos citas de las últimas semanas.",
    "ejemplos": [
      "cual es mi franja mas floja",
      "cuando tengo menos gente",
      "hora mas vacia",
      "q dia flojea",
      "peor hora de la semana",
      "cuando no viene nadie"
    ],
    "respuesta": "Tu franja más floja es el martes por la tarde (2 % de ocupación). Puedes llenarla con la campaña «Llena los martes",
    "accion": "Ver Marketing"
  },
  {
    "id": "dia-mas-lleno",
    "categoria": "agenda",
    "responde": "el día o la hora con más citas de un periodo.",
    "ejemplos": [
      "q dia tengo mas citas",
      "dia mas lleno de la semana",
      "hora punta",
      "a q hora viene mas gente",
      "mejor dia del mes",
      "cuando tengo mas lio",
      "dia con mas gente",
      "q dia no para"
    ],
    "respuesta": "El día con más citas esta semana es el viernes 25 (21 citas).",
    "accion": null
  },
  {
    "id": "cancelaciones",
    "categoria": "agenda",
    "responde": "cuántas citas se han cancelado en un periodo.",
    "ejemplos": [
      "cuantas cancelaciones",
      "me han cancelado mucho?",
      "anulaciones esta semana",
      "cuantas han cancelado este mes",
      "tasa de cancelacion",
      "quien ha cancelado",
      "cancelaciones de hoy",
      "cuantas me han anulado"
    ],
    "respuesta": "Esta semana, 0 cancelaciones. ¡Bien!",
    "accion": null
  },
  {
    "id": "plantones",
    "categoria": "agenda",
    "responde": "cuántas clientas no vinieron o llegaron tarde, y quién repite.",
    "ejemplos": [
      "cuantas no vinieron",
      "plantones del mes",
      "quien me ha dejado plantada",
      "no shows",
      "marta ha faltado alguna vez",
      "quien falla mas"
    ],
    "respuesta": "Este mes, 10 no vinieron. Quien más falla es Mateo Mendoza (2 veces en 3 meses).",
    "accion": "Abrir ficha"
  },
  {
    "id": "ultima-visita-clienta",
    "categoria": "clientas",
    "responde": "qué se hizo una clienta la última vez, cuándo y con quién.",
    "ejemplos": [
      "q se hizo marta la ultima vez",
      "ultima vez de lucia",
      "que le hice a elena",
      "marta la ultima vez",
      "q se hizo paula",
      "ultima cita de cristina",
      "historial de marta"
    ],
    "respuesta": "Marta Ruiz vino el 14 de julio: Mechas / balayage con Noelia, 80 €.",
    "accion": "Abrir ficha"
  },
  {
    "id": "ultimo-color-clienta",
    "categoria": "clientas",
    "responde": "la última fórmula de color anotada.",
    "ejemplos": [
      "q color lleva marisol",
      "formula de elena",
      "q tinte le puse a paula",
      "color de lucia",
      "q le di de color a marta",
      "numero de tinte de cristina"
    ],
    "respuesta": "A Elena Martín le pusiste decoloración con oxidante 20 vol, 35 min; matiz 9.1 (14 de julio).",
    "accion": "Abrir ficha"
  },
  {
    "id": "frecuencia-clienta",
    "categoria": "clientas",
    "responde": "cada cuánto viene una clienta.",
    "ejemplos": [
      "cada cuanto viene marta",
      "cuantas veces viene elena",
      "frecuencia de lucia",
      "viene mucho paula?",
      "cada cuanto se tiñe cristina",
      "viene a menudo marta",
      "cada cuantas semanas viene lucia",
      "cuanto hace q no viene elena"
    ],
    "respuesta": "Elena viene cada 11 semanas de media; ya lleva 10 sin venir.",
    "accion": "Dar cita"
  },
  {
    "id": "gasto-clienta",
    "categoria": "clientas",
    "responde": "lo que ha gastado una clienta según sus citas (orientativo).",
    "ejemplos": [
      "cuanto ha gastado marta",
      "cuanto me deja elena",
      "gasto de lucia",
      "cuanto se ha dejado paula este año",
      "q gasta cristina",
      "cuanto lleva gastado marta",
      "marta cuanto se deja",
      "gasto de elena este año"
    ],
    "respuesta": "Elena lleva 480 € en 6 visitas (320 € en los últimos 12 meses). Es orientativo, según tus precios.",
    "accion": null
  },
  {
    "id": "datos-clienta",
    "categoria": "clientas",
    "responde": "teléfono, correo y cumpleaños de una clienta.",
    "ejemplos": [
      "telefono de marta",
      "tlf de elena",
      "movil de lucia",
      "correo de paula",
      "cual es el numero de cristina",
      "cuando es el cumple de marta"
    ],
    "respuesta": "Marta Ruiz: +34 612 112 669.",
    "accion": "WhatsApp"
  },
  {
    "id": "notas-clienta",
    "categoria": "clientas",
    "responde": "las observaciones y avisos de la ficha.",
    "ejemplos": [
      "notas de marta",
      "observaciones de elena",
      "algo q saber de lucia",
      "avisos de paula",
      "q apunte de cristina",
      "q tengo apuntado de marta",
      "algo importante de lucia",
      "nota de la ficha de elena"
    ],
    "respuesta": "De Elena tienes apuntado: «Usa el número 8. Le vendimos el champú de árbol de té, preguntar qué tal",
    "accion": "Abrir ficha"
  },
  {
    "id": "clientas-total",
    "categoria": "clientas",
    "responde": "cuántas clientas hay en la cartera.",
    "ejemplos": [
      "cuantas clientas tengo",
      "numero de clientas",
      "cuantas fichas",
      "tamaño de la cartera",
      "cuanta gente tengo",
      "cuantas fichas tengo",
      "cuantas clientas hay en total",
      "clientas en la base"
    ],
    "respuesta": "Tienes 595 clientas en tu cartera.",
    "accion": "Ver Clientas"
  },
  {
    "id": "clientas-nuevas",
    "categoria": "clientas",
    "responde": "cuántas clientas vinieron por primera vez en un periodo, y quiénes.",
    "ejemplos": [
      "clientas nuevas",
      "cuantas nuevas este mes",
      "nuevas esta semana",
      "gente nueva",
      "quien es nueva",
      "primeras visitas"
    ],
    "respuesta": "Este mes han venido 7 clientas nuevas. La última fue Valentina el 23.",
    "accion": "Ver Clientas › Nuevas"
  },
  {
    "id": "clientas-recurrentes",
    "categoria": "clientas",
    "responde": "cuántas repiten y qué parte son.",
    "ejemplos": [
      "cuantas repiten",
      "clientas fieles",
      "recurrentes",
      "% de clientas q vuelven",
      "cuantas vuelven",
      "cuantas son fijas",
      "clientas de siempre",
      "cuantas vienen siempre"
    ],
    "respuesta": "506 de 595 repiten (85 %). Vuelven cada 9 semanas de media.",
    "accion": null
  },
  {
    "id": "clientas-inactivas",
    "categoria": "clientas",
    "responde": "quién lleva tiempo sin venir y cuántas son.",
    "ejemplos": [
      "quien no vuelve",
      "clientas perdidas",
      "quien hace mucho q no viene",
      "inactivas",
      "a quien escribo",
      "clientas dormidas"
    ],
    "respuesta": "119 clientas llevan más de 8 semanas sin venir. Tienes el mensaje preparado.",
    "accion": "Ver campaña"
  },
  {
    "id": "mejores-clientas",
    "categoria": "clientas",
    "responde": "las clientas que más han gastado (orientativo).",
    "ejemplos": [
      "mejores clientas",
      "quien gasta mas",
      "top clientas",
      "mis 5 mejores",
      "clienta q mas me deja",
      "vip"
    ],
    "respuesta": "Tus 3 que más gastan: Pablo Mendoza (670 €), Alejandro Ortega (567 €) y Raúl Iglesias (557 €). Es orientativo, según tus precios.",
    "accion": null
  },
  {
    "id": "color-pendiente",
    "categoria": "clientas",
    "responde": "las clientas citadas en 14 días sin color anotado.",
    "ejemplos": [
      "color pendiente",
      "a quien le falta el color",
      "fichas sin formula",
      "q colores me faltan",
      "tintes sin apuntar",
      "sin color apuntado",
      "clientas sin tinte anotado",
      "a quien le falta la formula"
    ],
    "respuesta": "A 50 clientas citadas le falta el color. Apúntalo de TPV 123 antes de que lleguen.",
    "accion": "Ver Color pendiente"
  },
  {
    "id": "cumpleanos",
    "categoria": "clientas",
    "responde": "quién cumple años en un periodo.",
    "ejemplos": [
      "cumpleaños esta semana",
      "quien cumple hoy",
      "cumples del mes",
      "alguna clienta cumple mañana",
      "cumple esta semana alguien",
      "cumpleaños de hoy",
      "quien cumple este mes",
      "felicitar a alguien"
    ],
    "respuesta": "Esta semana cumple Lucía Gómez (el jueves).",
    "accion": null
  },
  {
    "id": "clientas-con-deuda",
    "categoria": "clientas",
    "responde": "quién tiene un recargo pendiente y cuánto suma.",
    "ejemplos": [
      "quien me debe",
      "deudas",
      "recargos pendientes",
      "alguien debe algo",
      "cuanto me deben",
      "alguien tiene recargo",
      "quien tiene algo pendiente de pagar",
      "deudas de clientas"
    ],
    "respuesta": "2 clientas te deben 14 €: Mateo Mendoza (7 €) y Carla Ruiz (7 €).",
    "accion": "Ver Clientas › Me deben"
  },
  {
    "id": "clienta-bloqueada",
    "categoria": "clientas",
    "responde": "si una clienta puede reservar por internet.",
    "ejemplos": [
      "puede reservar marta",
      "esta bloqueada lucia",
      "bloquee a alguien?",
      "quien esta bloqueada",
      "por q no puede reservar marta",
      "marta esta bloqueada?",
      "clientas bloqueadas",
      "lista de bloqueadas"
    ],
    "respuesta": "Marta puede reservar por internet.",
    "accion": "Abrir ficha"
  },
  {
    "id": "buscar-clienta",
    "categoria": "clientas",
    "responde": "la ficha de una clienta por nombre, apellido o teléfono.",
    "ejemplos": [
      "busca a marta",
      "ficha de lucia",
      "abre a elena martin",
      "quien es el 612112669",
      "clienta ruiz",
      "tengo a una tal valentina?"
    ],
    "respuesta": "Es Marta Ruiz: 7 visitas, la última el 23 de septiembre.",
    "accion": "Abrir ficha"
  },
  {
    "id": "horario-profesional",
    "categoria": "equipo",
    "responde": "el horario semanal de una profesional.",
    "ejemplos": [
      "horario de noelia",
      "q dias trabaja sara",
      "cuando libra maria",
      "sara trabaja el lunes?",
      "a q hora entra noelia",
      "cuando trabaja sara",
      "horas de maria",
      "sara q horario tiene"
    ],
    "respuesta": "Noelia trabaja Mar–Vie 10:00–20:00 · Sáb 9:00–14:00.",
    "accion": "Ver Equipo"
  },
  {
    "id": "quien-trabaja",
    "categoria": "equipo",
    "responde": "quién trabaja un día concreto.",
    "ejemplos": [
      "quien trabaja el sabado",
      "quien esta mañana",
      "estamos todas el viernes",
      "quien viene el lunes",
      "somos muchas mañana",
      "quien trabaja hoy",
      "quien libra el sabado",
      "esta noelia el jueves"
    ],
    "respuesta": "El sábado trabajáis las tres, de 9:00 a 14:00.",
    "accion": null
  },
  {
    "id": "citas-profesional-periodo",
    "categoria": "equipo",
    "responde": "cuántas citas ha hecho una profesional en un periodo.",
    "ejemplos": [
      "cuantas citas lleva noelia este mes",
      "citas de sara la semana pasada",
      "maria cuantas ha hecho",
      "quien ha hecho mas citas",
      "cuantas citas tiene sara esta semana",
      "citas de noelia en septiembre",
      "maria cuantas lleva hoy",
      "ranking de citas"
    ],
    "respuesta": "Noelia lleva 98 citas este mes, 12 más que Sara.",
    "accion": "Ver Equipo"
  },
  {
    "id": "ocupacion-profesional",
    "categoria": "equipo",
    "responde": "la ocupación de una profesional en un periodo.",
    "ejemplos": [
      "ocupacion de sara",
      "como de llena esta noelia",
      "maria tiene mucho trabajo?",
      "quien esta mas libre",
      "% de noelia",
      "sara esta muy llena?",
      "ocupacion de maria esta semana",
      "quien trabaja mas"
    ],
    "respuesta": "Sara está al 70 % este mes; la más libre es María (62 %).",
    "accion": null
  },
  {
    "id": "dinero-profesional",
    "categoria": "dinero",
    "responde": "lo que lleva cobrado y previsto una profesional en un periodo.",
    "ejemplos": [
      "cuanto lleva noelia este mes",
      "cuanto ha hecho sara",
      "facturacion de maria",
      "caja de noelia",
      "cuanto saca sara a la semana",
      "cuanto ha cobrado sara hoy",
      "noelia cuanto lleva hoy",
      "cuanto factura cada una"
    ],
    "respuesta": "Noelia lleva 2.340 € cobrados este mes y 610 € previstos hasta fin de mes.",
    "accion": null
  },
  {
    "id": "lo-que-mas-hace",
    "categoria": "equipo",
    "responde": "los servicios que más hace una profesional.",
    "ejemplos": [
      "q hace mas sara",
      "servicios de noelia",
      "en q es mas fuerte maria",
      "q le piden a sara",
      "especialidad de noelia",
      "q servicios hace maria",
      "top servicios de sara",
      "q mas hace noelia"
    ],
    "respuesta": "A Sara lo que más le piden es Tinte (130 veces en 30 días), luego Corte y Mechas.",
    "accion": null
  },
  {
    "id": "profesional-habitual",
    "categoria": "equipo",
    "responde": "con quién va una clienta.",
    "ejemplos": [
      "con quien va marta",
      "quien atiende a elena",
      "de quien es clienta lucia",
      "marta va con sara?",
      "quien le hace el tinte a marta",
      "marta siempre con noelia?",
      "con quien viene paula",
      "quien lleva a lucia"
    ],
    "respuesta": "Elena va casi siempre con Noelia.",
    "accion": null
  },
  {
    "id": "precio-servicio",
    "categoria": "servicios",
    "responde": "el precio de un servicio de la carta.",
    "ejemplos": [
      "precio del tinte",
      "cuanto cuesta un corte",
      "a cuanto tengo las mechas",
      "precio novia",
      "q cobro x un recogido",
      "cuanto vale el tinte",
      "precio de las mechas",
      "a cuanto esta el tratamiento"
    ],
    "respuesta": "El Tinte está a 35 € (40 min).",
    "accion": "Ver Servicios"
  },
  {
    "id": "duracion-servicio",
    "categoria": "servicios",
    "responde": "cuánto dura un servicio según la carta y según lo real.",
    "ejemplos": [
      "cuanto dura un tinte",
      "duracion de las mechas",
      "cuanto tardo con un recogido",
      "cuanto le duro a marta el tinte",
      "cuanto tarda un corte",
      "tiempo del tinte",
      "cuanto dura un peinado de novia",
      "duracion de un recogido"
    ],
    "respuesta": "Según la carta, unas Mechas duran 2 h. A Marta la última vez le llevaron 2 h 15.",
    "accion": null
  },
  {
    "id": "servicio-mas-pedido",
    "categoria": "servicios",
    "responde": "el servicio más pedido de un periodo.",
    "ejemplos": [
      "q es lo mas pedido",
      "servicio estrella",
      "que piden mas",
      "top servicios",
      "q hago mas",
      "q es lo q mas hacemos",
      "servicio mas vendido",
      "q me piden mas este mes"
    ],
    "respuesta": "Lo más pedido este mes es el Tinte (197 veces), luego Corte y peinado (130).",
    "accion": null
  },
  {
    "id": "servicio-mas-rentable",
    "categoria": "servicios",
    "responde": "el servicio que más deja por hora de trabajo.",
    "ejemplos": [
      "q servicio es mas rentable",
      "cual me deja mas",
      "rentable por hora",
      "en q gano mas",
      "q me conviene hacer",
      "q servicio me da mas dinero",
      "cual es el mas rentable",
      "q deja mas por hora"
    ],
    "respuesta": "El que más deja por hora es el Peinado de novia: 60 €/h. El Tinte, 53 €/h.",
    "accion": null
  },
  {
    "id": "carta",
    "categoria": "servicios",
    "responde": "qué servicios hay en la carta y cuáles se pueden reservar.",
    "ejemplos": [
      "q servicios tengo",
      "mi carta",
      "lista de precios",
      "q ofrezco",
      "servicios activos",
      "q servicios hay",
      "servicios y precios",
      "ver la carta"
    ],
    "respuesta": "Tienes 6 servicios: Corte y peinado 25 €, Tinte 35 €, Mechas 80 €, Peinado de novia 90 €, Recogido 45 € y Tratamiento 20 €.",
    "accion": "Ver Servicios"
  },
  {
    "id": "veces-servicio",
    "categoria": "servicios",
    "responde": "cuántas veces se ha hecho un servicio y lo que ha dejado.",
    "ejemplos": [
      "cuantos tintes este mes",
      "cuantas mechas he hecho",
      "novias este año",
      "cuantos cortes la semana pasada",
      "cuantos cortes llevo",
      "numero de tintes",
      "cuantos recogidos este mes",
      "tratamientos hechos"
    ],
    "respuesta": "Este mes llevas 197 tintes, que han dejado 6.895 € según tarifa.",
    "accion": null
  },
  {
    "id": "cobrado-periodo",
    "categoria": "dinero",
    "responde": "lo cobrado en un periodo (histórico).",
    "ejemplos": [
      "cuanto he cobrado este mes",
      "caja de la semana",
      "facturado el mes pasado",
      "cuanto hice ayer",
      "cobrado en septiembre",
      "cuanto llevo este año"
    ],
    "respuesta": "Del 1 al 20 de septiembre cobraste 9.725 € en 241 citas (10 no vinieron).",
    "accion": "Ver Analítica"
  },
  {
    "id": "previsto-periodo",
    "categoria": "dinero",
    "responde": "lo previsto en un periodo futuro (confirmadas sin cobrar).",
    "ejemplos": [
      "cuanto voy a sacar la semana q viene",
      "previsto de octubre",
      "q tengo reservado en euros",
      "cuanto hay confirmado",
      "dinero de la semana siguiente",
      "cuanto tengo previsto",
      "dinero previsto este mes",
      "q voy a ingresar"
    ],
    "respuesta": "La semana que viene tienes 4.675 € previstos en 113 citas confirmadas.",
    "accion": null
  },
  {
    "id": "estimacion-mes",
    "categoria": "dinero",
    "responde": "cómo terminará el mes: lo cobrado más lo previsto.",
    "ejemplos": [
      "cuanto voy a facturar este mes",
      "como acabo el mes",
      "estimacion del mes",
      "llegare a 10000",
      "cierre de mes",
      "como voy a acabar el mes",
      "prevision del mes",
      "cuanto hare en total este mes"
    ],
    "respuesta": "Este mes llevas 9.725 € cobrados y 1.940 € previstos: unos 11.665 € si todo sigue así. Es una estimación con las citas confirmadas.",
    "accion": null
  },
  {
    "id": "cobro-por-metodo",
    "categoria": "dinero",
    "responde": "cuánto se cobró por Bizum, efectivo y tarjeta.",
    "ejemplos": [
      "cuanto en bizum hoy",
      "efectivo de hoy",
      "cuanto por tarjeta",
      "cierre de caja",
      "cuanto hay en la caja",
      "cuanto bizum esta semana",
      "pagos con tarjeta",
      "cobros en efectivo del mes"
    ],
    "respuesta": "Hoy: tarjeta 205 €, efectivo 100 € y Bizum 30 €.",
    "accion": null
  },
  {
    "id": "comparar-periodos",
    "categoria": "dinero",
    "responde": "cómo va un periodo frente al anterior (citas, dinero, ocupación).",
    "ejemplos": [
      "como va este mes comparado",
      "mejor q el mes pasado?",
      "voy mejor o peor",
      "comparado con la semana pasada",
      "crecemos?",
      "vamos mejor que el año pasado",
      "comparar con septiembre",
      "sube o baja"
    ],
    "respuesta": "Este mes llevas un 11 % más de citas y una ocupación del 69 % (el mes pasado, 62 %). ¡Buen mes!",
    "accion": null
  },
  {
    "id": "precio-medio",
    "categoria": "dinero",
    "responde": "el importe medio por cita de un periodo.",
    "ejemplos": [
      "ticket medio",
      "cuanto deja cada cita",
      "gasto medio",
      "media por clienta",
      "precio medio",
      "cuanto gasta de media una clienta",
      "media por cita",
      "importe medio"
    ],
    "respuesta": "Cada cita deja 40 € de media este mes.",
    "accion": null
  },
  {
    "id": "dinero-servicio",
    "categoria": "dinero",
    "responde": "lo que ha dejado un servicio según tarifa.",
    "ejemplos": [
      "cuanto me dejan los tintes",
      "dinero de mechas este mes",
      "cuanto saco con las novias",
      "lo q deja el corte",
      "ingresos del tinte",
      "cuanto dejan los cortes",
      "dinero por servicio",
      "q servicio me da mas este mes"
    ],
    "respuesta": "Las Mechas han dejado 2.560 € este mes (32 veces), según tarifa.",
    "accion": null
  },
  {
    "id": "resumen-mes",
    "categoria": "dinero",
    "responde": "el resumen del mes en tres cifras y el Excel.",
    "ejemplos": [
      "resumen del mes",
      "como ha ido septiembre",
      "informe del mes",
      "dame el excel del mes",
      "numeros del mes",
      "numeros de agosto",
      "balance del mes",
      "como fue el mes pasado"
    ],
    "respuesta": "Septiembre: 9.725 € cobrados, 262 citas y un 69 % de ocupación.",
    "accion": "Descargar Excel"
  },
  {
    "id": "senales-pendientes",
    "categoria": "senal",
    "responde": "las señales pedidas que aún no han llegado.",
    "ejemplos": [
      "señales pendientes",
      "quien me tiene q pagar la señal",
      "bizums pendientes",
      "fianzas sin pagar",
      "q señales faltan",
      "señales sin cobrar",
      "quien me debe la señal",
      "bizums por llegar"
    ],
    "respuesta": "Esperas 2 señales: Pablo (20 €, antes de las 21:32) y Lucía (20 €, antes de mañana a las 10:00).",
    "accion": null
  },
  {
    "id": "senales-vencidas",
    "categoria": "senal",
    "responde": "las señales cuyo plazo pasó sin recibirlas.",
    "ejemplos": [
      "señales vencidas",
      "se ha pasado el plazo de alguien",
      "quien no ha pagado a tiempo",
      "fianza caducada",
      "señales caducadas",
      "alguna señal vencida",
      "quien no pago la señal",
      "plazos pasados"
    ],
    "respuesta": "1 señal vencida: la de Pablo Martín (20 €). Dale más tiempo o libera el hueco.",
    "accion": "Abrir cita"
  },
  {
    "id": "senal-cita",
    "categoria": "senal",
    "responde": "el estado de la señal de la cita de una clienta.",
    "ejemplos": [
      "ha pagado la señal marta",
      "pablo ha hecho el bizum?",
      "señal de lucia",
      "tiene q pagar señal elena?",
      "pablo tiene la señal pagada",
      "esta pagada la fianza de lucia",
      "estado de la señal de marta",
      "marta ha pagado?"
    ],
    "respuesta": "La señal de Pablo está pedida: 20 € antes de las 21:32. Cuando la veas en tu banco, márcala.",
    "accion": "Abrir cita"
  },
  {
    "id": "regla-senal",
    "categoria": "senal",
    "responde": "cuánto se pide de señal, a quién y con qué plazo.",
    "ejemplos": [
      "cuanto pido de señal",
      "a quien pido señal",
      "plazo de la señal",
      "como tengo la señal",
      "politica de señal",
      "cuanto es la fianza",
      "señal de cuanto",
      "cuanto cobro de señal"
    ],
    "respuesta": "Pides 20 € en los servicios de 90 minutos o más, con 2 h de plazo. Se devuelve si cancelan con más de 24 h.",
    "accion": "Abrir Ajustes › Señal"
  },
  {
    "id": "senales-recibidas",
    "categoria": "senal",
    "responde": "las señales recibidas en un periodo y su importe.",
    "ejemplos": [
      "cuantas señales he cobrado",
      "señales de este mes",
      "dinero de señales",
      "bizums recibidos",
      "señales recibidas esta semana",
      "cuanto he cobrado en señales",
      "fianzas cobradas",
      "bizums de señal del mes"
    ],
    "respuesta": "Este mes has recibido 6 señales: 120 €.",
    "accion": null
  },
  {
    "id": "campanas",
    "categoria": "marketing",
    "responde": "qué campaña conviene hacer y a cuántas personas va.",
    "ejemplos": [
      "q campaña hago",
      "a quien escribo este mes",
      "ideas para llenar",
      "como traigo clientas",
      "marketing",
      "q hago para llenar la agenda",
      "campaña del mes",
      "a quien mando mensaje"
    ],
    "respuesta": "La que más rinde ahora: «Clientas que no vuelven",
    "accion": "Ver Marketing"
  },
  {
    "id": "recuperables",
    "categoria": "marketing",
    "responde": "cuántas clientas y huecos se pueden recuperar este mes.",
    "ejemplos": [
      "cuantas puedo recuperar",
      "cuanto puedo rellenar",
      "potencial del mes",
      "huecos q puedo llenar",
      "a cuantas puedo recuperar",
      "clientas recuperables",
      "cuanto puedo llenar este mes",
      "cuanto puedo recuperar"
    ],
    "respuesta": "Este mes puedes recuperar 119 clientas y rellenar 29 huecos.",
    "accion": "Ver Marketing"
  },
  {
    "id": "huecos-flojos",
    "categoria": "marketing",
    "responde": "la franja floja y a quién ofrecérsela.",
    "ejemplos": [
      "llenar los martes",
      "a quien ofrezco la tarde",
      "como lleno los huecos",
      "clientas para la franja floja",
      "llenar la franja floja",
      "a quien ofrezco los huecos",
      "campaña de martes",
      "rellenar la tarde"
    ],
    "respuesta": "Los martes por la tarde estáis al 2 %. Tienes 582 clientas activas para ofrecérselo.",
    "accion": "Preparar envío"
  },
  {
    "id": "segunda-visita",
    "categoria": "marketing",
    "responde": "las clientas nuevas que aún no han vuelto.",
    "ejemplos": [
      "nuevas q no han vuelto",
      "segunda visita",
      "quien vino una vez",
      "primeras q no repiten",
      "clientas de una sola vez",
      "nuevas sin segunda cita",
      "quien no ha repetido",
      "traer de vuelta a las nuevas"
    ],
    "respuesta": "36 clientas vinieron una sola vez en los últimos 60 días.",
    "accion": "Preparar mensaje"
  },
  {
    "id": "resenas",
    "categoria": "marketing",
    "responde": "a quién pedir una reseña.",
    "ejemplos": [
      "a quien pido reseña",
      "reseñas de google",
      "quien puede dejar opinion",
      "pedir reseñas",
      "reseñas",
      "pedir opinion en google",
      "quien vino esta semana para reseña",
      "mas reseñas"
    ],
    "respuesta": "65 clientas vinieron en los últimos 7 días; es buen momento para pedirles la reseña.",
    "accion": "Preparar mensaje"
  },
  {
    "id": "horario-salon",
    "categoria": "configuracion",
    "responde": "el horario de apertura de la semana.",
    "ejemplos": [
      "horario del salon",
      "cuando abrimos",
      "horario de la semana",
      "abrimos domingos?",
      "a q hora abrimos",
      "horario de apertura",
      "abrimos el sabado?",
      "horario de peluchic"
    ],
    "respuesta": "PeluChic abre Mar–Vie 10:00–20:00 · Sáb 9:00–14:00; lunes y domingo, cerrado.",
    "accion": "Cambiar en Mi página"
  },
  {
    "id": "enlace-reservas",
    "categoria": "configuracion",
    "responde": "el enlace de la página de reservas para compartirlo.",
    "ejemplos": [
      "mi enlace",
      "link de reservas",
      "donde reservan",
      "pasame el enlace de la web",
      "como comparto la web",
      "url de reservas",
      "donde esta mi pagina",
      "enlace para instagram"
    ],
    "respuesta": "Tu página es siShow…/s/peluchic.",
    "accion": "Copiar enlace"
  },
  {
    "id": "politica-cancelacion",
    "categoria": "configuracion",
    "responde": "lo que dice la web sobre cancelar.",
    "ejemplos": [
      "politica de cancelacion",
      "q pasa si cancelan",
      "hasta cuando pueden cancelar",
      "cancelacion gratis?",
      "cancelar sin coste",
      "cuanto antes pueden cancelar",
      "q dice mi web de cancelar",
      "condiciones de cancelacion"
    ],
    "respuesta": "Tu web dice: cancelar hasta 24 h antes no tiene coste; si no vienen o cancelan más tarde, pierden la señal.",
    "accion": "Cambiar en Mi página › Preguntas frecuentes"
  },
  {
    "id": "preguntas-reserva",
    "categoria": "configuracion",
    "responde": "qué se pregunta a la clienta al reservar.",
    "ejemplos": [
      "q pregunto al reservar",
      "preguntas del formulario",
      "q le pido a la clienta",
      "preguntas de novias",
      "preguntas de la reserva",
      "q se pregunta al reservar",
      "cambiar las preguntas",
      "q piden al reservar"
    ],
    "respuesta": "Al reservar preguntas 3 cosas: largo de pelo, color actual y tratamientos del último mes.",
    "accion": "Editar en Ajustes"
  },
  {
    "id": "plantones-config",
    "categoria": "configuracion",
    "responde": "si hay penalización por no venir y cuánto.",
    "ejemplos": [
      "cobro algo si no vienen",
      "penalizacion",
      "tengo recargo",
      "plantones configurados",
      "cobro por no venir",
      "tengo penalizacion activada",
      "cuanto cobro si no vienen",
      "recargo por plantón"
    ],
    "respuesta": "No cobras penalización: solo la señal si no vienen.",
    "accion": "Ajustes › Plantones y señal"
  },
  {
    "id": "mensajes-whatsapp",
    "categoria": "configuracion",
    "responde": "cómo son los mensajes de confirmación y de recordatorio.",
    "ejemplos": [
      "q dice el recordatorio",
      "mensaje de confirmacion",
      "como es el whatsapp q mando",
      "cambiar el mensaje",
      "texto del recordatorio",
      "como es el mensaje de confirmacion",
      "mensaje q mando por whatsapp",
      "personalizar mensajes"
    ],
    "respuesta": "El recordatorio dice: «Hola Lucía, te recordamos tu cita en PeluChic mañana a las 10:30…",
    "accion": "Cambiarlo en Ajustes › Mensajes"
  },
  {
    "id": "duracion-flexible",
    "categoria": "configuracion",
    "responde": "si la duración se decide al aceptar cada solicitud.",
    "ejemplos": [
      "decido yo la duracion?",
      "duracion al aceptar",
      "por q no sale la duracion",
      "la duracion la pongo yo",
      "quien decide cuanto dura",
      "duracion orientativa",
      "por q la web no pone la duracion exacta",
      "fijar duracion"
    ],
    "respuesta": "Sí: la web enseña una duración orientativa y la fijas tú al confirmar.",
    "accion": "Ajustes › Tu agenda"
  },
  {
    "id": "calendario-suscrito",
    "categoria": "configuracion",
    "responde": "si las citas están en Google Calendar o en el iPhone y cómo activarlo.",
    "ejemplos": [
      "sale en google calendar",
      "citas en el iphone",
      "calendario del movil",
      "sincronizar calendario",
      "citas en mi calendario",
      "ver citas en google",
      "enlace del calendario",
      "calendario del iphone"
    ],
    "respuesta": "Puedes ver las citas en tu Google Calendar o en el iPhone con un enlace privado; se actualiza cada pocas horas.",
    "accion": "Ajustes › Tu agenda"
  },
  {
    "id": "equipo-y-colores",
    "categoria": "configuracion",
    "responde": "el color de cada servicio y profesional en el calendario.",
    "ejemplos": [
      "de q color sale el tinte",
      "colores del calendario",
      "cambiar color de sara",
      "color de noelia",
      "colores de los servicios",
      "por q el tinte sale morado",
      "cambiar colores",
      "color de cada servicio"
    ],
    "respuesta": "El Tinte sale en lavanda y Sara en salvia.",
    "accion": "Cambiarlos en Ajustes › Colores"
  },
  {
    "id": "que-puedo-preguntar",
    "categoria": "ayuda",
    "responde": "las categorías y 3 ejemplos de cada una.",
    "ejemplos": [
      "q te puedo preguntar",
      "ejemplos",
      "ayuda",
      "como funcionas",
      "q sabes",
      "preguntas de dinero"
    ],
    "respuesta": "Pregúntame por hoy, la agenda, tus clientas, el equipo, los servicios, el dinero o la señal. Por ejemplo: «huecos el sábado",
    "accion": "Ver todas en Ajustes"
  },
  {
    "id": "como-preguntar",
    "categoria": "ayuda",
    "responde": "consejos para preguntar mejor.",
    "ejemplos": [
      "como te pregunto",
      "no me entiendes",
      "escribo mal",
      "tengo q escribir exacto?",
      "como tengo q preguntar",
      "que escribo",
      "te pregunto normal?",
      "no me sale nada"
    ],
    "respuesta": "Escribe como hablas: «cuántas mañana",
    "accion": null
  }
];

export const CHARLA: { id: string; ejemplos: string[]; respuesta: string }[] = [
  {
    "id": "saludo",
    "ejemplos": [
      "hola",
      "buenas",
      "buenos dias",
      "ey",
      "hola que tal"
    ],
    "respuesta": "¡Hola, María! 👋 Hoy tienes 18 citas y 3 solicitudes esperando. ¿Por dónde empezamos?"
  },
  {
    "id": "gracias",
    "ejemplos": [
      "gracias",
      "genial",
      "perfecto",
      "muchas gracias",
      "ok gracias"
    ],
    "respuesta": "¡A ti! Aquí estoy para lo que necesites."
  },
  {
    "id": "quien-eres",
    "ejemplos": [
      "quien eres",
      "q eres",
      "eres una ia",
      "eres chatgpt"
    ],
    "respuesta": "Soy el asistente de siShow para PeluChic. No soy una inteligencia artificial: respondo con los datos de tu salón y nunca me invento nada."
  },
  {
    "id": "que-sabes-hacer",
    "ejemplos": [
      "q sabes hacer",
      "para q sirves",
      "q haces"
    ],
    "respuesta": "Te digo cómo va el día, quién viene, tus huecos, lo que hizo cada clienta, lo que llevas cobrado y cómo va la señal. [Ver ejemplos]"
  },
  {
    "id": "despedida",
    "ejemplos": [
      "adios",
      "hasta luego",
      "chao",
      "me voy"
    ],
    "respuesta": "¡Hasta luego! Que vaya bien el día en PeluChic."
  },
  {
    "id": "buen-trabajo",
    "ejemplos": [
      "eres un crack",
      "que bien",
      "me encanta"
    ],
    "respuesta": "¡Gracias! El mérito es de tu agenda, que está muy bien llevada."
  },
  {
    "id": "como-estas",
    "ejemplos": [
      "como estas",
      "q tal"
    ],
    "respuesta": "Muy bien, con los datos al día. ¿Te cuento cómo va hoy?"
  },
  {
    "id": "no-entiendo",
    "ejemplos": [
      "no entiendo",
      "q",
      "?",
      "eh"
    ],
    "respuesta": "Perdona, no me he explicado. Prueba con algo como «cuántas citas mañana» o «color de Elena»."
  },
  {
    "id": "ayuda-humana",
    "ejemplos": [
      "quiero hablar con alguien",
      "persona",
      "soporte"
    ],
    "respuesta": "Te pongo con el equipo de siShow: escríbenos a ejemplo@sishow.com y te contestamos lo antes posible."
  },
  {
    "id": "broma",
    "ejemplos": [
      "cuentame un chiste",
      "aburrida",
      "jaja"
    ],
    "respuesta": "Lo mío son los números: hoy te quedan 3 huecos por llenar. ¿Lo miramos?"
  }
];
