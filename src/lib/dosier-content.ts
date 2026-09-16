import type { BusinessType } from "./business-type";

/**
 * Textos y vocabulario del dosier comercial imprimible (`/s/$salonSlug/dosier`).
 *
 * Puerto fiel del generador Python de referencia (`gen2.py`, versión del
 * 16-sep-2026) a React. Dos desviaciones deliberadas respecto al literal del
 * script, ambas para no romper la concordancia de género en español:
 *
 *  1. La frase "{persona} la coge sola" concuerda el adjetivo con "hora"
 *     (femenino, el objeto) en vez de con "persona" (el sujeto): en
 *     barbería, con persona="el cliente", el script produce "el cliente la
 *     coge sola", que es incorrecto. Aquí se añade `soloSola` para que
 *     concuerde con el sujeto de cada tipo.
 *  2. "el móvil de {persona.split()[-1]}" pierde el artículo ("de cliente"
 *     en vez de "del cliente", "de clienta" en vez de "de la clienta").
 *     Aquí se sustituye por "su móvil", que es correcto para los cuatro
 *     tipos sin reconstruir el artículo.
 *
 * El resto del contenido — textos, orden, HTML — reproduce el script al
 * carácter.
 */

export interface DosierTypeInfo {
  eyebrow: string;
  clientela: string;
  clientelaCap: string;
  clienteSing: string;
  lugar: string;
  serviciosLista: string;
  ejemplos: string[];
  stylists: string[];
  customers: string[];
  quien: string;
  persona: string;
  personaCap: string;
  nuevas: string;
  deSiempre: string;
  personalLine: string;
  /** "solo" o "sola": concuerda con el sujeto de `persona` en cada tipo. */
  soloSola: string;
}

const MALE_STYLISTS = [
  "Javi",
  "Álex",
  "Diego",
  "Sergio",
  "Iván",
  "Rubén",
  "Marcos",
  "Adrián",
  "Hugo",
  "Nacho",
];
const FEMALE_STYLISTS = [
  "Sonia",
  "Laura",
  "Marta",
  "Elena",
  "Cristina",
  "Paula",
  "Noelia",
  "Andrea",
  "Rocío",
  "Irene",
];
const MALE_CUSTOMERS = [
  "Pedro Rotger",
  "Álvaro Núñez",
  "Diego Molina",
  "Jorge Peña",
  "Iván Cabrera",
  "Rubén Aguado",
  "Pablo Vidal",
  "Mario Esteban",
];
const FEMALE_CUSTOMERS = [
  "Marisa Cano",
  "Lucía Ferrer",
  "Carla Ibáñez",
  "Rocío Serra",
  "Marta Solís",
  "Nuria Prats",
  "Sara Montes",
  "Elena Garrido",
];

