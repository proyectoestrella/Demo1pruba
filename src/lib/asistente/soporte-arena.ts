/**
 * Soporte del asistente: funciones fuera del plan (§12) y dudas técnicas
 * (§13) de preguntas-universo.md. NO se enseña en «Cómo usar el asistente».
 * El asistente propone primero los pasos y el apartado de la guía, y solo
 * después el correo con el mensaje tipo. Generado desde el .md.
 */
export interface CasoSoporte {
  id: string;
  tipo: "plan" | "tecnica";
  ejemplos: string[];
  pasos: string[];
  /** Apartado de la guía de uso («§4 Clientas y ficha»). */
  guia: string | null;
  /** Mensaje tipo para el correo; en las técnicas se compone con la pregunta. */
  mensaje: string | null;
}

export const SOPORTE: CasoSoporte[] = [
  {
    "id": "plan-mas-profesionales",
    "tipo": "plan",
    "ejemplos": [
      "puedo añadir otra estilista",
      "somos 4",
      "meter a otra chica"
    ],
    "pasos": [
      "Reservas y Reservas + Asistente llegan hasta 3 profesionales.",
      "Llega con el plan Todo incluido (hasta 6)."
    ],
    "guia": "§6 Equipo",
    "mensaje": "Hola, soy María de PeluChic. Vamos a ser 4 en el equipo y me gustaría pasar al plan Todo incluido. ¿Qué tengo que hacer?"
  },
  {
    "id": "plan-segunda-pagina",
    "tipo": "plan",
    "ejemplos": [
      "otra pagina para novias",
      "web de formacion",
      "segundo enlace"
    ],
    "pasos": [
      "La carta de Mi página ya separa por categorías.",
      "Llega con el plan Todo incluido (por confirmar)."
    ],
    "guia": "§8 Mi página de reservas",
    "mensaje": "Hola, me interesaría una segunda página de reservas para novias. ¿Cuándo estaría y qué plan necesito?"
  },
  {
    "id": "plan-dominio-propio",
    "tipo": "plan",
    "ejemplos": [
      "quiero reservas.peluchic.es",
      "mi propio dominio",
      "url mia"
    ],
    "pasos": [
      "Comparte el enlace de siShow desde Mi página.",
      "Llega con el plan Todo incluido (por confirmar)."
    ],
    "guia": "§8 Mi página de reservas",
    "mensaje": "Hola, me gustaría usar mi propio dominio para las reservas. ¿Qué necesito?"
  },
  {
    "id": "plan-informe-mensual",
    "tipo": "plan",
    "ejemplos": [
      "me mandas el informe por correo",
      "resumen mensual al email"
    ],
    "pasos": [
      "Descarga el resumen del mes en Analítica.",
      "Llega con el plan Todo incluido (por confirmar)."
    ],
    "guia": "§11 Analítica",
    "mensaje": "Hola, me gustaría recibir el informe mensual por correo. ¿Cuándo estará?"
  },
  {
    "id": "plan-whatsapp-automatico",
    "tipo": "plan",
    "ejemplos": [
      "respuestas automaticas en whatsapp",
      "que conteste solo el whatsapp"
    ],
    "pasos": [
      "Los mensajes se mandan con un toque desde tu WhatsApp.",
      "Llega con el plan Todo incluido (cuando Meta lo apruebe)."
    ],
    "guia": "§1 Hoy",
    "mensaje": "Hola, me interesan las respuestas automáticas por WhatsApp. ¿En qué punto está?"
  },
  {
    "id": "plan-recordatorio-automatico",
    "tipo": "plan",
    "ejemplos": [
      "que mande solo los recordatorios",
      "recordatorio automatico"
    ],
    "pasos": [
      "Desde la hoja de mañana, uno a uno y con un toque.",
      "Llega con el plan Reservas + Asistente (noviembre)."
    ],
    "guia": "§1 Hoy",
    "mensaje": "Hola, ¿cuándo estarán los recordatorios automáticos por WhatsApp?"
  },
  {
    "id": "plan-importar-mensual",
    "tipo": "plan",
    "ejemplos": [
      "traer tpv cada mes",
      "actualizar de tpv 123",
      "sincronizar tpv"
    ],
    "pasos": [
      "Importar el Excel de TPV 123 desde Clientas cuando quieras.",
      "Llega con el plan Todo incluido (por confirmar)."
    ],
    "guia": "§4 Clientas y ficha",
    "mensaje": "Hola, sigo usando TPV 123. ¿Podéis traer mis datos cada mes?"
  },
  {
    "id": "plan-asistente",
    "tipo": "plan",
    "ejemplos": [
      "(en el plan Reservas) por q no me contesta el asistente"
    ],
    "pasos": [
      "En Reservas el asistente no está incluido; la ficha y el buscador sí.",
      "Llega con el plan Reservas + Asistente."
    ],
    "guia": "§4 Clientas y ficha",
    "mensaje": "Hola, me gustaría añadir el asistente a mi plan. ¿Cómo lo hago?"
  },
  {
    "id": "no-hace-facturas",
    "tipo": "plan",
    "ejemplos": [
      "hacer factura",
      "ticket",
      "verifactu",
      "caja fiscal",
      "stock"
    ],
    "pasos": [
      "Eso sigue en TPV 123; siShow no emite facturas.",
      "siShow no lo hace en ningún plan."
    ],
    "guia": "§10 Caja del día",
    "mensaje": "Hola, ¿tenéis previsto facturas o VeriFactu en siShow?"
  },
  {
    "id": "no-cobra-tarjeta",
    "tipo": "plan",
    "ejemplos": [
      "cobrar con tarjeta por la web",
      "que paguen online",
      "pasarela"
    ],
    "pasos": [
      "La señal va por Bizum a tu número y la marcas tú.",
      "siShow no lo hace en ningún plan."
    ],
    "guia": "§9 Ajustes",
    "mensaje": "Hola, ¿se podrá cobrar con tarjeta en la reserva?"
  },
  {
    "id": "no-escribe-google",
    "tipo": "plan",
    "ejemplos": [
      "que salga en el calendario de la clienta",
      "sincronizar en los dos sentidos"
    ],
    "pasos": [
      "Tus citas se ven en tu Google Calendar, solo lectura.",
      "siShow no lo hace en ningún plan."
    ],
    "guia": "§9 Ajustes",
    "mensaje": "Hola, ¿se podrá sincronizar el calendario en los dos sentidos?"
  },
  {
    "id": "no-campanas-automaticas",
    "tipo": "plan",
    "ejemplos": [
      "mandar la campaña a todas de golpe",
      "envio masivo"
    ],
    "pasos": [
      "Marketing prepara la lista y el mensaje; se envían desde tu WhatsApp.",
      "siShow no lo hace en ningún plan."
    ],
    "guia": "§12 Marketing",
    "mensaje": "Hola, ¿habrá envío de campañas desde siShow?"
  },
  {
    "id": "tec-crear-cita",
    "tipo": "tecnica",
    "ejemplos": [
      "como meto una cita",
      "como apunto a alguien",
      "dar cita"
    ],
    "pasos": [
      "Botón «Nueva cita» arriba (o el «+» en el móvil): clienta, servicio, profesional, día y hora."
    ],
    "guia": "§3 Nueva cita",
    "mensaje": null
  },
  {
    "id": "tec-mover-cita",
    "tipo": "tecnica",
    "ejemplos": [
      "como cambio una cita de hora",
      "mover cita",
      "cambiar el dia"
    ],
    "pasos": [
      "Abre la cita en el calendario y cambia fecha y hora en el detalle."
    ],
    "guia": "§2 Calendario",
    "mensaje": null
  },
  {
    "id": "tec-confirmar",
    "tipo": "tecnica",
    "ejemplos": [
      "como confirmo una solicitud",
      "aceptar reserva"
    ],
    "pasos": [
      "En Hoy, «Confirmar»: se abre la ventana con la ficha.",
      "Revisa la duración y pulsa «Confirmar cita»."
    ],
    "guia": "§1 Hoy",
    "mensaje": null
  },
  {
    "id": "tec-cancelar",
    "tipo": "tecnica",
    "ejemplos": [
      "como cancelo",
      "borrar una cita",
      "anular"
    ],
    "pasos": [
      "En el detalle de la cita, «…» y «Cancelar».",
      "En una solicitud, «Rechazar» (con deshacer)."
    ],
    "guia": "§2 Calendario",
    "mensaje": null
  },
  {
    "id": "tec-anotar-color",
    "tipo": "tecnica",
    "ejemplos": [
      "como apunto el color",
      "donde pongo la formula"
    ],
    "pasos": [
      "Ficha de la clienta, «Añadir color de TPV 123»."
    ],
    "guia": "§4 Clientas y ficha",
    "mensaje": null
  },
  {
    "id": "tec-importar-tpv",
    "tipo": "tecnica",
    "ejemplos": [
      "como traigo las clientas de tpv",
      "importar excel"
    ],
    "pasos": [
      "Clientas, «Importar desde TPV 123»: sube el Excel, revisa las columnas y la vista previa."
    ],
    "guia": "§4 Clientas y ficha",
    "mensaje": null
  },
  {
    "id": "tec-senal",
    "tipo": "tecnica",
    "ejemplos": [
      "como pido la señal",
      "no se como va el bizum"
    ],
    "pasos": [
      "Ajustes › Plantones y señal para la regla.",
      "En la cita, «Pedir señal por WhatsApp» y después «Sí, enviado»."
    ],
    "guia": "§9 Ajustes",
    "mensaje": null
  },
  {
    "id": "tec-horario",
    "tipo": "tecnica",
    "ejemplos": [
      "como cambio mi horario",
      "cerrar un dia",
      "vacaciones"
    ],
    "pasos": [
      "El horario del salón en Mi página.",
      "El de cada profesional en Equipo › Editar."
    ],
    "guia": "§6 Equipo y §8 Mi página de reservas",
    "mensaje": null
  },
  {
    "id": "tec-precios",
    "tipo": "tecnica",
    "ejemplos": [
      "como cambio un precio",
      "añadir servicio"
    ],
    "pasos": [
      "Servicios y precios, «…» en el servicio, o «Nuevo servicio»."
    ],
    "guia": "§7 Servicios y precios",
    "mensaje": null
  },
  {
    "id": "tec-no-llegan-reservas",
    "tipo": "tecnica",
    "ejemplos": [
      "no me llegan reservas",
      "la web no funciona",
      "nadie reserva"
    ],
    "pasos": [
      "Comprueba que el enlace es el de Mi página («Copiar enlace») y que hay horario y profesionales con huecos."
    ],
    "guia": "§8 Mi página de reservas",
    "mensaje": null
  },
  {
    "id": "tec-no-sale-cita",
    "tipo": "tecnica",
    "ejemplos": [
      "no me sale la cita",
      "he perdido una cita",
      "no la veo"
    ],
    "pasos": [
      "Busca a la clienta arriba.",
      "Revisa el filtro de profesional del calendario (Todas) y las horas visibles."
    ],
    "guia": "§2 Calendario",
    "mensaje": null
  },
  {
    "id": "tec-whatsapp-no-abre",
    "tipo": "tecnica",
    "ejemplos": [
      "no se abre el whatsapp",
      "no manda el mensaje"
    ],
    "pasos": [
      "Hace falta WhatsApp instalado en ese aparato y el teléfono de la clienta en su ficha."
    ],
    "guia": "§1 Hoy",
    "mensaje": null
  },
  {
    "id": "tec-panel-lento",
    "tipo": "tecnica",
    "ejemplos": [
      "va lento",
      "se queda cargando",
      "no carga"
    ],
    "pasos": [
      "Recarga la página.",
      "Si sigue, cierra y vuelve a entrar desde el enlace del panel."
    ],
    "guia": "§0 Antes de empezar",
    "mensaje": null
  },
  {
    "id": "tec-contrasena",
    "tipo": "tecnica",
    "ejemplos": [
      "no puedo entrar",
      "he olvidado la contraseña",
      "acceso"
    ],
    "pasos": [
      "Entra con tu correo desde el acceso del salón.",
      "Si no llega el enlace, revisa el correo no deseado."
    ],
    "guia": "§0 Antes de empezar",
    "mensaje": null
  }
];
