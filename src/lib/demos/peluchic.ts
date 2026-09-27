import type { SalonProfile } from "../mock/types";
import { formatMenuEntry } from "../business-type";
import type { MezclaSemilla } from "../mock/seed";

/**
 * PeluChic (Sanchinarro, Madrid) — la demo registrada para la presentación a
 * María.
 *
 * FUENTE: su propia web, https://peluchic.online (páginas «Servicios/precios»
 * y «Contacto»), leída el 27/09/2026. Nombres de servicio, categorías y
 * precios van TAL CUAL los publica, erratas incluidas («Linfting»,
 * «Organico»): son su carta y así la reconoce. Las descripciones son las
 * suyas, recortadas a una o dos frases y con las tildes puestas.
 *
 * Precios: la carta de siShow admite un único importe por servicio. Cuando su
 * web da varios («24€/28€/31€») o un «desde», aquí va el MÁS BAJO — con el
 * que se reserva y se suma — y el texto literal va en `precio`, que el panel
 * y la web enseñan tal cual. Ningún precio es inventado.
 *
 * Duraciones: su web casi nunca las da. Las que sí da van marcadas `literal`
 * (Dermapen «sesion 30´», spa japonés «1h», masajes «50min», radiofrecuencia
 * corporal «30min=35€»). TODAS LAS DEMÁS SON ESTIMACIONES de una peluquería
 * de barrio, marcadas `estimada: true`: María las cambia en Servicios.
 *
 * Fuera de la carta (y dichas en las preguntas frecuentes): «Activacion»
 * (precio «X€», sin publicar), «servicio a domicilio» (por kilometraje) y
 * «trabajo por horas» (150 € sin IVA, «Consultar información»: es un trabajo
 * para productoras, no una cita de mostrador). Con ellas serían 63, y la
 * carta de un salón admite 60 (`MAX_MENU_ENTRIES_SALON`).
 */

/** Sube cuando cambien estos datos: los navegadores con la demo vieja la vuelven a cargar. */
export const VERSION_PELUCHIC = "2026-09-27.1";

export interface ServicioPeluChic {
  /** Id estable (sexto campo de la carta): las citas de la semilla y las descripciones cuelgan de él. */
  id: string;
  /** Tal cual su web. */
  nombre: string;
  categoria: CategoriaPeluChic;
  /** En euros. Si la web da varios, el más bajo. */
  precio: number;
  /** El precio literal cuando no es un importe único. */
  precioLiteral?: string;
  duracionMin: number;
  /** `true`: su web no da la duración y es una estimación nuestra, editable en Servicios. */
  estimada: boolean;
  descripcion: string;
}

/** Las siete secciones de su página de precios, en su orden. */
export const CATEGORIAS_PELUCHIC = [
  "Trabajos Cotidianos Peluquería",
  "Tratamientos Cuero Cabelludo",
  "Tratamientos Cabello",
  "Trabajos de la Mirada",
  "Trabajos Faciales",
  "Trabajos Corporales",
  "Trabajos de Cámara y Foco",
] as const;
export type CategoriaPeluChic = (typeof CATEGORIAS_PELUCHIC)[number];

const [COTIDIANOS, CUERO, CABELLO, MIRADA, FACIALES, CORPORALES, CAMARA] = CATEGORIAS_PELUCHIC;

const HIDROFACE =
  "Higiene con el equipo hidroface de 7 cabezales (galvánica, radiofrecuencia, infrarrojo…): no invasiva, indolora y con resultados inmediatos.";