export const DOSIER_TYPE_INFO: Record<BusinessType, DosierTypeInfo> = {
  barberia: {
    eyebrow: "Software de reservas para barberías",
    clientela: "tus clientes",
    clientelaCap: "Tus clientes",
    clienteSing: "un cliente",
    lugar: "tu barbería",
    serviciosLista: "corte, arreglo de barba, afeitado a navaja o degradado",
    ejemplos: ["Corte + barba · con {n}", "Afeitado a navaja · con {n}", "Degradado + barba · con {n}"],
    stylists: MALE_STYLISTS,
    customers: MALE_CUSTOMERS,
    quien: "el barbero",
    persona: "el cliente",
    personaCap: "El cliente",
    nuevas: "Los clientes nuevos",
    deSiempre: "los de siempre",
    personalLine: "Quién le corta a cada cliente y cuánto dura cada corte lo decides tú.",
    soloSola: "solo",
  },
  peluqueria: {
    eyebrow: "Software de reservas para peluquerías",
    clientela: "tus clientas",
    clientelaCap: "Tus clientas",
    clienteSing: "una clienta",
    lugar: "tu salón",
    serviciosLista: "corte, color, mechas, tratamiento o peinado",
    ejemplos: [
      "Color + corte · con {n}",
      "Mechas + corte · con {n}",
      "Tratamiento de keratina · con {n}",
    ],
    stylists: FEMALE_STYLISTS,
    customers: FEMALE_CUSTOMERS,
    quien: "la estilista",
    persona: "la clienta",
    personaCap: "La clienta",
    nuevas: "Las clientas nuevas",
    deSiempre: "las de siempre",
    personalLine: "Quién atiende a cada clienta y cuánto dura su color lo decides tú.",
    soloSola: "sola",
  },
  estetica: {
    eyebrow: "Software de reservas para peluquerías y salones de belleza",
    clientela: "tus clientas",
    clientelaCap: "Tus clientas",
    clienteSing: "una clienta",
    lugar: "tu centro",
    serviciosLista: "corte, color, tratamiento, manicura o cejas",
    ejemplos: ["Manicura + corte · con {n}", "Color + cejas · con {n}", "Corte + peinado · con {n}"],
    stylists: FEMALE_STYLISTS,
    customers: FEMALE_CUSTOMERS,
    quien: "la profesional",
    persona: "la clienta",
    personaCap: "La clienta",
    nuevas: "Las clientas nuevas",
    deSiempre: "las de siempre",
    personalLine: "Quién atiende a cada clienta y cuánto dura cada tratamiento lo decides tú.",
    soloSola: "sola",
  },
  unisex: {
    eyebrow: "Software de reservas para peluquerías",
    clientela: "tu clientela",
    clientelaCap: "Tu clientela",
    clienteSing: "alguien",
    lugar: "tu salón",
    serviciosLista: "corte, color o tratamiento",
    ejemplos: ["Corte · con {n}", "Color + corte · con {n}"],
    stylists: [...MALE_STYLISTS, ...FEMALE_STYLISTS],
    customers: [...MALE_CUSTOMERS, ...FEMALE_CUSTOMERS],
    quien: "quien atiende",
    persona: "la persona",
    personaCap: "La persona",
    nuevas: "Las personas nuevas",
    deSiempre: "las de siempre",
    personalLine: "Quién atiende a cada persona y cuánto dura cada cita lo decides tú.",
    soloSola: "sola",
  },
};

/** Pie de página por tipo: "siShow · reservas y agenda para …". */
export function footerFor(info: DosierTypeInfo): string {
  return `siShow · ${info.eyebrow.replace("Software de reservas", "reservas y agenda")}`;
}

/**
 * Índice estable a partir del nombre del salón (no al azar): abrir el mismo
 * enlace de demo dos veces tiene que dar siempre el mismo estilista y el
 * mismo ejemplo de reserva.
 */
function hashIndex(name: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return mod > 0 ? h % mod : 0;
}

export function headlineSize(name: string): number {
  const n = name.length;
  return n <= 12 ? 44 : n <= 20 ? 37 : n <= 30 ? 29 : n <= 42 ? 23 : 18;
}

export function bookingHeaderSize(name: string): number {
  const n = name.length;
  return n <= 20 ? 15 : n <= 32 ? 12.5 : n <= 45 ? 10.5 : 9;
}

export interface DosierTexts {
  nombre: string;
  tipo: BusinessType;
  info: DosierTypeInfo;
  headlineL1: string;
  headlineL2: string;
  headlineSizePt: number;
  bookingHeaderSizePt: number;
  bookingCliente: string;
  bookingServicio: string;
  footer: string;
}

export function buildDosierTexts(nombre: string, tipo: BusinessType): DosierTexts {
  const info = DOSIER_TYPE_INFO[tipo];
  const idx = hashIndex(nombre, 97);
  const stylist = info.stylists[idx % info.stylists.length];
  const customer = info.customers[idx % info.customers.length];
  const ejemplo = info.ejemplos[idx % info.ejemplos.length].replace("{n}", stylist);
  return {
    nombre,
    tipo,
    info,
    headlineL1: `Tu agenda, ${nombre}.`,
    headlineL2: `${info.clientelaCap}. Sin comisión.`,
    headlineSizePt: headlineSize(nombre),
    bookingHeaderSizePt: bookingHeaderSize(nombre),
    bookingCliente: customer,
    bookingServicio: ejemplo,
    footer: footerFor(info),
  };
}
