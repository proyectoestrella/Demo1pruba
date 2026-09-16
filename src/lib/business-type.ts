import type { Client, Employee, EmployeeId, Service } from "./mock/types";

/**
 * Vocabulario y catálogos por tipo de negocio.
 *
 * Antes cada pantalla adivinaba el tipo con su propia expresión regular sobre
 * el tagline —`salon-words.ts`, `WorkGallery.tsx`, `s.$salonSlug.index.tsx`,
 * `maps.functions.ts`— y cada una reconocía palabras distintas: una demo de
 * "peluquería de señoras" podía salir con el sillón de barbero de portada en
 * un sitio y con el nombre correcto en otro. Este módulo es la única fuente:
 * un tipo normalizado y, colgando de él, todo lo que cambia con el oficio —
 * catálogo de servicios, equipo de ejemplo, nombres de clientas, notas,
 * marketing.
 */

export type BusinessType = "barberia" | "peluqueria" | "estetica" | "unisex";

export const BUSINESS_TYPES: BusinessType[] = ["barberia", "peluqueria", "estetica", "unisex"];

/* ---------------------------------------------------------------------- */
/* Inferir el tipo a partir de texto libre (tagline, nombre de la ficha)   */
/* ---------------------------------------------------------------------- */

interface Rule {
  test: RegExp;
  type: BusinessType;
}

// El orden importa: gana la primera regla que encaje. "unisex" va antes que
// "peluquer" porque "Peluquería unisex" contiene las dos palabras.
const RULES: Rule[] = [
  { test: /unisex/i, type: "unisex" },
  { test: /barber|barbería|barberia|caballero|shave|\bmen\b/i, type: "barberia" },
  {
    test: /est[ée]tica|belleza|beauty|nails?|u[ñn]as|\bspa\b|manicura|solarium/i,
    type: "estetica",
  },
  { test: /peluquer|estilista|hair|sal[oó]n|señoras|senoras/i, type: "peluqueria" },
];

/**
 * Deduce el tipo a partir de cualquier texto que describa el negocio — el
 * tagline que viaja en el enlace de la demo, o el nombre de la ficha al
 * generarla en lote. Nunca cae en "barbería" por defecto: sin pistas se
 * asume peluquería, que es el oficio más frecuente del rutero y el que menos
 * desentona si la deducción se equivoca.
 */
export function inferBusinessType(...texts: Array<string | undefined>): BusinessType {
  const text = texts.filter(Boolean).join(" ");
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.type;
  }
  return "peluqueria";
}

/* ---------------------------------------------------------------------- */
/* Rótulos y palabras                                                     */
/* ---------------------------------------------------------------------- */

/** Rótulo bajo el nombre cuando se genera una demo en app.demos.tsx. */
export const BUSINESS_LABEL: Record<BusinessType, string> = {
  barberia: "Barbería",
  peluqueria: "Peluquería",
  estetica: "Peluquería y estética",
  unisex: "Peluquería unisex",
};

const PROFESSIONAL_WORD: Record<BusinessType, { singular: string; plural: string }> = {
  barberia: { singular: "barbero", plural: "barberos" },
  peluqueria: { singular: "estilista", plural: "estilistas" },
  estetica: { singular: "estilista", plural: "estilistas" },
  unisex: { singular: "profesional", plural: "profesionales" },
};

/** "barbero" / "estilista" / "profesional", en singular o plural. */
export function professionalWord(type: BusinessType, plural = false): string {
  return plural ? PROFESSIONAL_WORD[type].plural : PROFESSIONAL_WORD[type].singular;
}

/* ---------------------------------------------------------------------- */
/* Catálogo de servicios                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Los seis ids "corte", "corte-barba", "barba", "afeitado", "infantil" y
 * "cejas" existen en los cuatro catálogos a propósito: son los que usan las
 * citas de ejemplo generadas por `mock/seed.ts`. Reinterpretarlos por tipo
 * (en vez de inventar ids nuevos) hace que una cita antigua siga resolviendo
 * a un nombre y un precio válidos aunque cambie el tipo de negocio activo.
 * Cada catálogo puede añadir ids propios además de esos seis.
 */