/** La carta completa: 60 servicios, en el orden de su web. */
export const SERVICIOS_PELUCHIC: ServicioPeluChic[] = [
  // ---- Trabajos Cotidianos Peluquería ----
  { id: "lavado", nombre: "Lavado personalizado", categoria: COTIDIANOS, precio: 10, duracionMin: 15, estimada: true,
    descripcion: "Según tu necesidad capilar y con productos profesionales: champús sin derivados del petróleo y mascarillas nutritivas o hidratantes." },
  { id: "lavado-corte-secar", nombre: "Lavado personalizado + Corte +Secar humedad", categoria: COTIDIANOS, precio: 28.5, duracionMin: 45, estimada: true,
    descripcion: "Corte completo con lavado con los productos que tu cabello necesita y secado de la humedad con secador." },
  { id: "lavado-corte-peinar", nombre: "Lavado personalizado + Corte + Peinar", categoria: COTIDIANOS, precio: 43.5, precioLiteral: "43,50 € / 47,50 €", duracionMin: 60, estimada: true,
    descripcion: "Corte completo con lavado y peinado: 43,50 € corto o medio y 47,50 € largo o con cantidad. Plus plancha, 3 €." },
  { id: "peinar", nombre: "Peinar", categoria: COTIDIANOS, precio: 24, precioLiteral: "24 € / 28 € / 31 €", duracionMin: 40, estimada: true,
    descripcion: "Lavado personalizado, protector térmico y fijador, trabajado con secador: 24 € cortos o medias melenas, 28 € largo o mucha cantidad y 31 € con plancha." },
  { id: "cortar-caballero-nino", nombre: "Cortar Caballero/Niño", categoria: COTIDIANOS, precio: 19.5, duracionMin: 30, estimada: true,
    descripcion: "Hombre o niño, mismo precio: el tiempo y los años de experiencia son los mismos para todos." },
  { id: "cortar-anadido", nombre: "Cortar Añadido a otro servicio", categoria: COTIDIANOS, precio: 19.5, duracionMin: 30, estimada: true,
    descripcion: "Corte combinado con otro servicio, por ejemplo color, tratamientos o mechas." },
  { id: "color-organico", nombre: "Color de cobertura Organico", categoria: COTIDIANOS, precio: 41.5, duracionMin: 75, estimada: true,
    descripcion: "Coloración permanente con cobertura total de canas y notas de magnolia y bergamota. Incluye lavado y secado de humedad. Dura unas 5 semanas." },
  { id: "color-10-minutos", nombre: "Color de cobertura en 10 minutos", categoria: COTIDIANOS, precio: 41.5, duracionMin: 40, estimada: true,
    descripcion: "Tu color y cobertura de canas en 10 minutos, enriquecido con keratina. Incluye lavado y secado de humedad." },
  { id: "bano-brillo", nombre: "Baño de brillo", categoria: COTIDIANOS, precio: 41.5, duracionMin: 45, estimada: true,
    descripcion: "Refresco de pigmentos para un extra de brillo: disimula la cana sin cubrirla. Sin amoniaco y vegano. Dura de 0 a 4 semanas." },
  { id: "barros", nombre: "Barros", categoria: COTIDIANOS, precio: 65.5, precioLiteral: "65,50 € / 72 € / 77 €", duracionMin: 90, estimada: true,
    descripcion: "Coloración con plantas medicinales tintóreas, algas y flores: color y brillo sin dañar la fibra, y regula el pH del cuero cabelludo." },
  { id: "mechas", nombre: "Mechas*", categoria: COTIDIANOS, precio: 46.5, precioLiteral: "46,50 € / 106,50 €", duracionMin: 120, estimada: true,
    descripcion: "Parciales, micro, balayage, californianas, clásicas o reflejos: personalizamos las mechas que necesites. El precio va según el producto utilizado." },
  { id: "money-piece", nombre: "Money piece", categoria: COTIDIANOS, precio: 18.5, precioLiteral: "18,50 € / 23,50 €", duracionMin: 30, estimada: true,
    descripcion: "Solo en la parte frontal, con o sin matiz, para iluminar tu rostro. Precio añadido a otro servicio (color, peinar o barro)." },
  { id: "matiz", nombre: "Matiz", categoria: COTIDIANOS, precio: 30, duracionMin: 30, estimada: true,
    descripcion: "Para corregir tonos no deseados: amarillos, naranjas o incluso verdes. No incluye lavado ni secado de humedad." },
  { id: "ahuecador", nombre: "Ahuecador -Moldeados", categoria: COTIDIANOS, precio: 45, duracionMin: 90, estimada: true,
    descripcion: "Técnica clásica con productos actuales para dar forma o volumen: desde un leve volumen a una onda más marcada." },

  // ---- Tratamientos Cuero Cabelludo ----
  { id: "ozonoterapia", nombre: "OZONOTHERAPIA", categoria: CUERO, precio: 41, precioLiteral: "41 € / 49 € / 51,50 €", duracionMin: 45, estimada: true,
    descripcion: "Tricología para regular el pH, los picores, la grasa y la caspa, y reforzar el bulbo piloso. Básica 41 €, con tónicos 49 € y completa 51,50 €." },
  { id: "diagnostico-camara", nombre: "Diagnostico capilar con cámara", categoria: CUERO, precio: 10.5, duracionMin: 20, estimada: true,
    descripcion: "Valoración del estado del cuero cabelludo y del bulbo piloso con cámara." },
  // Duración literal: la da el propio nombre («sesion 30´»).
  { id: "dermapen", nombre: "Dermapen capilar sesion 30´", categoria: CUERO, precio: 55, duracionMin: 30, estimada: false,
    descripcion: "Micropunción con principios activos para reforzar el cabello desde el cuero cabelludo. Incluye lavado personalizado." },
  { id: "hidrobalance", nombre: "Hidrobalance capilar", categoria: CUERO, precio: 55, duracionMin: 45, estimada: true,
    descripcion: "Peeling y aparatología en tres pasos —limpiar, tonificar e implantar— para que el tratamiento penetre en el cuero cabelludo." },
  { id: "barros-cuero-cabelludo", nombre: "barros cuero cabelludo", categoria: CUERO, precio: 65.5, duracionMin: 60, estimada: true,
    descripcion: "Algas, flores y plantas medicinales para limpiar y mineralizar el cuero cabelludo: calma desde la primera aplicación." },

  // ---- Tratamientos Cabello ----
  { id: "hidratacion-intensiva", nombre: "tratamiento de hidratacion intensiva", categoria: CABELLO, precio: 22.5, precioLiteral: "22,50 € / 28,50 €", duracionMin: 30, estimada: true,
    descripcion: "Hidrata hasta cuatro veces más que una mascarilla; puedes hacerlo durante el tiempo del color. Precio según el producto absorbido." },
  { id: "proteinas", nombre: "tratamiento de proteinas", categoria: CABELLO, precio: 36, precioLiteral: "36 € / 46,50 €", duracionMin: 40, estimada: true,
    descripcion: "Para cabello dañado o frágil: brillo, grosor y, en rizos, definición. Precio según el producto absorbido." },
  { id: "tipo-bx", nombre: "tratamiento tipo bx", categoria: CABELLO, precio: 57, precioLiteral: "57 € / 89,50 €", duracionMin: 120, estimada: true,
    descripcion: "Fórmula multiproteica que nutre y rellena la fibra: rejuvenecimiento visible desde la primera aplicación. Dura de 1 a 3 meses." },
  { id: "olaplex", nombre: "tratamiento olaplex", categoria: CABELLO, precio: 47, precioLiteral: "47 € / 67,50 €", duracionMin: 45, estimada: true,
    descripcion: "Reparación desde el interior para cabellos dañados o sensibilizados, con química o sin ella." },
  { id: "olaplex-quelante", nombre: "tratamiento olaplex Quelante", categoria: CABELLO, precio: 20, precioLiteral: "20 € / 28 €", duracionMin: 30, estimada: true,
    descripcion: "Purificación profunda: elimina residuos de aceite, agua dura y metales antes de una keratina, un color o una permanente." },
  { id: "reconstructor-rizos", nombre: "tratamiento reconstructor de rizos", categoria: CABELLO, precio: 26, precioLiteral: "26 € / 31 €", duracionMin: 40, estimada: true,
    descripcion: "Refuerza los rizos: más definición, brillo, movimiento e hidratación y menos encrespamiento desde la primera sesión." },
  { id: "nanokeratinizacion", nombre: "Nanokeratinizacion", categoria: CABELLO, precio: 42, duracionMin: 45, estimada: true,
    descripcion: "Vapor frío con keratina y ácido hialurónico para cabellos extradañados. No incluye el peinado, que es necesario (28 €): 70 € en total." },
  { id: "hyaluroplastia", nombre: "Hyaluroplastia", categoria: CABELLO, precio: 22, duracionMin: 30, estimada: true,
    descripcion: "Vapor frío con ácido hialurónico para cabellos secos y opacos. No incluye el peinado, que es necesario (28 €): 50 € en total." },
  { id: "combonano", nombre: "Combonano 4 sesiones en un mes", categoria: CABELLO, precio: 88, duracionMin: 45, estimada: true,
    descripcion: "Bono de 4 sesiones, una por semana: nanokeratinización, hyaluroplastia y ozonoterapia. No incluye los peinados, que son necesarios." },
  { id: "barros-tratantes", nombre: "barros Tratantes", categoria: CABELLO, precio: 75, duracionMin: 60, estimada: true,
    descripcion: "Tratamiento natural y orgánico de filosofía japonesa que mineraliza, hidrata y da fuerza y grosor al cabello." },
  { id: "keratina", nombre: "tratamiento keratina", categoria: CABELLO, precio: 101, precioLiteral: "101 € / 200 € / 250 €", duracionMin: 150, estimada: true,
    descripcion: "Elimina el frizz y relaja la onda de 3 a 6 meses, con brillo extremo. También en versión vegana. Precio según el producto." },
  // Duración literal: «1h=71€ / 2 h=135€»; en la carta va la sesión de una hora.
  { id: "spa-capilar-japones", nombre: "SPA CAPILAR JAPONES", categoria: CABELLO, precio: 71, precioLiteral: "1 h 71 € / 2 h 135 €", duracionMin: 60, estimada: false,
    descripcion: "Masaje craneal shiatsu, chorros de agua en puntos de acupuntura y cama de magneto: descarga cabeza, cuello y hombros." },

  // ---- Trabajos de la Mirada ----
  { id: "laminado-cejas", nombre: "Laminado cejas", categoria: MIRADA, precio: 28, duracionMin: 45, estimada: true,
    descripcion: "Incluye recorte y diseño con depilación." },
  { id: "laminado-tinte-cejas", nombre: "Laminado cejas y tinte cejas", categoria: MIRADA, precio: 36, duracionMin: 50, estimada: true,
    descripcion: "Incluye recorte y diseño con depilación." },
  { id: "tinte-cejas", nombre: "tinte de cejas", categoria: MIRADA, precio: 9, duracionMin: 15, estimada: true,
    descripcion: "Sin diseño ni depilación." },
  { id: "depilacion-ceja", nombre: "depilacion de ceja", categoria: MIRADA, precio: 12, duracionMin: 15, estimada: true,
    descripcion: "Con diseño." },
  { id: "depilacion-limpieza-ceja", nombre: "depilacion limpieza de ceja", categoria: MIRADA, precio: 10, duracionMin: 10, estimada: true,
    descripcion: "Sin diseño: solo retocar, con pinza o cera." },
  { id: "lifting-coreano", nombre: "Linfting KOREANO pestañas", categoria: MIRADA, precio: 36, duracionMin: 60, estimada: true,
    descripcion: "En cabina." },
  { id: "lifting-tinte", nombre: "Linfting pestañas +tinte de pestañas", categoria: MIRADA, precio: 46.5, duracionMin: 70, estimada: true,
    descripcion: "En cabina." },
  { id: "lifting-tinte-laminado", nombre: "Linfting pestañas +tinte de pestañas +laminado de cejas", categoria: MIRADA, precio: 57, duracionMin: 90, estimada: true,
    descripcion: "En cabina." },
  { id: "lifting-tinte-laminado-tinte", nombre: "Linfting pestañas +tinte de pestañas +laminado de cejas+tinte de cejas", categoria: MIRADA, precio: 65, duracionMin: 100, estimada: true,
    descripcion: "En cabina." },
  { id: "ojos-bolsas-ojeras", nombre: "tratamiento ojos- bolsas y ojeras", categoria: MIRADA, precio: 65, duracionMin: 45, estimada: true,
    descripcion: "Principios activos para el contorno de ojos: minimiza bolsas, ojeras y flacidez desde la primera aplicación." },

  // ---- Trabajos Faciales ----
  { id: "higiene-manual", nombre: "Higiene facial basica manual", categoria: FACIALES, precio: 38, duracionMin: 60, estimada: true,
    descripcion: "Con productos orgánicos o de laboratorio de alta calidad profesional: déjate asesorar según tu necesidad." },
  { id: "hidroface-basica", nombre: "Higiene facial basica hidroface", categoria: FACIALES, precio: 42.5, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-reparadora", nombre: "Higiene facial hidroface Reparadora", categoria: FACIALES, precio: 47, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-iluminadora", nombre: "Higiene facial hidroface Iluminadora", categoria: FACIALES, precio: 55, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-antiedad", nombre: "Higiene facial hidroface Antiedad", categoria: FACIALES, precio: 57, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-nutritivo", nombre: "Higiene facial hidroface Nutritivo", categoria: FACIALES, precio: 57, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-antipolucion", nombre: "Higiene facial hidroface Antipolucion", categoria: FACIALES, precio: 55, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-tensor", nombre: "Higiene facial hidroface efecto tensor", categoria: FACIALES, precio: 57, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "higiene-depurativa", nombre: "Higiene facial depurativa", categoria: FACIALES, precio: 47, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "hidroface-equilibrante", nombre: "Higiene facial hidroface Equilibrante", categoria: FACIALES, precio: 55, duracionMin: 60, estimada: true, descripcion: HIDROFACE },
  { id: "ritual-rosegold", nombre: "Ritualfacial hidroface RoseGold", categoria: FACIALES, precio: 65, duracionMin: 75, estimada: true,
    descripcion: "Tratamiento de 5 sesiones recomendado (325 € en total), con productos de laboratorio de alto contenido en activos." },
  { id: "ritual-panacee", nombre: "Ritualfacial hidroface panacee", categoria: FACIALES, precio: 65, duracionMin: 75, estimada: true,
    descripcion: "Tratamiento de 4 sesiones recomendado (260 € en total), con productos de laboratorio de alto contenido en activos." },
  { id: "radiofrecuencia-facial", nombre: "tratamiento facial Radiofrecuencia-diatermia", categoria: FACIALES, precio: 35, precioLiteral: "35 € / 65 €", duracionMin: 30, estimada: true,
    descripcion: "Radiofrecuencia diatermia a 448 kHz. Pregunta en cabina toda la información." },

  // ---- Trabajos Corporales ----
  // Duración literal: «Relajantes Corporal 50min…» (los craneales, 30 min).
  { id: "masajes", nombre: "Masajes", categoria: CORPORALES, precio: 50, precioLiteral: "50 € · bono 5: 225 € · bono 10: 400 €", duracionMin: 50, estimada: false,
    descripcion: "Relajantes, drenantes, anticelulíticos, reafirmantes o reductores de 50 min; craneales de 30 min." },
  { id: "model-shape", nombre: "model shape", categoria: CORPORALES, precio: 50, precioLiteral: "50 € · bono 5: 225 € · bono 10: 400 €", duracionMin: 60, estimada: true,
    descripcion: "Tratamiento manual de reducción corporal: pérdida rápida de centímetros y piel más tersa desde la primera sesión." },
  // Duración literal: «30min=35€ 60min=65€»; en la carta va la de 30 min.
  { id: "radiofrecuencia-corporal", nombre: "tratamiento corporal Radiofrecuencia-diatermia", categoria: CORPORALES, precio: 35, precioLiteral: "30 min 35 € / 60 min 65 €", duracionMin: 30, estimada: false,
    descripcion: "Calienta el tejido poco a poco para producir colágeno nuevo: indoloro y no invasivo. Bonos de 5 sesiones desde 160 €." },

  // ---- Trabajos de Cámara y Foco (su web: «Precios sin IVA») ----
  { id: "maquillaje-correccion", nombre: "Maquillaje de Correccion", categoria: CAMARA, precio: 65, precioLiteral: "65 € (sin IVA)", duracionMin: 60, estimada: true,
    descripcion: "Maquillaje para cámara y foco: cine, TV, teatro y publicidad. También maquillaje para novias." },
  { id: "peluqueria-focos", nombre: "Peluqueria focos", categoria: CAMARA, precio: 65, precioLiteral: "desde 65 € / 150 € (sin IVA)", duracionMin: 60, estimada: true,
    descripcion: "Peluquería de plató, preparada para cine, TV, teatro y publicidad." },
  { id: "novias", nombre: "Novias", categoria: CAMARA, precio: 150, precioLiteral: "desde 150 € (sin IVA)", duracionMin: 120, estimada: true,
    descripcion: "Consultar información: escríbenos por WhatsApp y te contamos." },
];

