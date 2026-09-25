/**
 * Catálogo de la especificación de FRONTEND (preguntas-universo.md, lote 10
 * fase 1, 25/09/2026), tal cual: ids, categorías, formulaciones de María y
 * respuestas modelo. GENERADO a partir de ese documento: no se edita a mano.
 * Las reglas que el documento no trae (entidades obligatorias, plan mínimo,
 * ejemplos extra) están en intenciones.ts.
 */
export interface FamiliaEspecificacion {
  id: string;
  categoria: string;
  grupo: "negocio" | "charla" | "plan" | "tecnica";
  responde?: string;
  dato?: string;
  entidades?: string;
  ejemplos: string[];
  modelo?: string;
  /** Solo en «plan»: el plan que lo incluye, la alternativa de hoy y el mensaje tipo. */
  plan?: string;
  alternativa?: string;
  mensaje?: string;
  /** Solo en «tecnica»: la solución que se propone y el apartado de la guía. */
  solucion?: string;
  guia?: string;
}

export const ESPECIFICACION: FamiliaEspecificacion[] = [
  {
    "id": "citas-hoy",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "cuántas citas hay hoy y cómo se reparten entre el equipo.",
    "dato": "`agendaDeHoy(citasDelDia(appointments, ahora), equipo, ahora)`, campos `total` y `porPro`.",
    "entidades": "ninguna.",
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
    "modelo": "«Hoy tienes **18 citas**: 5 de María, 6 de Sara y 7 de Noelia. [Ver calendario]»"
  },
  {
    "id": "citas-hoy-profesional",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "cuántas citas tiene hoy una profesional y la próxima.",
    "dato": "`agendaDeHoy(...).porPro` más `citasDelDia` filtrado por `employeeId`.",
    "entidades": "profesional.",
    "ejemplos": [
      "cuantas tiene sara hoy",
      "q tiene noelia hoy",
      "citas de maria hoy",
      "agenda de sara",
      "noelia hoy",
      "cuantas le quedan a sara",
      "sara esta llena?"
    ],
    "modelo": "«Sara tiene **6 citas** hoy; la siguiente es Daniela a las 14:25. [Ver calendario]»"
  },
  {
    "id": "proxima-cita",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "quién está ahora y quién viene después.",
    "dato": "`citasDelDia`, `enCurso(a, ahora)`, `terminada`, `faltaPara(a, ahora)`.",
    "entidades": "profesional (opcional).",
    "ejemplos": [
      "quien viene ahora",
      "siguiente cita",
      "kien es la proxima",
      "quien esta ahora con maria",
      "a q hora es la siguiente",
      "q viene despues",
      "proxima clienta"
    ],
    "modelo": "«Ahora está **Adriana García** con Noelia; la siguiente es Marisol a las 17:00, dentro de 20 min. [Abrir cita]»"
  },
  {
    "id": "lista-citas-hoy",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "la lista de lo que queda hoy, por hora.",
    "dato": "`citasDelDia` sin las `terminada`, con `serviceLabelOf(a, selectServiceMap(services))`.",
    "entidades": "profesional (opcional); «por la tarde» o «por la mañana».",
    "ejemplos": [
      "q citas me quedan",
      "que queda hoy",
      "lista de hoy",
      "quien viene esta tarde",
      "citas de la tarde",
      "resto del dia",
      "que tengo por la mañana"
    ],
    "modelo": "«Te quedan **3**: 17:00 Marisol (Mechas), 18:30 Pablo (Corte) y 19:00 Silvia (Tinte). [Ver hoja del día]»"
  },
  {
    "id": "huecos-hoy",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "cuántos huecos libres de 30 min o más quedan hoy, cuánto tiempo suman y de quién.",
    "dato": "`agendaDeHoy(...)`: `huecos`, `minutosLibres`, `detalleHuecos`.",
    "entidades": "profesional (opcional).",
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
    "modelo": "«Quedan **3 huecos** (3 h 30 en total): Sara a las 18:45, Noelia a las 18:45 y María a las 19:00. [Nueva cita]»"
  },
  {
    "id": "ocupacion-hoy",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "el % de la jornada del equipo que ya está reservado hoy.",
    "dato": "`agendaDeHoy(...).ocupacionPct`.",
    "entidades": "ninguna.",
    "ejemplos": [
      "como de llena esta la agenda hoy",
      "ocupacion hoy",
      "% hoy",
      "estamos llenos hoy",
      "cuanto tenemos ocupado",
      "nivel de agenda hoy"
    ],
    "modelo": "«La agenda de hoy está al **53 %**. Aún caben 3 citas.»"
  },
  {
    "id": "ingresos-hoy",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "lo que vale el día, lo cobrado y lo que queda por cobrar.",
    "dato": "suma de `priceEur` de `citasDelDia` con `esCobrable`, y `dineroDelRango(appointments, hoy, ahora).cobrado`.",
    "entidades": "ninguna.",
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
    "modelo": "«Hoy llevas **335 € cobrados** de 675 €; quedan 340 € por cobrar.»"
  },
  {
    "id": "pendiente-de-ti",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "lo que te espera: solicitudes, citas por marcar y señales vencidas.",
    "dato": "`appointments` con `status: \"pending\"`, `citasSinDesenlace(appointments)` y `estadoSenal(...) === \"vencida\"` (maqueta).",
    "entidades": "ninguna.",
    "ejemplos": [
      "q tengo pendiente",
      "que me falta por hacer",
      "pendientes",
      "q tengo q hacer hoy",
      "algo pendiente?",
      "que esta sin resolver",
      "tareas de hoy"
    ],
    "modelo": "«Tienes **9 cosas**: 3 solicitudes por confirmar y 6 citas por marcar. Empieza por las solicitudes. [Ver Hoy]»"
  },
  {
    "id": "solicitudes-pendientes",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "las reservas de la web que esperan confirmación.",
    "dato": "`appointments.filter(a => a.status === \"pending\")`, ordenadas por `start`.",
    "entidades": "ninguna.",
    "ejemplos": [
      "solicitudes",
      "cuantas solicitudes tengo",
      "reservas sin confirmar",
      "q me han pedido",
      "nuevas reservas",
      "alguien ha reservado",
      "peticiones"
    ],
    "modelo": "«Tienes **3 solicitudes**: Cristina (hoy 10:00), Elena (hoy 10:00) y Marisol (hoy 17:00). [Confirmar la primera]»"
  },
  {
    "id": "por-marcar",
    "categoria": "hoy",
    "grupo": "negocio",
    "responde": "las citas pasadas en las que no se ha dicho si vino.",
    "dato": "`citasSinDesenlace(appointments)`.",
    "entidades": "periodo (opcional).",
    "ejemplos": [
      "quien no he marcado",
      "citas sin marcar",
      "vinieron todas?",
      "cuantas por marcar",
      "q me falta marcar",
      "no he dicho si vino"
    ],
    "modelo": "«Te faltan **6 por marcar**, la más antigua de hoy a las 14:05 (Silvia). [Marcar ahora]»"
  },
  {
    "id": "abierto-ahora",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "si el salón está abierto y hasta qué hora.",
    "dato": "`isOpenNow(salonProfile.openingHours)` y `todayOpenInfo(...)`.",
    "entidades": "día (opcional).",
    "ejemplos": [
      "estamos abiertos",
      "a q hora cerramos hoy",
      "hasta q hora abrimos",
      "abrimos el lunes?",
      "horario de hoy",
      "cierro a las 8?"
    ],
    "modelo": "«Sí, hoy abrís hasta las **20:00**.» · «Los lunes PeluChic está cerrado.»"
  },
  {
    "id": "colores-hoy",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "quién viene hoy con color y qué fórmula lleva, o si le falta.",
    "dato": "`hojaDelDia(appointments, fechaLocal(hoy))` con `fichaDeClienta(id, ...).resumen.ultimoColor`.",
    "entidades": "ninguna.",
    "ejemplos": [
      "q colores hay hoy",
      "quien viene a tinte hoy",
      "formulas de hoy",
      "tintes de hoy",
      "color de las de hoy",
      "q hay q preparar hoy"
    ],
    "modelo": "«Hoy hay **4 de color**. A Paula Vega le pusiste 5.0 en raíz, oxidante 20 vol. A Daniela Díaz le falta el color anotado. [Ver hoja del día]»"
  },
  {
    "id": "citas-dia",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "las citas de un día concreto.",
    "dato": "`citasDeCalendario(appointments, dia)`.",
    "entidades": "fecha (relativa o absoluta); profesional (opcional).",
    "ejemplos": [
      "citas el sabado",
      "q tengo el martes",
      "cuantas citas el 3",
      "agenda del jueves",
      "quien viene el 3 de octubre",
      "citas pasado mañana",
      "sabado como va"
    ],
    "modelo": "«El sábado 26 tienes **16 citas**, de 9:00 a 14:00. [Ver ese día]»"
  },
  {
    "id": "citas-manana",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "las citas de mañana, por hora.",
    "dato": "`hojaDelDia(appointments, fechaLocal(mañana))`.",
    "entidades": "profesional (opcional).",
    "ejemplos": [
      "kien viene mñn",
      "citas mañana",
      "q tengo mañana",
      "mañana cuantas",
      "agenda de mañana",
      "quien viene mañana por la mañana",
      "primera de mañana"
    ],
    "modelo": "«Mañana tienes **16 citas**; la primera es Pablo a las 9:00 con Sara. [Ver hoja de mañana]»"
  },
  {
    "id": "huecos-dia",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "los huecos libres de un día, por profesional.",
    "dato": "`huecosDeProfesionales(...)` o `huecosDe(citasDeCalendario(appointments, dia), e, dia.getDay())`.",
    "entidades": "fecha; profesional (opcional); duración mínima (número).",
    "ejemplos": [
      "huecos sabado",
      "hay hueco el martes",
      "sitio el jueves por la tarde",
      "huecos de noelia el viernes",
      "hueco de 2 horas el sabado",
      "tengo algo libre el 3"
    ],
    "modelo": "«El sábado hay **2 huecos**: María de 12:00 a 13:00 y Noelia de 13:15 a 14:00. [Nueva cita]»"
  },
  {
    "id": "primer-hueco-servicio",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "el primer hueco donde cabe un servicio.",
    "dato": "`primeraLibre(...)` de `nueva-cita.ts`, o `findNextAvailableSlot(...)` de `reparto.ts`, con la duración del servicio.",
    "entidades": "servicio; profesional (opcional); desde qué fecha.",
    "ejemplos": [
      "cuando puedo meter unas mechas",
      "primer hueco para tinte",
      "cuando hay sitio para un recogido",
      "proximo hueco de 2h",
      "cuando cabe un corte con sara",
      "hueco para novia"
    ],
    "modelo": "«Unas mechas (2 h) caben **el martes 29 a las 16:00** con Sara. [Dar la cita]»"
  },
  {
    "id": "hueco-profesional",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "cuándo tiene hueco una profesional.",
    "dato": "`huecosDe` por días, o `findNextAvailableSlot` filtrado por `employeeId`.",
    "entidades": "profesional; periodo.",
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
    "modelo": "«Sara tiene el primer hueco **mañana a las 12:30** (1 h 15). Esta semana le quedan 5 huecos. [Ver calendario de Sara]»"
  },
  {
    "id": "citas-periodo",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "cuántas citas hay en un periodo y cómo se compara con el anterior.",
    "dato": "`resumenDePeriodo(appointments, periodo, equipo, ahora, rango)` → `actual.citas`, `previo.citas`, `comparar`.",
    "entidades": "periodo.",
    "ejemplos": [
      "cuantas citas esta semana",
      "citas del mes",
      "cuantas citas el mes pasado",
      "como va la semana",
      "citas este año",
      "semana q viene cuantas"
    ],
    "modelo": "«Esta semana llevas **87 citas**, un 11 % más que la pasada. [Ver Analítica]»"
  },
  {
    "id": "ocupacion-periodo",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "la ocupación media del equipo en un periodo.",
    "dato": "`resumenDePeriodo(...).actual.ocupacion` y `ocupacionPorProfesional(appointments, rango, equipo)`.",
    "entidades": "periodo; profesional (opcional).",
    "ejemplos": [
      "ocupacion de la semana",
      "como de llenos estamos este mes",
      "% de ocupacion",
      "estamos llenas?",
      "ocupacion de noelia",
      "quien tiene mas trabajo"
    ],
    "modelo": "«Este mes estáis al **69 %**: Noelia 74 %, Sara 70 %, María 62 %.»"
  },
  {
    "id": "proxima-cita-clienta",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "cuándo viene una clienta.",
    "dato": "`fichaDeClienta(id, ...).resumen.proximaCita`.",
    "entidades": "clienta.",
    "ejemplos": [
      "cuando viene marta",
      "marta tiene cita?",
      "q dia viene lucia gomez",
      "proxima cita de elena",
      "cuando le toca a paula",
      "viene esta semana cristina?"
    ],
    "modelo": "«Marta Ruiz viene el **jueves 2 a las 13:50** a Mechas / balayage con María. [Abrir ficha]» · «Marta no tiene ninguna cita apuntada. [Dar cita]»"
  },
  {
    "id": "recordatorios-manana",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "a quién hay que mandar recordatorio para mañana.",
    "dato": "`recordatoriosPendientesManana(appointments, ahora)` (cita sin `reminderSentAt`).",
    "entidades": "ninguna.",
    "ejemplos": [
      "a quien recuerdo",
      "recordatorios",
      "q recordatorios faltan",
      "he recordado a todas?",
      "mensajes de mañana",
      "avisar a las de mañana"
    ],
    "modelo": "«Te faltan **16 recordatorios** para mañana. Se mandan uno a uno desde tu WhatsApp. [Ver hoja de mañana]»"
  },
  {
    "id": "lista-espera",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "quién está en la lista de espera y para qué.",
    "dato": "`waitlist` de la store (campos `clientName`, `serviceId`, `preferredEmployeeId`, `preferredRange`).",
    "entidades": "servicio o profesional (opcional).",
    "ejemplos": [
      "quien esta en espera",
      "lista de espera",
      "alguien esperando hueco",
      "quien quiere tinte en espera",
      "espera de sara",
      "cuantas en espera"
    ],
    "modelo": "«Hay **4 en lista de espera**; para Tinte está Lucía Sanz (martes por la tarde). [Ver lista de espera]»"
  },
  {
    "id": "franja-floja",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "la franja con menos citas de las últimas semanas.",
    "dato": "`franjaMasFloja(appointments, ...)` de `derive.ts`.",
    "entidades": "ninguna.",
    "ejemplos": [
      "cual es mi franja mas floja",
      "cuando tengo menos gente",
      "hora mas vacia",
      "q dia flojea",
      "peor hora de la semana",
      "cuando no viene nadie"
    ],
    "modelo": "«Tu franja más floja es **el martes por la tarde** (2 % de ocupación). Puedes llenarla con la campaña «Llena los martes». [Ver Marketing]»"
  },
  {
    "id": "dia-mas-lleno",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "el día o la hora con más citas de un periodo.",
    "dato": "`barrasDelPeriodo(appointments, periodo, rango, equipo, ahora)`, la barra más alta.",
    "entidades": "periodo.",
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
    "modelo": "«El día con más citas esta semana es **el viernes 25** (21 citas).»"
  },
  {
    "id": "cancelaciones",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "cuántas citas se han cancelado en un periodo.",
    "dato": "`resumenDePeriodo(...).actual.cancelaciones` y `cancellationsThisWeek(appointments)`.",
    "entidades": "periodo.",
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
    "modelo": "«Esta semana, **0 cancelaciones**. ¡Bien!» · «Este mes, 7 (un 3 % de las citas).»"
  },
  {
    "id": "plantones",
    "categoria": "agenda",
    "grupo": "negocio",
    "responde": "cuántas clientas no vinieron o llegaron tarde, y quién repite.",
    "dato": "`noShowSummary(appointments, ...)` y `countNoShows` de `plantones.ts`.",
    "entidades": "periodo; clienta (opcional).",
    "ejemplos": [
      "cuantas no vinieron",
      "plantones del mes",
      "quien me ha dejado plantada",
      "no shows",
      "marta ha faltado alguna vez",
      "quien falla mas"
    ],
    "modelo": "«Este mes, **10 no vinieron**. Quien más falla es Mateo Mendoza (2 veces en 3 meses). [Abrir ficha]»"
  },
  {
    "id": "ultima-visita-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "qué se hizo una clienta la última vez, cuándo y con quién.",
    "dato": "`fichaDeClienta(id, { citas, clientes, servicios, equipo, ahora }).visitas[0]`.",
    "entidades": "clienta.",
    "ejemplos": [
      "q se hizo marta la ultima vez",
      "ultima vez de lucia",
      "que le hice a elena",
      "marta la ultima vez",
      "q se hizo paula",
      "ultima cita de cristina",
      "historial de marta"
    ],
    "modelo": "«Marta Ruiz vino el **14 de julio**: Mechas / balayage con Noelia, 80 €. [Abrir ficha]»"
  },
  {
    "id": "ultimo-color-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "la última fórmula de color anotada.",
    "dato": "`fichaDeClienta(...).resumen.ultimoColor` (`formula`, `fecha`).",
    "entidades": "clienta.",
    "ejemplos": [
      "q color lleva marisol",
      "formula de elena",
      "q tinte le puse a paula",
      "color de lucia",
      "q le di de color a marta",
      "numero de tinte de cristina"
    ],
    "modelo": "«A Elena Martín le pusiste **decoloración con oxidante 20 vol, 35 min; matiz 9.1** (14 de julio). [Abrir ficha]» · «Paula no tiene ningún color anotado. [Añadir color de TPV 123]»"
  },
  {
    "id": "frecuencia-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "cada cuánto viene una clienta.",
    "dato": "`fichaDeClienta(...).resumen.frecuenciaMediaDias`.",
    "entidades": "clienta.",
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
    "modelo": "«Elena viene **cada 11 semanas** de media; ya lleva 10 sin venir. [Dar cita]»"
  },
  {
    "id": "gasto-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "lo que ha gastado una clienta según sus citas (orientativo).",
    "dato": "`fichaDeClienta(...).resumen.gastoTotal` y `gastoUltimos12Meses`.",
    "entidades": "clienta; periodo (opcional).",
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
    "modelo": "«Elena lleva **480 €** en 6 visitas (320 € en los últimos 12 meses). Es orientativo, según tus precios.»"
  },
  {
    "id": "datos-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "teléfono, correo y cumpleaños de una clienta.",
    "dato": "`clients` (`phone`, `email`, `birthday`).",
    "entidades": "clienta.",
    "ejemplos": [
      "telefono de marta",
      "tlf de elena",
      "movil de lucia",
      "correo de paula",
      "cual es el numero de cristina",
      "cuando es el cumple de marta"
    ],
    "modelo": "«Marta Ruiz: **+34 612 112 669**. [WhatsApp] [Llamar]»"
  },
  {
    "id": "notas-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "las observaciones y avisos de la ficha.",
    "dato": "`fichaDeClienta(...).avisos` y `clients[].notes`.",
    "entidades": "clienta.",
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
    "modelo": "«De Elena tienes apuntado: «Usa el número 8. Le vendimos el champú de árbol de té, preguntar qué tal». [Abrir ficha]»"
  },
  {
    "id": "clientas-total",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "cuántas clientas hay en la cartera.",
    "dato": "`clients.length`.",
    "entidades": "ninguna.",
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
    "modelo": "«Tienes **595 clientas** en tu cartera. [Ver Clientas]»"
  },
  {
    "id": "clientas-nuevas",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "cuántas clientas vinieron por primera vez en un periodo, y quiénes.",
    "dato": "`nuevasYRecurrentes(appointments, rango).nuevas` y `newClientsThisWeek(appointments)`.",
    "entidades": "periodo.",
    "ejemplos": [
      "clientas nuevas",
      "cuantas nuevas este mes",
      "nuevas esta semana",
      "gente nueva",
      "quien es nueva",
      "primeras visitas"
    ],
    "modelo": "«Este mes han venido **7 clientas nuevas**. La última fue Valentina el 23. [Ver Clientas › Nuevas]»"
  },
  {
    "id": "clientas-recurrentes",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "cuántas repiten y qué parte son.",
    "dato": "`nuevasYRecurrentes(...).recurrentes` y `patronDeRegreso(...)` de `derive.ts`.",
    "entidades": "periodo.",
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
    "modelo": "«**506 de 595** repiten (85 %). Vuelven cada 9 semanas de media.»"
  },
  {
    "id": "clientas-inactivas",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "quién lleva tiempo sin venir y cuántas son.",
    "dato": "`clientesQueNoVuelven(clients, appointments, ahora)` con `SEMANAS_INACTIVIDAD`.",
    "entidades": "número de semanas (opcional).",
    "ejemplos": [
      "quien no vuelve",
      "clientas perdidas",
      "quien hace mucho q no viene",
      "inactivas",
      "a quien escribo",
      "clientas dormidas"
    ],
    "modelo": "«**119 clientas** llevan más de 8 semanas sin venir. Tienes el mensaje preparado. [Ver campaña]»"
  },
  {
    "id": "mejores-clientas",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "las clientas que más han gastado (orientativo).",
    "dato": "`clients` ordenadas por el gasto que devuelve `fichaDeClienta`, o `totalSpent` de `clientFrequency`.",
    "entidades": "número (top N, por defecto 5); periodo (opcional).",
    "ejemplos": [
      "mejores clientas",
      "quien gasta mas",
      "top clientas",
      "mis 5 mejores",
      "clienta q mas me deja",
      "vip"
    ],
    "modelo": "«Tus 3 que más gastan: **Pablo Mendoza (670 €)**, Alejandro Ortega (567 €) y Raúl Iglesias (557 €). Es orientativo, según tus precios.»"
  },
  {
    "id": "color-pendiente",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "las clientas citadas en 14 días sin color anotado.",
    "dato": "la misma lista que el filtro «Color pendiente» de Clientas (citas próximas con `fichaDeClienta` sin `ultimoColor`).",
    "entidades": "ninguna.",
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
    "modelo": "«A **50 clientas** citadas le falta el color. Apúntalo de TPV 123 antes de que lleguen. [Ver Color pendiente]»"
  },
  {
    "id": "cumpleanos",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "quién cumple años en un periodo.",
    "dato": "`clients[].birthday` (entra con el importador de TPV 123).",
    "entidades": "periodo (por defecto, esta semana).",
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
    "modelo": "«Esta semana cumple **Lucía Gómez** (el jueves).» · «No tengo el cumpleaños de ninguna clienta: entra al traer tus clientas de TPV 123.»"
  },
  {
    "id": "clientas-con-deuda",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "quién tiene un recargo pendiente y cuánto suma.",
    "dato": "`resumenDeDeuda(clients)` y `clientesConDeuda(clients)` de `deuda.ts`.",
    "entidades": "ninguna.",
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
    "modelo": "«**2 clientas** te deben 14 €: Mateo Mendoza (7 €) y Carla Ruiz (7 €). [Ver Clientas › Me deben]» · Sin recargos activos: «No tienes recargos activos: nadie te debe nada.»"
  },
  {
    "id": "clienta-bloqueada",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "si una clienta puede reservar por internet.",
    "dato": "`isBookingBlocked(...)` de `no-show.ts` y `clients[].manualBlock`.",
    "entidades": "clienta.",
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
    "modelo": "«Marta **puede reservar** por internet.» · «Mateo está bloqueado a mano. [Abrir ficha]»"
  },
  {
    "id": "buscar-clienta",
    "categoria": "clientas",
    "grupo": "negocio",
    "responde": "la ficha de una clienta por nombre, apellido o teléfono.",
    "dato": "`buscarClientas(texto, { clientes, citas })`.",
    "entidades": "clienta o teléfono.",
    "ejemplos": [
      "busca a marta",
      "ficha de lucia",
      "abre a elena martin",
      "quien es el 612112669",
      "clienta ruiz",
      "tengo a una tal valentina?"
    ],
    "modelo": "«Es **Marta Ruiz**: 7 visitas, la última el 23 de septiembre. [Abrir ficha]»"
  },
  {
    "id": "horario-profesional",
    "categoria": "equipo",
    "grupo": "negocio",
    "responde": "el horario semanal de una profesional.",
    "dato": "`resumenHorario(teamHours[i] ?? openingHours)` de `horario-resumen.ts`.",
    "entidades": "profesional.",
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
    "modelo": "«Noelia trabaja **Mar–Vie 10:00–20:00 · Sáb 9:00–14:00**. [Ver Equipo]»"
  },
  {
    "id": "quien-trabaja",
    "categoria": "equipo",
    "grupo": "negocio",
    "responde": "quién trabaja un día concreto.",
    "dato": "`trabajaEn(e, dia)` o `franjasProfesional(e, weekday)`.",
    "entidades": "fecha.",
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
    "modelo": "«El sábado trabajáis **las tres**, de 9:00 a 14:00.»"
  },
  {
    "id": "citas-profesional-periodo",
    "categoria": "equipo",
    "grupo": "negocio",
    "responde": "cuántas citas ha hecho una profesional en un periodo.",
    "dato": "`ocupacionPorProfesional(appointments, rango, equipo)` → `citas`.",
    "entidades": "profesional; periodo.",
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
    "modelo": "«Noelia lleva **98 citas** este mes, 12 más que Sara. [Ver Equipo]»"
  },
  {
    "id": "ocupacion-profesional",
    "categoria": "equipo",
    "grupo": "negocio",
    "responde": "la ocupación de una profesional en un periodo.",
    "dato": "`ocupacionPorProfesional(...)` → `pct`.",
    "entidades": "profesional; periodo.",
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
    "modelo": "«Sara está al **70 %** este mes; la más libre es María (62 %).»"
  },
  {
    "id": "dinero-profesional",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "lo que lleva cobrado y previsto una profesional en un periodo.",
    "dato": "`dineroDelRango` con `appointments` filtradas por `employeeId`.",
    "entidades": "profesional; periodo.",
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
    "modelo": "«Noelia lleva **2.340 € cobrados** este mes y 610 € previstos hasta fin de mes.»"
  },
  {
    "id": "lo-que-mas-hace",
    "categoria": "equipo",
    "grupo": "negocio",
    "responde": "los servicios que más hace una profesional.",
    "dato": "`serviciosDelRango(appointments.filter(e), rango, services)`.",
    "entidades": "profesional; periodo (opcional).",
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
    "modelo": "«A Sara lo que más le piden es **Tinte** (130 veces en 30 días), luego Corte y Mechas.»"
  },
  {
    "id": "profesional-habitual",
    "categoria": "equipo",
    "grupo": "negocio",
    "responde": "con quién va una clienta.",
    "dato": "`fichaDeClienta(...).resumen.profesionalHabitual`.",
    "entidades": "clienta.",
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
    "modelo": "«Elena va casi siempre con **Noelia**.»"
  },
  {
    "id": "precio-servicio",
    "categoria": "servicios",
    "grupo": "negocio",
    "responde": "el precio de un servicio de la carta.",
    "dato": "`services` (`priceEur`), vía `selectServiceMap`.",
    "entidades": "servicio.",
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
    "modelo": "«El Tinte está a **35 €** (40 min). [Ver Servicios]»"
  },
  {
    "id": "duracion-servicio",
    "categoria": "servicios",
    "grupo": "negocio",
    "responde": "cuánto dura un servicio según la carta y según lo real.",
    "dato": "`services` (`durationMin`) y `duracionRecordada(...)` para una clienta.",
    "entidades": "servicio; clienta (opcional).",
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
    "modelo": "«Según la carta, unas Mechas duran **2 h**. A Marta la última vez le llevaron 2 h 15.»"
  },
  {
    "id": "servicio-mas-pedido",
    "categoria": "servicios",
    "grupo": "negocio",
    "responde": "el servicio más pedido de un periodo.",
    "dato": "`serviciosDelRango(appointments, rango, services)[0]` y `mostBookedService(appointments)`.",
    "entidades": "periodo.",
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
    "modelo": "«Lo más pedido este mes es el **Tinte** (197 veces), luego Corte y peinado (130).»"
  },
  {
    "id": "servicio-mas-rentable",
    "categoria": "servicios",
    "grupo": "negocio",
    "responde": "el servicio que más deja por hora de trabajo.",
    "dato": "`servicioQueMasDeja(...)` de `campanas.ts`, o `serviciosDelRango` con los euros entre la duración.",
    "entidades": "periodo.",
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
    "modelo": "«El que más deja por hora es el **Peinado de novia: 60 €/h**. El Tinte, 53 €/h.»"
  },
  {
    "id": "carta",
    "categoria": "servicios",
    "grupo": "negocio",
    "responde": "qué servicios hay en la carta y cuáles se pueden reservar.",
    "dato": "`services` (`active`).",
    "entidades": "ninguna.",
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
    "modelo": "«Tienes **6 servicios**: Corte y peinado 25 €, Tinte 35 €, Mechas 80 €, Peinado de novia 90 €, Recogido 45 € y Tratamiento 20 €. [Ver Servicios]»"
  },
  {
    "id": "veces-servicio",
    "categoria": "servicios",
    "grupo": "negocio",
    "responde": "cuántas veces se ha hecho un servicio y lo que ha dejado.",
    "dato": "`serviciosDelRango(...)` → `veces`, `euros`.",
    "entidades": "servicio; periodo.",
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
    "modelo": "«Este mes llevas **197 tintes**, que han dejado 6.895 € según tarifa.»"
  },
  {
    "id": "cobrado-periodo",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "lo cobrado en un periodo (histórico).",
    "dato": "`dineroDelRango(appointments, rango, ahora)` → `cobrado`, `cobradas`, `realizadas`, `noVino`.",
    "entidades": "periodo.",
    "ejemplos": [
      "cuanto he cobrado este mes",
      "caja de la semana",
      "facturado el mes pasado",
      "cuanto hice ayer",
      "cobrado en septiembre",
      "cuanto llevo este año"
    ],
    "modelo": "«Del 1 al 20 de septiembre cobraste **9.725 €** en 241 citas (10 no vinieron). [Ver Analítica]»"
  },
  {
    "id": "previsto-periodo",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "lo previsto en un periodo futuro (confirmadas sin cobrar).",
    "dato": "`dineroDelRango(...)` → `previsto`, `previstas`.",
    "entidades": "periodo futuro.",
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
    "modelo": "«La semana que viene tienes **4.675 € previstos** en 113 citas confirmadas.»"
  },
  {
    "id": "estimacion-mes",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "cómo terminará el mes: lo cobrado más lo previsto.",
    "dato": "`dineroDelRango(mes)`: `cobrado` + `previsto` (y `porCobrar`).",
    "entidades": "periodo (este mes por defecto).",
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
    "modelo": "«Este mes llevas 9.725 € cobrados y **1.940 € previstos**: unos **11.665 €** si todo sigue así. Es una estimación con las citas confirmadas.»"
  },
  {
    "id": "cobro-por-metodo",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "cuánto se cobró por Bizum, efectivo y tarjeta.",
    "dato": "`cierreDelDia(appointments, equipo, dia).porMetodo`, o `dineroDelRango` agrupando por `paymentMethod`.",
    "entidades": "fecha o periodo.",
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
    "modelo": "«Hoy: **tarjeta 205 €**, efectivo 100 € y Bizum 30 €.»"
  },
  {
    "id": "comparar-periodos",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "cómo va un periodo frente al anterior (citas, dinero, ocupación).",
    "dato": "`resumenDePeriodo(...)` → `actual`, `previo`, `textoComparacion`, `comparar`.",
    "entidades": "periodo.",
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
    "modelo": "«Este mes llevas un **11 % más de citas** y una ocupación del 69 % (el mes pasado, 62 %). ¡Buen mes!»"
  },
  {
    "id": "precio-medio",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "el importe medio por cita de un periodo.",
    "dato": "`resumenDePeriodo(...).actual`: dinero entre citas.",
    "entidades": "periodo.",
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
    "modelo": "«Cada cita deja **40 € de media** este mes.»"
  },
  {
    "id": "dinero-servicio",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "lo que ha dejado un servicio según tarifa.",
    "dato": "`serviciosDelRango(...)` → `euros`.",
    "entidades": "servicio; periodo.",
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
    "modelo": "«Las Mechas han dejado **2.560 €** este mes (32 veces), según tarifa.»"
  },
  {
    "id": "resumen-mes",
    "categoria": "dinero",
    "grupo": "negocio",
    "responde": "el resumen del mes en tres cifras y el Excel.",
    "dato": "`resumenDelMes(...)` de `campanas.ts` y `resumenMensualToCsv(...)` de `export-csv.ts`.",
    "entidades": "mes.",
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
    "modelo": "«Septiembre: **9.725 € cobrados**, 262 citas y un 69 % de ocupación. [Descargar Excel]»"
  },
  {
    "id": "senales-pendientes",
    "categoria": "senal",
    "grupo": "negocio",
    "responde": "las señales pedidas que aún no han llegado.",
    "dato": "`estadoSenal(...) === \"pedida\"`, con `depositEur` y `depositDueAt`.",
    "entidades": "ninguna.",
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
    "modelo": "«Esperas **2 señales**: Pablo (20 €, antes de las 21:32) y Lucía (20 €, antes de mañana a las 10:00).»"
  },
  {
    "id": "senales-vencidas",
    "categoria": "senal",
    "grupo": "negocio",
    "responde": "las señales cuyo plazo pasó sin recibirlas.",
    "dato": "`estadoSenal(...) === \"vencida\"`.",
    "entidades": "ninguna.",
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
    "modelo": "«**1 señal vencida**: la de Pablo Martín (20 €). Dale más tiempo o libera el hueco. [Abrir cita]»"
  },
  {
    "id": "senal-cita",
    "categoria": "senal",
    "grupo": "negocio",
    "responde": "el estado de la señal de la cita de una clienta.",
    "dato": "`estadoSenal(cita, regla, ahora)` de su próxima cita.",
    "entidades": "clienta.",
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
    "modelo": "«La señal de Pablo está **pedida**: 20 € antes de las 21:32. Cuando la veas en tu banco, márcala. [Abrir cita]»"
  },
  {
    "id": "regla-senal",
    "categoria": "senal",
    "grupo": "negocio",
    "responde": "cuánto se pide de señal, a quién y con qué plazo.",
    "dato": "`reglaSenal(salonProfile)` y `resumenCancelacionSenal(regla, eur)`.",
    "entidades": "ninguna.",
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
    "modelo": "«Pides **20 €** en los servicios de 90 minutos o más, con 2 h de plazo. Se devuelve si cancelan con más de 24 h. [Abrir Ajustes › Señal]»"
  },
  {
    "id": "senales-recibidas",
    "categoria": "senal",
    "grupo": "negocio",
    "responde": "las señales recibidas en un periodo y su importe.",
    "dato": "`appointments` con `depositStatus` en `recibida` o `aplicada`, sumando `depositReceivedEur`.",
    "entidades": "periodo.",
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
    "modelo": "«Este mes has recibido **6 señales**: 120 €.»"
  },
  {
    "id": "campanas",
    "categoria": "marketing",
    "grupo": "negocio",
    "responde": "qué campaña conviene hacer y a cuántas personas va.",
    "dato": "`buildCampanas(...)` de `campanas.ts` (título, cifra, `personas`).",
    "entidades": "ninguna.",
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
    "modelo": "«La que más rinde ahora: **«Clientas que no vuelven»**, 119 personas con el mensaje ya escrito. [Ver Marketing]»"
  },
  {
    "id": "recuperables",
    "categoria": "marketing",
    "grupo": "negocio",
    "responde": "cuántas clientas y huecos se pueden recuperar este mes.",
    "dato": "`resumenDelMes(...)` de `campanas.ts`.",
    "entidades": "ninguna.",
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
    "modelo": "«Este mes puedes recuperar **119 clientas** y rellenar 29 huecos. [Ver Marketing]»"
  },
  {
    "id": "huecos-flojos",
    "categoria": "marketing",
    "grupo": "negocio",
    "responde": "la franja floja y a quién ofrecérsela.",
    "dato": "`huecosFlojos(...)` de `campanas.ts`.",
    "entidades": "ninguna.",
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
    "modelo": "«Los martes por la tarde estáis al 2 %. Tienes **582 clientas** activas para ofrecérselo. [Preparar envío]»"
  },
  {
    "id": "segunda-visita",
    "categoria": "marketing",
    "grupo": "negocio",
    "responde": "las clientas nuevas que aún no han vuelto.",
    "dato": "`segundaVisita(...)` con `DIAS_SEGUNDA_VISITA`.",
    "entidades": "ninguna.",
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
    "modelo": "«**36 clientas** vinieron una sola vez en los últimos 60 días. [Preparar mensaje]»"
  },
  {
    "id": "resenas",
    "categoria": "marketing",
    "grupo": "negocio",
    "responde": "a quién pedir una reseña.",
    "dato": "`resenaTrasLaCita(...)` con `DIAS_RESENA`.",
    "entidades": "ninguna.",
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
    "modelo": "«**65 clientas** vinieron en los últimos 7 días; es buen momento para pedirles la reseña. [Preparar mensaje]»"
  },
  {
    "id": "horario-salon",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "el horario de apertura de la semana.",
    "dato": "`weekSchedule(salonProfile.openingHours)` o `resumenHorario(openingHours)`.",
    "entidades": "día (opcional).",
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
    "modelo": "«PeluChic abre **Mar–Vie 10:00–20:00 · Sáb 9:00–14:00**; lunes y domingo, cerrado. [Cambiar en Mi página]»"
  },
  {
    "id": "enlace-reservas",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "el enlace de la página de reservas para compartirlo.",
    "dato": "`usePanelPublicLink()` de `panel-public-link.ts`.",
    "entidades": "ninguna.",
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
    "modelo": "«Tu página es **siShow…/s/peluchic**. [Copiar enlace] [Ver tu web]»"
  },
  {
    "id": "politica-cancelacion",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "lo que dice la web sobre cancelar.",
    "dato": "`respuestaFaqSenal(regla, eur)` (maqueta), `recargoActivo(salonProfile)` y `faqPublica(...)`.",
    "entidades": "ninguna.",
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
    "modelo": "«Tu web dice: cancelar hasta **24 h antes** no tiene coste; si no vienen o cancelan más tarde, pierden la señal. [Cambiar en Mi página › Preguntas frecuentes]»"
  },
  {
    "id": "preguntas-reserva",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "qué se pregunta a la clienta al reservar.",
    "dato": "`preguntasDelSalon(salonProfile, ...)` (maqueta) y `preguntasAplicables(...)`.",
    "entidades": "servicio (opcional).",
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
    "modelo": "«Al reservar preguntas **3 cosas**: largo de pelo, color actual y tratamientos del último mes. [Editar en Ajustes]»"
  },
  {
    "id": "plantones-config",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "si hay penalización por no venir y cuánto.",
    "dato": "`recargoActivo(salonProfile)`, `noShowFeeEur` y `noShowNoticeHours`.",
    "entidades": "ninguna.",
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
    "modelo": "«No cobras penalización: solo la señal si no vienen. [Ajustes › Plantones y señal]»"
  },
  {
    "id": "mensajes-whatsapp",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "cómo son los mensajes de confirmación y de recordatorio.",
    "dato": "`salonProfile.plantillas`, con `mensajeConfirmacionDe` y `mensajeRecordatorioDe` de `plantillas-whatsapp.ts`.",
    "entidades": "ninguna.",
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
    "modelo": "«El recordatorio dice: «Hola Lucía, te recordamos tu cita en PeluChic mañana a las 10:30…». [Cambiarlo en Ajustes › Mensajes]»"
  },
  {
    "id": "duracion-flexible",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "si la duración se decide al aceptar cada solicitud.",
    "dato": "`duracionFlexibleActiva(salonProfile)`.",
    "entidades": "ninguna.",
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
    "modelo": "«Sí: la web enseña una duración orientativa y **la fijas tú** al confirmar. [Ajustes › Tu agenda]»"
  },
  {
    "id": "calendario-suscrito",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "si las citas están en Google Calendar o en el iPhone y cómo activarlo.",
    "dato": "`realSalonSlug` y la suscripción de Ajustes.",
    "entidades": "ninguna.",
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
    "modelo": "«Puedes ver las citas en tu Google Calendar o en el iPhone con un enlace privado; se actualiza cada pocas horas. [Ajustes › Tu agenda]»"
  },
  {
    "id": "equipo-y-colores",
    "categoria": "configuracion",
    "grupo": "negocio",
    "responde": "el color de cada servicio y profesional en el calendario.",
    "dato": "`indiceColorServicio(...)` y `colorElegidoProfesional(...)`.",
    "entidades": "servicio o profesional (opcional).",
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
    "modelo": "«El Tinte sale en lavanda y Sara en salvia. [Cambiarlos en Ajustes › Colores]»"
  },
  {
    "id": "que-puedo-preguntar",
    "categoria": "ayuda",
    "grupo": "negocio",
    "responde": "las categorías y 3 ejemplos de cada una.",
    "dato": "el catálogo de este documento.",
    "entidades": "categoría (opcional).",
    "ejemplos": [
      "q te puedo preguntar",
      "ejemplos",
      "ayuda",
      "como funcionas",
      "q sabes",
      "preguntas de dinero"
    ],
    "modelo": "«Pregúntame por hoy, la agenda, tus clientas, el equipo, los servicios, el dinero o la señal. Por ejemplo: «huecos el sábado» o «qué se hizo Marta». [Ver todas en Ajustes]»"
  },
  {
    "id": "como-preguntar",
    "categoria": "ayuda",
    "grupo": "negocio",
    "responde": "consejos para preguntar mejor.",
    "dato": "texto fijo.",
    "entidades": "ninguna.",
    "ejemplos": [
      "como te pregunto",
      "escribo mal",
      "tengo q escribir exacto?",
      "como tengo q preguntar",
      "que escribo",
      "te pregunto normal?",
      "no me sale nada"
    ],
    "modelo": "«Escribe como hablas: «cuántas mañana», «color de Elena», «cuánto llevo este mes». Con el nombre de la clienta o de la profesional acierto más.»"
  },
  {
    "id": "saludo",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "hola",
      "buenas",
      "buenos dias",
      "ey",
      "hola que tal"
    ],
    "modelo": "¡Hola, María! 👋 Hoy tienes 18 citas y 3 solicitudes esperando. ¿Por dónde empezamos?"
  },
  {
    "id": "gracias",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "gracias",
      "genial",
      "perfecto",
      "muchas gracias",
      "ok gracias"
    ],
    "modelo": "¡A ti! Aquí estoy para lo que necesites."
  },
  {
    "id": "quien-eres",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "quien eres",
      "q eres",
      "eres una ia",
      "eres chatgpt"
    ],
    "modelo": "Soy el asistente de siShow para PeluChic. No soy una inteligencia artificial: respondo con los datos de tu salón y nunca me invento nada."
  },
  {
    "id": "que-sabes-hacer",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "q sabes hacer",
      "para q sirves",
      "q haces"
    ],
    "modelo": "Te digo cómo va el día, quién viene, tus huecos, lo que hizo cada clienta, lo que llevas cobrado y cómo va la señal. [Ver ejemplos]"
  },
  {
    "id": "despedida",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "adios",
      "hasta luego",
      "chao",
      "me voy"
    ],
    "modelo": "¡Hasta luego! Que vaya bien el día en PeluChic."
  },
  {
    "id": "buen-trabajo",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "eres un crack",
      "que bien",
      "me encanta"
    ],
    "modelo": "¡Gracias! El mérito es de tu agenda, que está muy bien llevada."
  },
  {
    "id": "como-estas",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "como estas",
      "q tal"
    ],
    "modelo": "Muy bien, con los datos al día. ¿Te cuento cómo va hoy?"
  },
  {
    "id": "no-entiendo",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "no entiendo",
      "q",
      "?",
      "eh"
    ],
    "modelo": "Perdona, no me he explicado. Prueba con algo como «cuántas citas mañana» o «color de Elena»."
  },
  {
    "id": "ayuda-humana",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "quiero hablar con alguien",
      "persona",
      "soporte"
    ],
    "modelo": "Te pongo con el equipo de siShow: escríbenos a ejemplo@sishow.com y te contestamos lo antes posible."
  },
  {
    "id": "broma",
    "categoria": "charla",
    "grupo": "charla",
    "ejemplos": [
      "cuentame un chiste",
      "aburrida",
      "jaja"
    ],
    "modelo": "Lo mío son los números: hoy te quedan 3 huecos por llenar. ¿Lo miramos?"
  },
  {
    "id": "plan-mas-profesionales",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "puedo añadir otra estilista",
      "somos 4",
      "meter a otra chica"
    ],
    "plan": "Todo incluido (hasta 6)",
    "alternativa": "Reservas y Reservas + Asistente llegan hasta 3 profesionales (guía §6 Equipo)",
    "mensaje": "Hola, soy María de PeluChic. Vamos a ser 4 en el equipo y me gustaría pasar al plan Todo incluido. ¿Qué tengo que hacer?"
  },
  {
    "id": "plan-segunda-pagina",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "otra pagina para novias",
      "web de formacion",
      "segundo enlace"
    ],
    "plan": "Todo incluido (por confirmar)",
    "alternativa": "La carta de Mi página ya separa por categorías (guía §8)",
    "mensaje": "Hola, me interesaría una segunda página de reservas para novias. ¿Cuándo estaría y qué plan necesito?"
  },
  {
    "id": "plan-dominio-propio",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "quiero reservas.peluchic.es",
      "mi propio dominio",
      "url mia"
    ],
    "plan": "Todo incluido (por confirmar)",
    "alternativa": "Comparte el enlace de siShow desde Mi página (guía §8)",
    "mensaje": "Hola, me gustaría usar mi propio dominio para las reservas. ¿Qué necesito?"
  },
  {
    "id": "plan-informe-mensual",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "me mandas el informe por correo",
      "resumen mensual al email"
    ],
    "plan": "Todo incluido (por confirmar)",
    "alternativa": "Descarga el resumen del mes en Analítica (guía §11)",
    "mensaje": "Hola, me gustaría recibir el informe mensual por correo. ¿Cuándo estará?"
  },
  {
    "id": "plan-whatsapp-automatico",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "respuestas automaticas en whatsapp",
      "que conteste solo el whatsapp"
    ],
    "plan": "Todo incluido (cuando Meta lo apruebe)",
    "alternativa": "Los mensajes se mandan con un toque desde tu WhatsApp (guía §1)",
    "mensaje": "Hola, me interesan las respuestas automáticas por WhatsApp. ¿En qué punto está?"
  },
  {
    "id": "plan-recordatorio-automatico",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "que mande solo los recordatorios",
      "recordatorio automatico"
    ],
    "plan": "Reservas + Asistente (noviembre)",
    "alternativa": "Desde la hoja de mañana, uno a uno y con un toque (guía §1)",
    "mensaje": "Hola, ¿cuándo estarán los recordatorios automáticos por WhatsApp?"
  },
  {
    "id": "plan-importar-mensual",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "traer tpv cada mes",
      "actualizar de tpv 123",
      "sincronizar tpv"
    ],
    "plan": "Todo incluido (por confirmar)",
    "alternativa": "Importar el Excel de TPV 123 desde Clientas cuando quieras (guía §4)",
    "mensaje": "Hola, sigo usando TPV 123. ¿Podéis traer mis datos cada mes?"
  },
  {
    "id": "plan-asistente",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "por q no me contesta el asistente"
    ],
    "plan": "Reservas + Asistente",
    "alternativa": "En Reservas el asistente no está incluido; la ficha y el buscador sí (guía §4)",
    "mensaje": "Hola, me gustaría añadir el asistente a mi plan. ¿Cómo lo hago?"
  },
  {
    "id": "no-hace-facturas",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "hacer factura",
      "ticket",
      "verifactu",
      "caja fiscal",
      "stock"
    ],
    "plan": "Ningún plan",
    "alternativa": "Eso sigue en TPV 123; siShow no emite facturas (guía §10)",
    "mensaje": "Hola, ¿tenéis previsto facturas o VeriFactu en siShow?"
  },
  {
    "id": "no-cobra-tarjeta",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "cobrar con tarjeta por la web",
      "que paguen online",
      "pasarela"
    ],
    "plan": "Ningún plan",
    "alternativa": "La señal va por Bizum a tu número y la marcas tú (guía §9)",
    "mensaje": "Hola, ¿se podrá cobrar con tarjeta en la reserva?"
  },
  {
    "id": "no-escribe-google",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "que salga en el calendario de la clienta",
      "sincronizar en los dos sentidos"
    ],
    "plan": "Ningún plan",
    "alternativa": "Tus citas se ven en tu Google Calendar, solo lectura (guía §9)",
    "mensaje": "Hola, ¿se podrá sincronizar el calendario en los dos sentidos?"
  },
  {
    "id": "no-campanas-automaticas",
    "categoria": "plan",
    "grupo": "plan",
    "ejemplos": [
      "mandar la campaña a todas de golpe",
      "envio masivo"
    ],
    "plan": "Ningún plan (sin campañas masivas)",
    "alternativa": "Marketing prepara la lista y el mensaje; se envían desde tu WhatsApp (guía §12)",
    "mensaje": "Hola, ¿habrá envío de campañas desde siShow?"
  },
  {
    "id": "tec-crear-cita",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como meto una cita",
      "como apunto a alguien",
      "dar cita"
    ],
    "solucion": "Botón «Nueva cita» arriba (o el «+» en el móvil): clienta, servicio, profesional, día y hora",
    "guia": "§3"
  },
  {
    "id": "tec-mover-cita",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como cambio una cita de hora",
      "mover cita",
      "cambiar el dia"
    ],
    "solucion": "Abre la cita en el calendario y cambia fecha y hora en el detalle",
    "guia": "§2"
  },
  {
    "id": "tec-confirmar",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como confirmo una solicitud",
      "aceptar reserva"
    ],
    "solucion": "En Hoy, «Confirmar»: se abre la ventana con la ficha; revisa la duración y pulsa «Confirmar cita»",
    "guia": "§1"
  },
  {
    "id": "tec-cancelar",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como cancelo",
      "borrar una cita",
      "anular"
    ],
    "solucion": "En el detalle de la cita, «…» y «Cancelar»; en una solicitud, «Rechazar» (con deshacer)",
    "guia": "§2"
  },
  {
    "id": "tec-anotar-color",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como apunto el color",
      "donde pongo la formula"
    ],
    "solucion": "Ficha de la clienta, «Añadir color de TPV 123»",
    "guia": "§4"
  },
  {
    "id": "tec-importar-tpv",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como traigo las clientas de tpv",
      "importar excel"
    ],
    "solucion": "Clientas, «Importar desde TPV 123»: sube el Excel, revisa las columnas y la vista previa",
    "guia": "§4"
  },
  {
    "id": "tec-senal",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como pido la señal",
      "no se como va el bizum"
    ],
    "solucion": "Ajustes › Plantones y señal para la regla; en la cita, «Pedir señal por WhatsApp» y después «Sí, enviado»",
    "guia": "§9"
  },
  {
    "id": "tec-horario",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como cambio mi horario",
      "cerrar un dia",
      "vacaciones"
    ],
    "solucion": "El horario del salón en Mi página; el de cada profesional en Equipo › Editar",
    "guia": "§6 y §8"
  },
  {
    "id": "tec-precios",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "como cambio un precio",
      "añadir servicio"
    ],
    "solucion": "Servicios y precios, «…» en el servicio, o «Nuevo servicio»",
    "guia": "§7"
  },
  {
    "id": "tec-no-llegan-reservas",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "no me llegan reservas",
      "la web no funciona",
      "nadie reserva"
    ],
    "solucion": "Comprueba que el enlace es el de Mi página («Copiar enlace») y que hay horario y profesionales con huecos",
    "guia": "§8"
  },
  {
    "id": "tec-no-sale-cita",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "no me sale la cita",
      "he perdido una cita",
      "no la veo"
    ],
    "solucion": "Busca a la clienta arriba; revisa el filtro de profesional del calendario (Todas) y las horas visibles",
    "guia": "§2"
  },
  {
    "id": "tec-whatsapp-no-abre",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "no se abre el whatsapp",
      "no manda el mensaje"
    ],
    "solucion": "Hace falta WhatsApp instalado en ese aparato y el teléfono de la clienta en su ficha",
    "guia": "§1"
  },
  {
    "id": "tec-panel-lento",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "va lento",
      "se queda cargando",
      "no carga"
    ],
    "solucion": "Recarga la página; si sigue, cierra y vuelve a entrar desde el enlace del panel",
    "guia": "§0"
  },
  {
    "id": "tec-contrasena",
    "categoria": "tecnica",
    "grupo": "tecnica",
    "ejemplos": [
      "no puedo entrar",
      "he olvidado la contraseña",
      "acceso"
    ],
    "solucion": "Entra con tu correo desde el acceso del salón; si no llega el enlace, revisa el correo no deseado",
    "guia": "§0"
  }
];