export const SERVICE_CATALOG: Record<BusinessType, Service[]> = {
  barberia: [
    {
      id: "corte",
      name: "Corte de caballero",
      description: "Lavado, corte y acabado.",
      durationMin: 30,
      priceEur: 15,
      category: "Cortes",
      active: true,
    },
    {
      id: "degradado",
      name: "Degradado",
      description: "Corte a máquina con desvanecido y perfilado a navaja.",
      durationMin: 35,
      priceEur: 18,
      category: "Cortes",
      active: true,
    },
    {
      id: "corte-barba",
      name: "Corte y barba",
      description: "El corte completo más el arreglo de barba.",
      durationMin: 45,
      priceEur: 23,
      category: "Cortes",
      active: true,
    },
    {
      id: "barba",
      name: "Arreglo de barba",
      description: "Toalla caliente, perfilado y aceite.",
      durationMin: 20,
      priceEur: 10,
      category: "Barba y afeitado",
      active: true,
    },
    {
      id: "afeitado",
      name: "Afeitado a navaja",
      description: "Afeitado clásico con toalla caliente y bálsamo.",
      durationMin: 30,
      priceEur: 16,
      category: "Barba y afeitado",
      active: true,
    },
    {
      id: "infantil",
      name: "Corte infantil",
      description: "Hasta 12 años, sin prisa.",
      durationMin: 25,
      priceEur: 12,
      category: "Cortes",
      active: true,
    },
    {
      id: "cejas",
      name: "Perfilado de cejas",
      description: "Con navaja o pinza.",
      durationMin: 10,
      priceEur: 5,
      category: "Barba y afeitado",
      active: true,
    },
  ],
  peluqueria: [
    {
      id: "corte",
      name: "Corte de señora",
      description: "Lavado, corte y secado de mano.",
      durationMin: 40,
      priceEur: 22,
      category: "Cortes",
      active: true,
    },
    {
      id: "corte-barba",
      name: "Corte y peinado",
      description: "Corte a medida y peinado de salida.",
      durationMin: 55,
      priceEur: 32,
      category: "Cortes",
      active: true,
    },
    {
      id: "color",
      name: "Color",
      description: "Cobertura de canas o cambio de color en un solo tono.",
      durationMin: 75,
      priceEur: 45,
      category: "Color",
      active: true,
    },
    {
      id: "afeitado",
      name: "Mechas o balayage",
      description: "Iluminación con técnica de mechas o balayage.",
      durationMin: 120,
      priceEur: 85,
      category: "Color",
      active: true,
    },
    {
      id: "barba",
      name: "Tratamiento de keratina",
      description: "Alisado y nutrición profunda del cabello.",
      durationMin: 90,
      priceEur: 65,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "hidratacion",
      name: "Hidratación profunda",
      description: "Mascarilla nutritiva de salón, indicada para cabello dañado.",
      durationMin: 30,
      priceEur: 20,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "recogido",
      name: "Recogido de fiesta",
      description: "Recogido para bodas, comuniones y eventos.",
      durationMin: 60,
      priceEur: 40,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "cejas",
      name: "Diseño de cejas",
      description: "Perfilado y tinte de cejas.",
      durationMin: 15,
      priceEur: 8,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "infantil",
      name: "Corte infantil",
      description: "Hasta 12 años, sin prisa.",
      durationMin: 25,
      priceEur: 14,
      category: "Cortes",
      active: true,
    },
  ],
  estetica: [
    {
      id: "corte",
      name: "Corte de señora",
      description: "Lavado, corte y secado de mano.",
      durationMin: 40,
      priceEur: 22,
      category: "Cortes",
      active: true,
    },
    {
      id: "corte-barba",
      name: "Corte y peinado",
      description: "Corte a medida y peinado de salida.",
      durationMin: 55,
      priceEur: 32,
      category: "Cortes",
      active: true,
    },
    {
      id: "color",
      name: "Color",
      description: "Cobertura de canas o cambio de color en un solo tono.",
      durationMin: 75,
      priceEur: 45,
      category: "Color",
      active: true,
    },
    {
      id: "afeitado",
      name: "Mechas o balayage",
      description: "Iluminación con técnica de mechas o balayage.",
      durationMin: 120,
      priceEur: 85,
      category: "Color",
      active: true,
    },
    {
      id: "barba",
      name: "Tratamiento de keratina",
      description: "Alisado y nutrición profunda del cabello.",
      durationMin: 90,
      priceEur: 65,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "hidratacion",
      name: "Hidratación profunda",
      description: "Mascarilla nutritiva de salón, indicada para cabello dañado.",
      durationMin: 30,
      priceEur: 20,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "recogido",
      name: "Recogido de fiesta",
      description: "Recogido para bodas, comuniones y eventos.",
      durationMin: 60,
      priceEur: 40,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "manicura",
      name: "Manicura",
      description: "Limado, esmaltado y cuidado de manos.",
      durationMin: 40,
      priceEur: 18,
      category: "Uñas y estética",
      active: true,
    },
    {
      id: "pedicura",
      name: "Pedicura",
      description: "Tratamiento completo de pies.",
      durationMin: 50,
      priceEur: 25,
      category: "Uñas y estética",
      active: true,
    },
    {
      id: "depilacion-cera",
      name: "Depilación con cera",
      description: "Piernas, axilas o labio superior, a elegir.",
      durationMin: 30,
      priceEur: 15,
      category: "Uñas y estética",
      active: true,
    },
    {
      id: "cejas",
      name: "Diseño y depilación de cejas",
      description: "Perfilado, depilación y tinte de cejas.",
      durationMin: 20,
      priceEur: 10,
      category: "Uñas y estética",
      active: true,
    },
    {
      id: "infantil",
      name: "Corte infantil",
      description: "Hasta 12 años, sin prisa.",
      durationMin: 25,
      priceEur: 14,
      category: "Cortes",
      active: true,
    },
  ],
  unisex: [
    {
      id: "corte",
      name: "Corte",
      description: "Lavado, corte y acabado, a tu gusto.",
      durationMin: 35,
      priceEur: 18,
      category: "Cortes",
      active: true,
    },
    {
      id: "corte-barba",
      name: "Corte y barba",
      description: "El corte completo más el arreglo de barba.",
      durationMin: 50,
      priceEur: 26,
      category: "Cortes",
      active: true,
    },
    {
      id: "barba",
      name: "Arreglo de barba",
      description: "Toalla caliente, perfilado y aceite.",
      durationMin: 20,
      priceEur: 10,
      category: "Barba y afeitado",
      active: true,
    },
    {
      id: "afeitado",
      name: "Color o mechas",
      description: "Cambio de color, mechas o balayage.",
      durationMin: 90,
      priceEur: 60,
      category: "Color",
      active: true,
    },
    {
      id: "peinado",
      name: "Peinado y brushing",
      description: "Secado y peinado de salida.",
      durationMin: 30,
      priceEur: 20,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "cejas",
      name: "Diseño de cejas",
      description: "Perfilado de cejas.",
      durationMin: 15,
      priceEur: 8,
      category: "Tratamientos",
      active: true,
    },
    {
      id: "infantil",
      name: "Corte infantil",
      description: "Hasta 12 años, sin prisa.",
      durationMin: 25,
      priceEur: 12,
      category: "Cortes",
      active: true,
    },
  ],
};