/**
 * Equipo: los tres nombres del enlace `?d=` con el que ya se enseñó la demo.
 * Su web no publica equipo; las especialidades se han alineado con su carta.
 */
const EQUIPO = [
  "María~Novias, eventos y maquillaje de cámara",
  "Sara~Color, mechas y color orgánico",
  "Noelia~Tratamientos capilares y cabina",
];

/**
 * Horario de su web («Horario de comunicacion»): de martes a viernes de 10 a
 * 20 y el sábado de 10 a 14. Lunes y domingo, cerrado.
 */
const HORARIO = ["Cerrado", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–20:00", "10:00–14:00", "Cerrado"];

/**
 * Turnos del equipo, dentro de ese horario y sin partir la jornada: entre las
 * tres cubren de 10 a 20, y el sábado abren María y Sara.
 */
const TURNOS = [
  ["Cerrado", "10:00–18:00", "10:00–18:00", "10:00–18:00", "10:00–18:00", "10:00–14:00", "Cerrado"],
  ["Cerrado", "12:00–20:00", "12:00–20:00", "12:00–20:00", "12:00–20:00", "10:00–14:00", "Cerrado"],
  ["Cerrado", "11:00–19:00", "11:00–19:00", "11:00–19:00", "11:00–19:00", "Cerrado", "Cerrado"],
];

/** Lo que su web dice de las citas y lo que no cabe en la carta, en su voz. */
const PREGUNTAS = [
  "¿Cómo pido cita?~Solo atendemos con cita previa. Puedes reservar aquí mismo o escribirnos por WhatsApp al 666 77 67 31.",
  "¿Hay que dejar fianza?~Sí: trabajamos con fianza al reservar la cita previa y no reservamos sin ella.",
  "¿Y si encuentro la puerta cerrada?~Será que estamos atendiendo a domicilio o en otro trabajo de exterior. Escríbenos por WhatsApp y te contestamos.",
  "¿Venís a domicilio?~Sí, con desplazamiento nacional e internacional desde nuestro estudio de Madrid. El coste del desplazamiento va por kilometraje: pregúntanos por WhatsApp.",
  "¿Hacéis novias y eventos?~Sí: peluquería y maquillaje de novia, ceremonias y eventos, desde 150 € (sin IVA). Escríbenos y te contamos.",
  "¿Trabajáis para cine, TV o publicidad?~Sí: peluquería y maquillaje de cámara y foco para producciones, también por horas (150 €/h sin IVA). Consúltanos.",
  "¿Tenéis tratamientos corporales?~Sí, en cabina: masajes, model shape, radiofrecuencia y «Activación» (drenaje, reductor, reafirmante, anticelulítico y presoterapia). Pregúntanos el precio.",
];

/**
 * Cómo se reparte su semana en la semilla de la demo (ver `MezclaSemilla` en
 * mock/seed.ts). Frecuencias de una peluquería de barrio que además hace
 * novias y eventos: color y peinados todos los días, tratamientos y cabina
 * sobre todo con Noelia, y las novias, el sábado con María.
 */
export const MEZCLA_PELUCHIC: MezclaSemilla = {
  servicios: {
    color: [["color-10-minutos", 40], ["color-organico", 25], ["bano-brillo", 15], ["barros", 12], ["matiz", 8]],
    mechas: [["mechas", 75], ["money-piece", 25]],
    corte: [["lavado-corte-peinar", 30], ["peinar", 30], ["lavado-corte-secar", 18], ["cortar-caballero-nino", 12], ["lavado", 6], ["ahuecador", 4]],
    tratamiento: [
      ["hidratacion-intensiva", 18], ["olaplex", 12], ["proteinas", 8], ["ozonoterapia", 8], ["keratina", 8], ["tipo-bx", 6],
      ["diagnostico-camara", 6], ["nanokeratinizacion", 6], ["hidrobalance", 5], ["spa-capilar-japones", 5], ["dermapen", 4],
      ["hyaluroplastia", 4], ["reconstructor-rizos", 4], ["olaplex-quelante", 4], ["barros-tratantes", 3],
      ["barros-cuero-cabelludo", 3], ["combonano", 2],
    ],
    mirada: [
      ["laminado-cejas", 18], ["depilacion-ceja", 18], ["laminado-tinte-cejas", 12], ["lifting-coreano", 12], ["lifting-tinte", 10],
      ["depilacion-limpieza-ceja", 10], ["tinte-cejas", 8], ["lifting-tinte-laminado", 5], ["lifting-tinte-laminado-tinte", 4],
      ["ojos-bolsas-ojeras", 3],
    ],
    estetica: [
      ["hidroface-basica", 14], ["masajes", 14], ["higiene-manual", 12], ["model-shape", 6], ["hidroface-iluminadora", 5],
      ["hidroface-antiedad", 5], ["radiofrecuencia-facial", 5], ["radiofrecuencia-corporal", 5], ["hidroface-reparadora", 4],
      ["hidroface-nutritivo", 4], ["hidroface-antipolucion", 3], ["hidroface-tensor", 3], ["higiene-depurativa", 3],
      ["hidroface-equilibrante", 3], ["ritual-rosegold", 3], ["ritual-panacee", 3],
    ],
    evento: [["novias", 45], ["maquillaje-correccion", 30], ["peluqueria-focos", 25]],
  },
  porProfesional: [
    // María: peinados, color y lo de cámara entre semana; el sábado, novias.
    { semana: { corte: 38, color: 22, mechas: 5, tratamiento: 10, mirada: 8, estetica: 4, evento: 3 },
      sabado: { corte: 45, color: 15, evento: 22, mirada: 8, tratamiento: 5 } },
    // Sara: la colorista.
    { semana: { color: 48, mechas: 24, corte: 16, tratamiento: 12 },
      sabado: { color: 40, mechas: 20, corte: 35, tratamiento: 5 } },
    // Noelia: tratamientos, mirada y cabina.
    { semana: { tratamiento: 30, estetica: 30, mirada: 22, corte: 14, color: 4 } },
  ],
  extras: [
    // «No incluye el peinado pero es necesario»: siempre van juntos.
    { tras: ["nanokeratinizacion", "hyaluroplastia"], anade: "peinar", prob: 1 },
    { tras: ["money-piece"], anade: "peinar", prob: 0.5 },
    { tras: ["mechas"], anade: "matiz", prob: 0.35 },
    { tras: ["color-10-minutos", "color-organico", "bano-brillo", "barros"], anade: "cortar-anadido", prob: 0.2 },
    // «Puedes aprovechar esta hidratación en el tiempo del color».
    { tras: ["color-10-minutos", "color-organico", "barros"], anade: "hidratacion-intensiva", prob: 0.12 },
    { tras: ["mechas"], anade: "olaplex", prob: 0.1 },
  ],
};

/** Carta en el formato de `SalonProfile.menu`, con los ids estables. */
function carta(): string[] {
  return SERVICIOS_PELUCHIC.map((s) =>
    formatMenuEntry({ id: s.id, name: s.nombre, durationMin: s.duracionMin, priceEur: s.precio, category: s.categoria }),
  );
}

export const PELUCHIC: SalonProfile = {
  id: "peluchic",
  slug: "peluchic",
  name: "PeluChic",
  // Su lema: «Servicio de Peluqueria y Maquillaje profesional». Deja el tipo en
  // «peluquería» (ver `inferBusinessType`), que es la semilla que le toca.
  tagline: "Peluquería y maquillaje",
  about:
    "Peluquería y maquillaje profesional en Sanchinarro, en el salón o a domicilio. Años de experiencia en teatro, televisión y publicidad: peinados y maquillaje de cámara y foco, novias, ceremonias y eventos.",
  // Su web no publica el código postal: 28050 es el de Sanchinarro.
  address: "C/ Princesa de Éboli 100, local 104 (entrada por el patio de c/ María Tudor 14), Sanchinarro, 28050 Madrid",
  phone: "666 77 67 31",
  whatsapp: "+34 666 77 67 31",
  instagram: "@peluchicprofesional",
  enlaces: {
    blog: "https://peluchic.online/",
    instagram: "https://www.instagram.com/peluchicprofesional",
    facebook: "https://www.facebook.com/peluchicprofesional/",
    tienda: "https://peluchic.online/tienda/ols/all",
  },
  boletin: {
    texto: "Obtén un 10 % de descuento en tu primera compra al inscribirte en nuestro boletín.",
    url: "https://peluchic.online/",
    condiciones: "Para la primera compra, al inscribirte para recibir el boletín informativo.",
  },
  openingHours: HORARIO,
  timeZone: "Europe/Madrid",
  // Ficha de Google (la misma del enlace `?d=`): nota, reseñas y fotos.
  rating: 4.5,
  reviewCount: 81,
  heroImage: "/api/foto?place=ChIJc_dY3q0uQg0ReeAzc1Y3irs&i=0",
  photoCount: 10,
  galleryPhotos: ["5", "2", "7", "4", "3", "6"],
  // Fotos que eligió Tomás de su trabajo (27/09/2026). Mandan sobre las de Google.
  galeriaPropia: [
    { url: "/demo/peluchic-galeria-1.jpg", alt: "Recogido de trenzas con volumen en melena castaña, visto de espaldas" },
    { url: "/demo/peluchic-galeria-2.jpg", alt: "Semirrecogido con trenzas y ondas en cabello rubio cobrizo, mientras se termina de peinar" },
    { url: "/demo/peluchic-galeria-3.jpg", alt: "Recogido bajo trenzado en cabello castaño con mechas, visto de espaldas" },
    { url: "/demo/peluchic-galeria-4.jpg", alt: "Semirrecogido con ondas y corona de flores, visto de espaldas" },
  ],
  logoUrl: "/demo/peluchic-logo.png",
  // Cuatro y sin «y» al final: la web las junta en una frase («…, color orgánico y tratamientos capilares»).
  specialties: ["novias y eventos", "maquillaje de cámara", "color orgánico", "tratamientos capilares"],
  team: EQUIPO,
  teamHours: TURNOS,
  menu: carta(),
  descripcionesServicios: Object.fromEntries(SERVICIOS_PELUCHIC.map((s) => [s.id, s.descripcion])),
  preciosLiterales: Object.fromEntries(
    SERVICIOS_PELUCHIC.filter((s) => s.precioLiteral).map((s) => [s.id, s.precioLiteral as string]),
  ),
  faq: PREGUNTAS,
  // «Trabajamos con Fianza a la hora de reservar la cita previa»: la señal
  // por Bizum, con el importe del enlace `?d=` (20 €).
  depositEnabled: true,
  depositBizumPhone: "666 77 67 31",
  depositAmountEur: 20,
  duracionFlexible: true,
  plan: "todo-incluido",
};
