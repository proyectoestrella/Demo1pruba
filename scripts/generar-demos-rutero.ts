/**
 * Genera enlaces de demostración para el rutero del 20 y 22 de octubre.
 *
 * Lee exclusivamente los datos visibles del rutero y las dos semillas indicadas
 * en la entrega. No copia teléfonos: ni al repositorio ni a los enlaces.
 *
 * Uso: bun scripts/generar-demos-rutero.ts
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  decodeDemoProfile,
  encodeDemoProfile,
  slugify,
  type DemoProfile,
} from "../src/lib/demo-profile";

const RUTERO =
  "/home/tomi/Documents/logibro/AlmacenExterno/siShow-prospeccion-whatsapp/rutero-20-22-oct-artifact.html";
const LEADS = "/home/tomi/Documents/siShow-interno-funnel/src/seed/leads.json";
const DEMOS = "/home/tomi/Documents/siShow-interno-funnel/src/seed/demos.json";
const OUTPUT = "/home/tomi/Documents/logibro/AlmacenExterno/starproyect-demos-2026-10-20";
const LOCAL = "http://localhost:8130";
const PRODUCCION = "https://prueba28juliokt.vercel.app";

type Parada = {
  bloque: string;
  fecha: string;
  hora: string;
  tipo: string;
  negocio: string;
  direccion: string;
  nota: string;
};
type Lead = Record<string, unknown>;
type DemoSemilla = Record<string, unknown>;

const sinAcentos = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const clave = (texto: string) =>
  sinAcentos(texto)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// Quita las notas internas del rutero: lo que va entre paréntesis (estado del
// lead, dirección alternativa) y los comentarios tras « · «…»» o « · ».
const limpiaNombre = (texto: string) =>
  texto
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*[·|]\s*[«"“].*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
// Deja la mejor dirección: sin paréntesis ni alternativas «(o …)» / « o …».
const limpiaDireccion = (texto: string) =>
  texto
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+o\s+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
const textoHtml = (html: string) =>
  html
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const contenido = (html: string, clase: string) =>
  textoHtml(
    html.match(
      new RegExp(
        `<[^>]*\\bclass=["'][^"']*\\b${clase}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
        "i",
      ),
    )?.[1] ?? "",
  );
const csv = (valor: unknown) => `"${String(valor ?? "").replaceAll('"', '""')}"`;

// Datos publicados que ya se verificaron para la visita de Nelva (ver el
// generador de referencia citado en la entrega). No lleva teléfono.
const NELVA: Partial<DemoProfile> = {
  tagline: "Peluquería, Estética y Bienestar",
  address: "Av. de la Ermita, 2, Loc 5, 28108 Alcobendas, Madrid, España",
  rating: 4.9,
  reviewCount: 142,
  openingHours: [
    "09:00–21:00",
    "09:00–21:00",
    "09:00–21:00",
    "09:00–21:00",
    "09:00–21:00",
    "09:00–15:00",
    "Cerrado",
  ],
  team: ["Nelva~Estilista y Esteticista", "Natalia~Estilista y Manicurista", "Fátima~Estilista"],
  menu: [
    "Champú + Corte + Peinado~45~43~Peluquería",
    "Champú + Corte~30~25~Peluquería",
    "Champú + Peinado~30~22~Peluquería",
    "Champú + Color~60~38~Color",
    "Champú + Barros (color vegetal)~90~58~Color",
    "100% Gloss~30~20~Color",
    "Alisado con Keratina~120~100~Forma",
    "Corte Él (champú + corte)~30~21~Para Él",
    "Oxigenante VIP O2 con Remodeling~60~90~Estética",
    "Iluminador Pigm 400~60~90~Estética",
    "Booster VIP O2~60~90~Estética",
    "Inyección de Colágeno~30~30~Estética",
  ],
  modulosOcultos: ["equipo"],
  // Fotos propias del salón, de su web pública (nelvaortiz.com). Se piden
  // reducidas (?w=) para que carguen rápido en el móvil.
  heroImage: "https://nelvaortiz.com/wp-content/uploads/2026/03/img_5185.jpeg?w=1600",
  galeriaPropia: [
    { url: "https://nelvaortiz.com/wp-content/uploads/2026/03/img_5193.png?w=1200", alt: "Zona de lavado del salón Nelva Ortiz" },
    { url: "https://nelvaortiz.com/wp-content/uploads/2026/03/img_5155.jpeg?w=1200", alt: "Cabina de estética del salón Nelva Ortiz" },
    { url: "https://nelvaortiz.com/wp-content/uploads/2026/03/img_5210.jpeg?w=1200", alt: "Puestos de peluquería del salón Nelva Ortiz" },
    { url: "https://nelvaortiz.com/wp-content/uploads/2026/03/img_5202.jpeg?w=1200", alt: "Productos del salón Nelva Ortiz" },
    { url: "https://nelvaortiz.com/wp-content/uploads/2026/03/img_5165.jpeg?w=1200", alt: "Tratamientos de estética del salón Nelva Ortiz" },
  ],
};

/** La parte HTML del parser del cuadro de mandos, copiada para no importar su aplicación. */
function leerRutero(html: string): Parada[] {
  const limpio = html.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,
    "",
  );
  const paneles = [
    ...limpio.matchAll(
      /<div\b[^>]*\bid=["']p-(martes|jueves)["'][^>]*>([\s\S]*?)(?=<div\b[^>]*\bid=["']p-|<section(?![^>]*\bclass=["'][^"']*\bcar\b)|$)/gi,
    ),
  ];
  const paradas: Parada[] = [];
  for (const panel of paneles) {
    const fecha = panel[1].toLowerCase() === "jueves" ? "2026-10-22" : "2026-10-20";
    const coches = [
      ...panel[2].matchAll(
        /<section\b[^>]*\bclass=["'][^"']*\bcar\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
      ),
    ];
    for (const coche of coches) {
      const quien = contenido(coche[1], "who") || "Rutero";
      const listas = [
        ...coche[1].matchAll(
          /<ol\b[^>]*\bclass=["'][^"']*\bstops\b[^"']*["'][^>]*>([\s\S]*?)<\/ol>/gi,
        ),
      ];
      for (const lista of listas) {
        const items = [...lista[1].matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)];
        for (const item of items) {
          const clases = item[1];
          const cuerpo = item[2];
          if (!/\bstop\b/i.test(clases)) continue;
          const tipo = /\bcita\b/i.test(clases)
            ? "Cita"
            : /\brevisita\b/i.test(clases)
              ? "Revisita"
              : /\bnueva\b/i.test(clases)
                ? "Nueva"
                : /\blibre\b/i.test(clases)
                  ? "Hueco"
                  : "";
          const negocio = contenido(cuerpo, "name");
          if (!negocio) continue;
          paradas.push({
            bloque: `${fecha} · ${quien}`,
            fecha,
            hora: contenido(cuerpo, "time"),
            tipo: /si sobra/i.test(contenido(cuerpo, "time")) ? "Si sobra" : tipo,
            negocio,
            direccion: contenido(cuerpo, "addr"),
            nota: contenido(cuerpo, "txt"),
          });
        }
      }
    }
  }
  return paradas;
}

function tipoDesde(nombre: string, tipo?: string): string {
  const t = `${tipo ?? ""} ${nombre}`.toLowerCase();
  if (/barber|\bmen\b|caballero/.test(t)) return "Barbería";
  if (/est[ée]tica|belleza|nails|uñas|solarium/.test(t)) return "Peluquería y estética";
  if (/unisex/.test(t)) return "Peluquería unisex";
  return "Peluquería";
}

function menuDeEjemplo(tipo: string): string[] {
  if (/barber/i.test(tipo))
    return [
      "Corte (ejemplo)~30~15~Servicios de ejemplo",
      "Corte y barba (ejemplo)~45~23~Servicios de ejemplo",
      "Arreglo de barba (ejemplo)~20~10~Servicios de ejemplo",
    ];
  if (/estética/i.test(tipo))
    return [
      "Corte y peinado (ejemplo)~55~32~Servicios de ejemplo",
      "Color (ejemplo)~90~45~Servicios de ejemplo",
      "Manicura (ejemplo)~45~22~Servicios de ejemplo",
    ];
  return [
    "Corte y peinado (ejemplo)~55~32~Servicios de ejemplo",
    "Color (ejemplo)~90~45~Servicios de ejemplo",
    "Peinado (ejemplo)~40~25~Servicios de ejemplo",
  ];
}

function buscar<T extends Record<string, unknown>>(
  filas: T[],
  nombre: string,
  direccion: string,
): T | undefined {
  const n = clave(nombre);
  const d = clave(direccion);
  return (
    filas.find((fila) => clave(String(fila.nombre ?? "")) === n) ??
    filas.find((fila) => {
      const fn = clave(String(fila.nombre ?? ""));
      const fd = clave(String(fila.direccion ?? ""));
      return (
        fn && (n.includes(fn) || fn.includes(n)) && (!d || !fd || d.includes(fd) || fd.includes(d))
      );
    })
  );
}

// Fotos de la ficha de Google del propio negocio (id y posiciones sacados con
// scripts/buscar-fotos-places.ts y elegidos a ojo). Salen por el proxy
// /api/foto de producción, que tiene la clave de Places.
const FOTOS_PLACES: Record<string, { place: string; hero: number; galeria: [number, string][] }> = {
  "dhf estilistas": {
    place: "ChIJeyAfNQAtQg0RnZXzn0_Lg2Y",
    hero: 0,
    galeria: [
      [1, "Fachada de DHF Estilistas"],
      [3, "Ondas con balayage, trabajo de DHF Estilistas"],
      [5, "Rubio ceniza, trabajo de DHF Estilistas"],
      [7, "Ondas castañas, trabajo de DHF Estilistas"],
      [8, "Degradado rubio, trabajo de DHF Estilistas"],
    ],
  },
  "the heirs peluqueros": {
    place: "ChIJGVUGmMIpQg0RkM1rEXdqNZw",
    hero: 0,
    galeria: [
      [3, "Zona de lavado y Color Bar de The Heirs Peluqueros"],
      [4, "Recepción de The Heirs Peluqueros"],
      [5, "Fachada de The Heirs Peluqueros"],
      [8, "Color Bar de The Heirs Peluqueros"],
    ],
  },
  "mino barber shop": {
    place: "ChIJLZ1wkqIpQg0RJeZVrIlbceg",
    hero: 5,
    galeria: [
      [8, "Interior de Mino Barber Shop"],
      [3, "Puesto de trabajo en Mino Barber Shop"],
      [9, "Afeitado clásico en Mino Barber Shop"],
      [2, "Fachada de Mino Barber Shop"],
    ],
  },
  "peluqueria unisex latin fire": {
    place: "ChIJg0vr4iYtQg0R7ZTX4tqSCyc",
    hero: 0,
    galeria: [
      [3, "Rubios, trabajo de Latín Fire"],
      [5, "Antes y después, trabajo de Latín Fire"],
      [6, "Color fantasía, trabajo de Latín Fire"],
      [7, "Mechas, trabajo de Latín Fire"],
      [9, "Alisado, trabajo de Latín Fire"],
    ],
  },
  "ykono hair studio": {
    place: "ChIJX59atZctQg0RLHvCM0wz6xM",
    hero: 1,
    galeria: [
      [2, "Interior de Ykono Hair Studio"],
      [5, "Interior de Ykono Hair Studio"],
      [6, "Productos en Ykono Hair Studio"],
      [0, "Fachada de Ykono Hair Studio"],
    ],
  },
  "esencia peluqueria organica": {
    place: "ChIJXeURQpMtQg0RQD_qxolFNsA",
    hero: 3,
    galeria: [
      [1, "Fachada de Esencia Peluquería Orgánica"],
      [2, "Trabajo de Esencia Peluquería Orgánica"],
      [4, "Trabajo de Esencia Peluquería Orgánica"],
      [6, "Trabajo de Esencia Peluquería Orgánica"],
    ],
  },
  "salon madrid": {
    place: "ChIJk4y2VQAtQg0RVGQwtG2WWSI",
    hero: 1,
    galeria: [
      [0, "Fachada de Salón Madrid"],
      [3, "Fachada de Salón Madrid"],
    ],
  },
  "peluqueria ainos estilistas": {
    place: "ChIJbRc-TfIsQg0RKz-zMlK65sQ",
    hero: 2,
    galeria: [
      [0, "Trabajo de Peluquería Ainos Estilistas"],
      [3, "Trabajo de Peluquería Ainos Estilistas"],
      [4, "Trabajo de Peluquería Ainos Estilistas"],
      [6, "Trabajo de Peluquería Ainos Estilistas"],
    ],
  },
  "peluqueria unisex yonitami": {
    place: "ChIJO4hZPI0sQg0RaugH7vPf4Nw",
    hero: 0,
    galeria: [

    ],
  },
  "aqua estilistas": {
    place: "ChIJw3PUNNYtQg0R8_TC5fIX-HQ",
    hero: 0,
    galeria: [

    ],
  },
  "ares peluqueria": {
    place: "ChIJt9EkipIsQg0R45aS3lg5RtA",
    hero: 5,
    galeria: [
      [4, "Fachada de Ares Peluquería"],
      [7, "Trabajo de Ares Peluquería"],
      [8, "Trabajo de Ares Peluquería"],
      [3, "Trabajo de Ares Peluquería"],
    ],
  },
  "david y jorge peluqueros": {
    place: "ChIJVVVFDu0sQg0R7DsAhPp8qBg",
    hero: 4,
    galeria: [
      [0, "Interior de David y Jorge Peluqueros"],
      [5, "Interior de David y Jorge Peluqueros"],
      [1, "Trabajo de David y Jorge Peluqueros"],
      [8, "Trabajo de David y Jorge Peluqueros"],
      [7, "Trabajo de David y Jorge Peluqueros"],
    ],
  },
  "mario s peluqueros": {
    place: "ChIJ8y6mH50sQg0R3e_H7GSf1Mo",
    hero: 4,
    galeria: [
      [1, "Interior de Mario's Peluqueros"],
      [0, "Trabajo de Mario's Peluqueros"],
      [6, "Trabajo de Mario's Peluqueros"],
      [3, "Trabajo de Mario's Peluqueros"],
    ],
  },
  "peluqueria g rey": {
    place: "ChIJlTPNdQotQg0R33S_4x8nMmI",
    hero: 1,
    galeria: [
      [2, "Trabajo de Peluquería G & Rey"],
      [3, "Trabajo de Peluquería G & Rey"],
      [5, "Trabajo de Peluquería G & Rey"],
      [9, "Trabajo de Peluquería G & Rey"],
    ],
  },
  "higueras peluqueros": {
    place: "ChIJaR5MMJIsQg0RcH51tFURa-s",
    hero: 7,
    galeria: [
      [1, "Fachada de Higueras Peluqueros"],
      [3, "Interior de Higueras Peluqueros"],
      [4, "Interior de Higueras Peluqueros"],
      [8, "Interior de Higueras Peluqueros"],
      [6, "Interior de Higueras Peluqueros"],
    ],
  },
  "peluqueria rafael y juan carlos": {
    place: "ChIJFS7aWt4pQg0RkWYfSlrWwEA",
    hero: 0,
    galeria: [
      [1, "Trabajo de Peluquería Rafael y Juan Carlos"],
      [3, "Trabajo de Peluquería Rafael y Juan Carlos"],
    ],
  },
  "a r peluqueros": {
    place: "ChIJuVoqiHUpQg0RWZ6CfuygMAE",
    hero: 1,
    galeria: [
      [3, "Trabajo de A & R Peluqueros"],
      [7, "Trabajo de A & R Peluqueros"],
      [8, "Trabajo de A & R Peluqueros"],
      [9, "Trabajo de A & R Peluqueros"],
      [5, "Productos en A & R Peluqueros"],
    ],
  },
  "nova peluqueria y estetica": {
    place: "ChIJQ4DAM-0pQg0R3juSU8z29yc",
    hero: 2,
    galeria: [
      [1, "Fachada de Nova Peluquería y Estética"],
      [3, "Trabajo de Nova Peluquería y Estética"],
    ],
  },
  "yolanda orgaz": {
    place: "ChIJEXqE0-wpQg0R3Rdnz2GEVnk",
    hero: 1,
    galeria: [
      [0, "Fachada de Yolanda Orgaz"],
      [3, "Trabajo de Yolanda Orgaz"],
      [4, "Trabajo de Yolanda Orgaz"],
    ],
  },
  "raquel guirao peluqueria": {
    place: "ChIJBVtVqPIpQg0RoOom0t05Gis",
    hero: 1,
    galeria: [
      [2, "Trabajo de Raquel Guirao Peluquería"],
      [5, "Trabajo de Raquel Guirao Peluquería"],
      [7, "Trabajo de Raquel Guirao Peluquería"],
    ],
  },
  "mon peluqueros": {
    place: "ChIJf_TIqfssQg0RXup2Irs7i14",
    hero: 1,
    galeria: [
      [0, "Trabajo de MON Peluqueros"],
    ],
  },
  "dlady peluqueria": {
    place: "ChIJZdw-JLotQg0R-pFUcd8Kpy8",
    hero: 1,
    galeria: [
      [2, "Trabajo de Dlady peluquería"],
      [5, "Trabajo de Dlady peluquería"],
      [8, "Trabajo de Dlady peluquería"],
      [3, "Trabajo de Dlady peluquería"],
    ],
  },
  "dh salon": {
    place: "ChIJh8kaofssQg0RURSq84Rg1qQ",
    hero: 0,
    galeria: [
      [5, "Interior de DH Salon"],
      [6, "Interior de DH Salon"],
      [7, "Interior de DH Salon"],
      [3, "Trabajo de DH Salon"],
    ],
  },
  "peluqueria quinzanos": {
    place: "ChIJcUnOrfosQg0R9WoLlGRTTPU",
    hero: 6,
    galeria: [
      [4, "Trabajo de Peluquería Quinzaños"],
    ],
  },
  "peluqueria platino": {
    place: "ChIJBZDdgygtQg0RTeaxjJvHHzI",
    hero: 0,
    galeria: [
      [3, "Trabajo de Peluquería Platino"],
      [4, "Trabajo de Peluquería Platino"],
      [5, "Trabajo de Peluquería Platino"],
      [7, "Trabajo de Peluquería Platino"],
    ],
  },
  "sanse estilo": {
    place: "ChIJUbA6SKstQg0R6cN6D6aW-QE",
    hero: 2,
    galeria: [
      [3, "Interior de Sanse Estilo"],
      [9, "Trabajo de Sanse Estilo"],
      [6, "Trabajo de Sanse Estilo"],
      [4, "Trabajo de Sanse Estilo"],
    ],
  },
  "wellpel": {
    place: "ChIJBZrt2-UsQg0R2Quy8iZVAGc",
    hero: 0,
    galeria: [
      [2, "Trabajo de WellPel"],
      [4, "Trabajo de WellPel"],
    ],
  },
  "peluqueria hermanos garcia": {
    place: "ChIJAQAMiuQsQg0RnMmXRzC35Hs",
    hero: 2,
    galeria: [
      [3, "Interior de Peluquería Hermanos García"],
      [7, "Interior de Peluquería Hermanos García"],
      [9, "Trabajo de Peluquería Hermanos García"],
      [1, "Fachada de Peluquería Hermanos García"],
    ],
  },
  "la rivera peluqueros": {
    place: "ChIJ9c3p0vwsQg0RhqeTgTSqWL0",
    hero: 0,
    galeria: [
      [2, "Trabajo de La Rivera Peluqueros"],
      [3, "Trabajo de La Rivera Peluqueros"],
    ],
  },
  "color real": {
    place: "ChIJ6a_47eIsQg0RLxrvVWL6y7Q",
    hero: 0,
    galeria: [
      [3, "Trabajo de Color Real"],
      [5, "Trabajo de Color Real"],
      [1, "Fachada de Color Real"],
    ],
  },
  "v r peluqueros estilistas": {
    place: "ChIJRdra4e4sQg0RkY9vpiAhlb0",
    hero: 0,
    galeria: [
      [3, "Interior de V.R. Peluqueros Estilistas"],
      [1, "Fachada de V.R. Peluqueros Estilistas"],
      [5, "Trabajo de V.R. Peluqueros Estilistas"],
      [8, "Trabajo de V.R. Peluqueros Estilistas"],
    ],
  },
  "noah asesores de imagen": {
    place: "ChIJz7JGuO8sQg0RP23JuBUuhPY",
    hero: 1,
    galeria: [
      [2, "Interior de Noah Asesores de Imagen"],
      [3, "Interior de Noah Asesores de Imagen"],
    ],
  },
  "ilussion peluqueros": {
    place: "ChIJkW0b5-4tQg0RR8BXsFPOkE8",
    hero: 8,
    galeria: [
      [0, "Interior de Ilussion Peluqueros"],
      [7, "Interior de Ilussion Peluqueros"],
      [3, "Trabajo de Ilussion Peluqueros"],
      [5, "Interior de Ilussion Peluqueros"],
    ],
  },
  "peluqueria unisex ana rodriguez": {
    place: "ChIJKUtR6SQtQg0RS_hNsSpBS4o",
    hero: 0,
    galeria: [
      [3, "Interior de Peluquería Unisex Ana Rodríguez"],
      [1, "Fachada de Peluquería Unisex Ana Rodríguez"],
    ],
  },
  "rodriguez peluqueros": {
    place: "ChIJHTxQDuYsQg0RSLL67HqnYEQ",
    hero: 9,
    galeria: [
      [0, "Interior de Rodríguez Peluqueros"],
      [3, "Fachada de Rodríguez Peluqueros"],
      [5, "Interior de Rodríguez Peluqueros"],
      [8, "Interior de Rodríguez Peluqueros"],
    ],
  },
  "f p peluqueros": {
    place: "ChIJU5wDGPAsQg0RdCTowVohLwM",
    hero: 5,
    galeria: [
      [0, "Fachada de F P Peluqueros"],
    ],
  },
  "peluqueria a tu estilo": {
    place: "ChIJ3YutwyAtQg0Rl6bwgU4ps24",
    hero: 0,
    galeria: [
      [2, "Fachada de Peluquería A Tu Estilo"],
      [8, "Trabajo de Peluquería A Tu Estilo"],
      [7, "Trabajo de Peluquería A Tu Estilo"],
      [3, "Trabajo de Peluquería A Tu Estilo"],
    ],
  },
};

function perfilDe(
  parada: Parada,
  lead: Lead | undefined,
  demo: DemoSemilla | undefined,
): { profile: Partial<DemoProfile>; reales: string[]; faltan: string[]; minima: boolean } {
  const delEnlace =
    typeof demo?.url_demo === "string"
      ? (decodeDemoProfile(new URL(demo.url_demo).searchParams.get("d") ?? undefined) ?? {})
      : {};
  const nombre = limpiaNombre(parada.negocio);
  const tipo = tipoDesde(nombre, String(demo?.tipo ?? lead?.tipo ?? ""));
  const esNelva = clave(nombre) === "nelva ortiz";
  const profile: Partial<DemoProfile> = {
    ...delEnlace,
    ...(esNelva ? NELVA : {}),
    name: nombre,
    tagline: tipo,
    address: limpiaDireccion(
      String(delEnlace.address || parada.direccion || lead?.direccion || ""),
    ),
    // Nunca se propaga el teléfono de una semilla ni del enlace anterior.
    phone: "",
  };
  const fotos = FOTOS_PLACES[clave(nombre)];
  if (fotos && !profile.heroImage) {
    const u = (i: number) => `/api/foto?place=${fotos.place}&i=${i}`;
    profile.heroImage = u(fotos.hero);
    profile.galeriaPropia = fotos.galeria.map(([i, alt]) => ({ url: u(i), alt }));
  }
  const reales = ["nombre", profile.address ? "dirección" : ""].filter(Boolean) as string[];
  if (profile.rating && profile.reviewCount) reales.push("valoración y reseñas");
  if (profile.openingHours?.some((h) => h && h !== "Cerrado")) reales.push("horario");
  if (profile.team?.length) reales.push("equipo");
  if (profile.menu?.length) reales.push("servicios");
  const faltan: string[] = [];
  if (!(profile.rating && profile.reviewCount)) faltan.push("valoración y reseñas");
  if (!profile.openingHours?.some((h) => h && h !== "Cerrado")) faltan.push("horario");
  if (!profile.team?.length) faltan.push("equipo");
  if (!profile.menu?.length) {
    profile.menu = menuDeEjemplo(tipo);
    faltan.push("servicios reales (carta marcada como ejemplo)");
  }
  const minima = parada.tipo === "Nueva" || reales.length <= 2;
  if (minima && !profile.team?.length) {
    // Nada inventado delante de una dueña: sin equipo ficticio. Una sola
    // profesional con el nombre del salón (no hay selector ni nombres de
    // persona) y la sección Equipo oculta en la web pública.
    profile.team = [`${nombre}~Profesional`];
    profile.modulosOcultos = ["equipo"];
  }
  return { profile, reales, faltan, minima };
}

const rutero = leerRutero(readFileSync(RUTERO, "utf8"));
const leads = JSON.parse(readFileSync(LEADS, "utf8")) as Lead[];
const demosJson = JSON.parse(readFileSync(DEMOS, "utf8")) as { demos?: DemoSemilla[] };
const demos = demosJson.demos ?? [];
if (rutero.length !== 58)
  throw new Error(`Se esperaban 58 paradas y se encontraron ${rutero.length}.`);

const filas = rutero.filter((p) => p.tipo !== "Hueco").map((parada) => {
  const nombre = limpiaNombre(parada.negocio);
  const lead = buscar(leads, nombre, parada.direccion);
  const demo = buscar(demos, nombre, parada.direccion);
  const { profile, reales, faltan, minima } = perfilDe(parada, lead, demo);
  const slug = slugify(profile.name ?? nombre);
  const d = encodeDemoProfile(profile);
  const publicaLocal = `${LOCAL}/s/${slug}?d=${d}`;
  const publicaProduccion = `${PRODUCCION}/s/${slug}?d=${d}`;
  const panel = `${LOCAL}/demo/${slug}?d=${d}`;
  const panelProduccion = `${PRODUCCION}/app?d=${d}`;
  return {
    parada,
    slug,
    publicaLocal,
    publicaProduccion,
    panel,
    panelProduccion,
    reales,
    faltan,
    minima,
    nota: minima
      ? "Demo mínima honesta: servicios de ejemplo."
      : "Demo con los datos disponibles en las fuentes.",
  };
});

mkdirSync(OUTPUT, { recursive: true, mode: 0o700 });
const cabecera = [
  "bloque",
  "hora",
  "tipo",
  "negocio",
  "slug",
  "url_demo_local_8130",
  "url_demo_produccion",
  "url_panel_local",
  "url_panel_produccion",
  "datos_reales",
  "sin_dato",
  "nota",
];
const contenidoCsv =
  [
    cabecera,
    ...filas.map((f) => [
      f.parada.bloque,
      f.parada.hora,
      f.parada.tipo,
      limpiaNombre(f.parada.negocio),
      f.slug,
      f.publicaLocal,
      f.publicaProduccion,
      f.panel,
      f.panelProduccion,
      f.reales.join("; ") || "sin dato",
      f.faltan.join("; ") || "sin dato",
      f.nota,
    ]),
  ]
    .map((fila) => fila.map(csv).join(","))
    .join("\n") + "\n";
const porBloque = new Map<string, typeof filas>();
for (const fila of filas)
  porBloque.set(fila.parada.bloque, [...(porBloque.get(fila.parada.bloque) ?? []), fila]);
const contenidoMd = [
  "# Demos de visitas · 20 y 22 de octubre de 2026",
  "",
  `Total: ${filas.length}. Completas: ${filas.filter((f) => !f.minima).length}. Mínimas honestas: ${filas.filter((f) => f.minima).length}.`,
  "",
  "Los servicios que no constan en las fuentes se presentan como «ejemplo». Los enlaces no contienen teléfonos.",
  "",
  ...[...porBloque.entries()].flatMap(([bloque, grupo]) => [
    `## ${bloque}`,
    "",
    ...grupo.flatMap((f) => [
      `### ${f.parada.hora} · ${limpiaNombre(f.parada.negocio)} · ${f.parada.tipo || "sin tipo"}`,
      "",
      `- Pública local: ${f.publicaLocal}`,
      `- Producción actual: ${f.publicaProduccion}`,
      `- Panel local: ${f.panel}`,
      `- Panel producción: ${f.panelProduccion}`,
      `- Datos reales: ${f.reales.join(", ") || "sin dato"}.`,
      `- Sin dato: ${f.faltan.join(", ") || "ninguno"}. ${f.nota}`,
      "",
    ]),
  ]),
].join("\n");
const ficheroCsv = join(OUTPUT, "demos-visitas.csv");
const ficheroMd = join(OUTPUT, "demos-visitas.md");
writeFileSync(ficheroCsv, contenidoCsv, { mode: 0o600 });
writeFileSync(ficheroMd, contenidoMd, { mode: 0o600 });
chmodSync(ficheroCsv, 0o600);
chmodSync(ficheroMd, 0o600);
console.log(
  JSON.stringify(
    {
      total: filas.length,
      completas: filas.filter((f) => !f.minima).length,
      minimas: filas.filter((f) => f.minima).length,
      csv: ficheroCsv,
      markdown: ficheroMd,
    },
    null,
    2,
  ),
);