/** Orden de categorías al mostrar el catálogo: el orden en que aparecen en el array de arriba. */
export function categoryOrderFor(type: BusinessType): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const s of SERVICE_CATALOG[type]) {
    const cat = s.category ?? "Otros";
    if (!seen.has(cat)) {
      seen.add(cat);
      order.push(cat);
    }
  }
  return order;
}

/** Cuatro servicios representativos para la sección "Servicios destacados" de la home. */
export const FEATURED_IDS_BY_TYPE: Record<BusinessType, string[]> = {
  barberia: ["corte", "corte-barba", "barba", "afeitado"],
  peluqueria: ["corte", "corte-barba", "color", "barba"],
  estetica: ["corte-barba", "color", "manicura", "cejas"],
  unisex: ["corte", "corte-barba", "afeitado", "cejas"],
};

/* ---------------------------------------------------------------------- */
/* Equipo de ejemplo                                                      */
/* ---------------------------------------------------------------------- */

/**
 * Las tres fotos de stock del equipo (`stylist-mario.jpg` y compañía) son
 * hombres con barba sujetando tijeras de barbero: sirven para la barbería y
 * desentonan en cualquier otro tipo. Fuera de barbería no se muestra foto —
 * se genera un avatar de iniciales sobre el mismo color de marca de cada id,
 * igual que hace `StylistAvatar` cuando no recibe foto.
 */
export const EMPLOYEE_OVERLAY: Record<BusinessType, Record<EmployeeId, { name: string; specialty: string }>> = {
  barberia: {
    mario: { name: "Mario", specialty: "Cortes clásicos y degradados" },
    diego: { name: "Diego", specialty: "Degradados y diseño" },
    ruben: { name: "Ruben", specialty: "Barba y afeitado a navaja" },
  },
  peluqueria: {
    mario: { name: "Marta", specialty: "Cortes y color" },
    diego: { name: "Elena", specialty: "Mechas y balayage" },
    ruben: { name: "Rocío", specialty: "Tratamientos y recogidos" },
  },
  estetica: {
    mario: { name: "Marta", specialty: "Color y tratamientos" },
    diego: { name: "Elena", specialty: "Mechas y balayage" },
    ruben: { name: "Rocío", specialty: "Manicura, pedicura y depilación" },
  },
  unisex: {
    mario: { name: "Alex", specialty: "Cortes clásicos y degradados" },
    diego: { name: "Sam", specialty: "Color y mechas" },
    ruben: { name: "Rubén", specialty: "Barba y afeitado a navaja" },
  },
};

export function showsRealPhotos(type: BusinessType): boolean {
  return type === "barberia";
}

const AVATAR_COLOR_HEX: Record<EmployeeId, string> = {
  mario: "#a63a52",
  diego: "#3f6fa8",
  ruben: "#4a4a4a",
};

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Avatar de iniciales como data-URI, para cuando no hay foto real que mostrar. */
export function placeholderAvatar(name: string, employeeId: EmployeeId): string {
  const hex = AVATAR_COLOR_HEX[employeeId] ?? "#8a6a3b";
  const label = initialsOf(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" rx="120" fill="${hex}"/><text x="120" y="136" font-family="system-ui,-apple-system,sans-serif" font-size="88" font-weight="600" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---------------------------------------------------------------------- */
/* Clientas y clientes de ejemplo                                         */
/* ---------------------------------------------------------------------- */

/**
 * Nombres de pila para el seed de clientes, ciclados en orden (no al azar):
 * la proporción de cada lista es la que decide si el salón se ve "de
 * señoras" o "de caballeros" en el panel, no un sorteo.
 */
export const FIRST_NAMES_BY_TYPE: Record<BusinessType, string[]> = {
  // ~80% nombres masculinos: coherente con una barbería, sin ser exclusivo.
  barberia: [
    "Mateo",
    "Diego",
    "Alejandro",
    "Pablo",
    "Hugo",
    "Bruno",
    "Nicolas",
    "Javier",
    "Marcos",
    "Andres",
    "Tomas",
    "Emilio",
    "Carlos",
    "Ruben",
    "Ivan",
    "Sergio",
    "Adrian",
    "Manuel",
    "Jorge",
    "Raul",
    "Carmen",
    "Elena",
    "Paula",
    "Daniela",
  ],
  // ~85% nombres femeninos: mayoría de clientas, como pide una peluquería de señoras.
  peluqueria: [
    "Sofia",
    "Lucia",
    "Carmen",
    "Valentina",
    "Elena",
    "Martina",
    "Adriana",
    "Camila",
    "Paula",
    "Daniela",
    "Isabella",
    "Renata",
    "Marta",
    "Nuria",
    "Cristina",
    "Alicia",
    "Laura",
    "Ana",
    "Beatriz",
    "Silvia",
    "Diego",
    "Mateo",
    "Pablo",
  ],
  estetica: [
    "Sofia",
    "Lucia",
    "Carmen",
    "Valentina",
    "Elena",
    "Martina",
    "Adriana",
    "Camila",
    "Paula",
    "Daniela",
    "Isabella",
    "Renata",
    "Marta",
    "Nuria",
    "Cristina",
    "Alicia",
    "Laura",
    "Ana",
    "Beatriz",
    "Silvia",
    "Diego",
    "Mateo",
    "Pablo",
  ],
  // Mezcla equilibrada: la lista original del seed, sin sesgo de género.
  unisex: [
    "Sofia",
    "Lucia",
    "Mateo",
    "Diego",
    "Carmen",
    "Alejandro",
    "Valentina",
    "Pablo",
    "Elena",
    "Hugo",
    "Martina",
    "Bruno",
    "Adriana",
    "Nicolas",
    "Camila",
    "Javier",
    "Paula",
    "Marcos",
    "Daniela",
    "Andres",
    "Isabella",
    "Tomas",
    "Renata",
    "Emilio",
  ],
};

export const LAST_NAMES = [
  "Garcia",
  "Lopez",
  "Martin",
  "Ruiz",
  "Vega",
  "Torres",
  "Romero",
  "Castillo",
  "Navarro",
  "Iglesias",
  "Serrano",
  "Mendoza",
  "Reyes",
  "Ortega",
  "Delgado",
  "Cortes",
];

/**
 * Un par de notas de ejemplo aplicadas a las primeras clientas/clientes del
 * seed, para que la ficha de cliente del panel no aparezca vacía. "Le
 * vendimos el champú de árbol de té" sirve para cualquier tipo; "usa el
 * número 8" solo tiene sentido en barbería, y su equivalente en un salón de
 * señoras es la raíz.
 */
export const EXAMPLE_CLIENT_NOTES: Record<BusinessType, string[]> = {
  barberia: [
    "Usa el número 8 en los laterales.",
    "Le vendimos el champú de árbol de té, preguntarle qué tal.",
    "Prefiere la barba más corta que la última vez.",
  ],
  peluqueria: [
    "Retoque de raíz cada 5 semanas.",
    "Le vendimos el champú de árbol de té, preguntarle qué tal.",
    "Alérgica al amoníaco: usar tinte sin amoníaco.",
  ],
  estetica: [
    "Retoque de raíz cada 5 semanas.",
    "Le vendimos el champú de árbol de té, preguntarle qué tal.",
    "Pide siempre esmalte semipermanente en las manos.",
  ],
  unisex: [
    "Le vendimos el champú de árbol de té, preguntarle qué tal.",
    "Usa el número 8 en los laterales.",
    "Retoque de raíz cada 5 semanas.",
  ],
};

/** Aplica las notas de ejemplo a los primeros clientes de una lista, sin mutar la entrada. */
export function withExampleNotes(clients: Client[], type: BusinessType): Client[] {
  const notes = EXAMPLE_CLIENT_NOTES[type];
  return clients.map((c, i) => (notes[i] ? { ...c, notes: notes[i] } : c));
}
