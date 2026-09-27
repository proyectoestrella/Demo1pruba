/**
 * El borrador de «Mi web»: lo que el dueño está escribiendo antes de publicar.
 *
 * Todo lo que el editor manipula son CADENAS —lo que hay literalmente en cada
 * caja de texto—, y este módulo es el único sitio donde esas cadenas se
 * convierten en un `SalonProfile` y se comprueban. Está aparte de la pantalla
 * a propósito: así la validación y la serialización se pueden probar sin
 * montar React, que es donde de verdad se rompen estas cosas.
 *
 * Dos reglas que no se negocian:
 *
 *   1. **No se publica a medias.** `validarBorrador` devuelve TODOS los fallos
 *      de una vez; si hay uno solo, no se llega a serializar nada.
 *   2. **Lo que no se entiende, no se borra.** Una línea de servicio mal
 *      escrita es un error que se enseña, no una entrada que desaparece en
 *      silencio de la carta del salón.
 */
import type { SalonProfile } from "./mock/types";
import {
  MAX_MENU_ENTRIES_SALON,
  MAX_TEAM_ENTRIES,
  formatMenuEntry,
  formatTeamEntry,
  parseMenuEntry,
  parseTeamEntry,
} from "./business-type";
import { MAX_FAQ_ENTRIES, formatFaqEntry, parseFaqEntry } from "./faq";
import { MAX_PRIORITY_RANGES, formatPriorityRange, parsePriorityRange } from "./reparto";
import { DEFAULT_OPENING_HOURS, DAY_LABELS_ES, normalizeDay } from "./opening-hours";

/** Cada campo del editor, en la forma exacta en que se teclea. */
export interface BorradorLanding {
  name: string;
  tagline: string;
  about: string;
  address: string;
  phone: string;
  instagram: string;
  heroImage: string;
  /** Enlace al logo; vacío = la inicial. */
  logoUrl: string;
  specialties: string;
  /** Nota media y número de reseñas de su ficha de Google, tal y como se teclean. */
  rating: string;
  reviewCount: string;
  /** Siete cadenas, lunes a domingo. */
  openingHours: string[];
  /** Una línea por servicio: "Nombre | minutos | precio" (o con «~»). */
  menu: string;
  /** Una línea por profesional: "Nombre | Especialidad". */
  team: string;
  /** Una línea por pregunta: "Pregunta | Respuesta". */
  faq: string;
  /** Una línea por franja: "HH:mm-HH:mm". */
  priorityHours: string;
  /* ---- Lote P: lo que la web de reservas enseña además de lo de siempre ---- */
  /** WhatsApp para pedir cita («+34 666 77 67 31»). Vacío: se usa el teléfono. */
  whatsapp: string;
  /** Direcciones completas de su web o blog, redes, tienda y ficha de Google (reseñas). Vacías: no salen. */
  enlaces: { blog: string; instagram: string; facebook: string; tienda: string; web: string; resenas: string };
  /** Boletín: la invitación, adónde se apunta y la letra pequeña (opcional). */
  boletinTexto: string;
  boletinUrl: string;
  boletinCondiciones: string;
  /** Fotos propias de la galería, en orden, con su texto alternativo. */
  galeria: Array<{ url: string; alt: string }>;
  /** Texto corto de cada servicio, por id. */
  descripciones: Record<string, string>;
}

/** Los seis enlaces, en el orden en que se editan (lote P.5: la ficha de Google, para las reseñas). */
export const CAMPOS_ENLACES = ["blog", "instagram", "facebook", "tienda", "web", "resenas"] as const;
/** Fotos propias como mucho (las que caben en la galería sin ruido). */
export const MAX_FOTOS_GALERIA = 12;
/** Largo máximo de la descripción de un servicio. */
export const MAX_DESCRIPCION_SERVICIO = 400;

/** Un fallo concreto, con el campo al que pertenece para poder resaltarlo. */
export interface ErrorCampo {
  campo: keyof BorradorLanding;
  mensaje: string;
}

/**
 * En las cajas multilínea se escribe con `|`, que es lo que se ve y lo que se
 * explica en pantalla; por dentro el perfil sigue usando `~`, que es el
 * separador que ya entienden `parseMenuEntry`, `parseTeamEntry` y compañía.
 * Esta es la única frontera entre los dos.
 */
const SEPARADOR_VISIBLE = "|";

function aTilde(linea: string): string {
  return linea.split(SEPARADOR_VISIBLE).map((p) => p.trim()).join("~");
}

function aBarra(entrada: string): string {
  return entrada.split("~").map((p) => p.trim()).join(` ${SEPARADOR_VISIBLE} `);
}

function lineas(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Del perfil publicado al borrador que se enseña en las cajas. */
export function borradorDesdePerfil(p: SalonProfile): BorradorLanding {
  return {
    name: p.name ?? "",
    tagline: p.tagline ?? "",
    about: p.about ?? "",
    address: p.address ?? "",
    phone: p.phone ?? "",
    instagram: p.instagram ?? "",
    heroImage: p.heroImage ?? "",
    logoUrl: p.logoUrl ?? "",
    specialties: (p.specialties ?? []).join(", "),
    rating: String(p.rating ?? 0),
    reviewCount: String(p.reviewCount ?? 0),
    openingHours:
      p.openingHours?.length === 7 ? [...p.openingHours] : [...DEFAULT_OPENING_HOURS],
    menu: (p.menu ?? []).map(aBarra).join("\n"),
    team: (p.team ?? []).map(aBarra).join("\n"),
    // Solo la PRIMERA «~» separa pregunta de respuesta — ver `perfilDesdeBorrador`.
    faq: (p.faq ?? [])
      .map((e) => {
        const i = e.indexOf("~");
        return i < 0 ? e : `${e.slice(0, i).trim()} ${SEPARADOR_VISIBLE} ${e.slice(i + 1).trim()}`;
      })
      .join("\n"),
    priorityHours: (p.priorityHours ?? []).join("\n"),
    whatsapp: p.whatsapp ?? "",
    enlaces: {
      blog: p.enlaces?.blog ?? "",
      instagram: p.enlaces?.instagram ?? "",
      facebook: p.enlaces?.facebook ?? "",
      tienda: p.enlaces?.tienda ?? "",
      web: p.enlaces?.web ?? "",
      resenas: p.enlaces?.resenas ?? "",
    },
    boletinTexto: p.boletin?.texto ?? "",
    boletinUrl: p.boletin?.url ?? "",
    boletinCondiciones: p.boletin?.condiciones ?? "",
    galeria: (p.galeriaPropia ?? []).map((f) => ({ url: f.url, alt: f.alt })),
    descripciones: { ...(p.descripcionesServicios ?? {}) },
  };
}

/* ---------------------------------------------------------------------- */
/* Validación                                                              */
/* ---------------------------------------------------------------------- */

/** Un teléfono español escrito de cualquier manera: lo que cuenta son los dígitos. */
function digitos(v: string): string {
  return v.replace(/\D/g, "");
}

const EXT_FOTO = /\.(jpe?g|png|webp|avif)(\?.*)?$/i;
const EXT_LOGO = /\.(jpe?g|png|webp|avif|svg)(\?.*)?$/i;

/**
 * Todo lo que impide publicar, en español y diciendo qué hay que hacer. Lista
 * vacía = se puede publicar.
 */
export function validarBorrador(b: BorradorLanding): ErrorCampo[] {
  const errores: ErrorCampo[] = [];

  if (!b.name.trim()) {
    errores.push({ campo: "name", mensaje: "El nombre del salón no puede quedar vacío: es lo primero que se lee en la web." });
  }

  const tel = digitos(b.phone);
  if (b.phone.trim() && (tel.length < 9 || tel.length > 15)) {
    errores.push({
      campo: "phone",
      mensaje: `«${b.phone.trim()}» no parece un teléfono. Escríbelo con sus 9 dígitos, por ejemplo 612 345 678.`,
    });
  }

  const foto = b.heroImage.trim();
  if (foto) {
    // La foto de las demos llega por el proxy propio (/api/foto?…): vale tal cual.
    if (/^\/api\/foto\?/.test(foto)) {
      /* foto propia de siShow */
    } else if (!/^(https?:\/\/|\/(?!\/))/i.test(foto)) {
      // Lote P.5: también una ruta de la propia web (la portada estática de
      // una demo registrada, «/demo/…»), igual que las fotos de la galería.
      errores.push({
        campo: "heroImage",
        mensaje: "La dirección de la foto de portada tiene que empezar por http:// o https://.",
      });
    } else if (!EXT_FOTO.test(foto)) {
      errores.push({
        campo: "heroImage",
        mensaje: "La foto de portada tiene que acabar en .jpg, .png, .webp o .avif. Si el enlace no acaba así, no es una foto.",
      });
    }
  }

  const logo = b.logoUrl.trim();
  if (logo) {
    if (!/^(https?:\/\/|\/)/i.test(logo)) {
      errores.push({ campo: "logoUrl", mensaje: "La dirección del logo tiene que empezar por http:// o https://." });
    } else if (!EXT_LOGO.test(logo)) {
      errores.push({ campo: "logoUrl", mensaje: "El logo tiene que acabar en .png, .jpg, .webp o .svg. Si el enlace no acaba así, no es una imagen." });
    }
  }

  // Nota y reseñas. Una nota fuera de escala se ve a la legua en el hero.
  const nota = Number(b.rating.replace(",", "."));
  if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
    errores.push({ campo: "rating", mensaje: "La nota tiene que ser un número entre 0 y 5." });
  }
  const resenas = Number(b.reviewCount.replace(/\s/g, ""));
  if (!Number.isFinite(resenas) || resenas < 0) {
    errores.push({
      campo: "reviewCount",
      mensaje: "El número de reseñas tiene que ser un número de 0 para arriba.",
    });
  }

  // Horario: cada día o está cerrado, o son franjas que se entienden y acaban
  // después de empezar. "20:00–10:00" es el error clásico de teclear al revés.
  b.openingHours.forEach((dia, i) => {
    const v = dia.trim();
    const etiqueta = DAY_LABELS_ES[i] ?? `Día ${i + 1}`;
    if (!v || /^(cerrado|closed)$/i.test(v)) return;
    for (const trozo of v.split(",")) {
      const t = trozo.trim();
      if (!t) continue;
      const m = t.match(/^(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})$/);
      if (!m) {
        errores.push({
          campo: "openingHours",
          mensaje: `${etiqueta}: «${t}» no se entiende. Escríbelo como 10:00–14:00, o pon «Cerrado».`,
        });
        continue;
      }
      const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) {
        errores.push({ campo: "openingHours", mensaje: `${etiqueta}: «${t}» no es una hora real.` });
        continue;
      }
      // Cerrar pasada medianoche es legítimo (22:00–02:00); cerrar a la misma
      // hora a la que se abre, no.
      if (h1 * 60 + m1 === h2 * 60 + m2) {
        errores.push({
          campo: "openingHours",
          mensaje: `${etiqueta}: «${t}» abre y cierra a la misma hora.`,
        });
      }
    }
  });

  // Servicios.
  const servicios = lineas(b.menu);
  if (servicios.length > MAX_MENU_ENTRIES_SALON) {
    errores.push({
      campo: "menu",
      mensaje: `Como mucho ${MAX_MENU_ENTRIES_SALON} servicios en la carta. Ahora hay ${servicios.length}.`,
    });
  }
  servicios.forEach((linea) => {
    const partes = linea.split(SEPARADOR_VISIBLE).map((p) => p.trim());
    if (partes.length < 3 || !partes[0]) {
      errores.push({
        campo: "menu",
        mensaje: `«${linea}»: falta algo. Cada servicio va como «Corte | 30 | 15».`,
      });
      return;
    }
    const min = Number(partes[1]);
    if (!Number.isFinite(min) || min < 5 || min > 240) {
      errores.push({
        campo: "menu",
        mensaje: `«${partes[0]}»: los minutos tienen que ser un número entre 5 y 240.`,
      });
    }
    const precio = Number(partes[2].replace(",", "."));
    if (!Number.isFinite(precio)) {
      errores.push({
        campo: "menu",
        mensaje: `«${partes[0]}»: el precio tiene que ser un número, por ejemplo 15 o 13,50.`,
      });
    } else if (precio < 0) {
      errores.push({
        campo: "menu",
        mensaje: `«${partes[0]}»: el precio no puede ser negativo. Si es gratis, pon 0.`,
      });
    }
  });

  // Equipo.
  const equipo = lineas(b.team);
  if (equipo.length > MAX_TEAM_ENTRIES) {
    errores.push({
      campo: "team",
      mensaje: `Como mucho ${MAX_TEAM_ENTRIES} profesionales. Ahora hay ${equipo.length}.`,
    });
  }
  equipo.forEach((linea) => {
    if (!linea.split(SEPARADOR_VISIBLE)[0]?.trim()) {
      errores.push({ campo: "team", mensaje: `«${linea}»: falta el nombre del profesional.` });
    }
  });

  // Preguntas frecuentes.
  const faqs = lineas(b.faq);
  if (faqs.length > MAX_FAQ_ENTRIES) {
    errores.push({
      campo: "faq",
      mensaje: `Como mucho ${MAX_FAQ_ENTRIES} preguntas. Ahora hay ${faqs.length}.`,
    });
  }
  faqs.forEach((linea) => {
    const partes = linea.split(SEPARADOR_VISIBLE);
    const q = partes[0]?.trim();
    const a = partes.slice(1).join(SEPARADOR_VISIBLE).trim();
    if (!q || !a) {
      errores.push({
        campo: "faq",
        mensaje: `«${linea}»: cada pregunta va con su respuesta, como «¿Tenéis parking? | Sí, en la misma calle».`,
      });
    }
  });

  // Franjas prioritarias.
  const franjas = lineas(b.priorityHours);
  if (franjas.length > MAX_PRIORITY_RANGES) {
    errores.push({
      campo: "priorityHours",
      mensaje: `Como mucho ${MAX_PRIORITY_RANGES} franjas prioritarias. Ahora hay ${franjas.length}.`,
    });
  }
  franjas.forEach((linea) => {
    if (!parsePriorityRange(linea)) {
      errores.push({
        campo: "priorityHours",
        mensaje: `«${linea}» no es una franja válida. Escríbela como 10:00-13:00, y que la hora de fin sea posterior a la de inicio.`,
      });
    }
  });

  // Lote P. WhatsApp: un número de verdad, con prefijo o sin él.
  const wa = digitos(b.whatsapp);
  if (b.whatsapp.trim() && (wa.length < 9 || wa.length > 15)) {
    errores.push({ campo: "whatsapp", mensaje: `«${b.whatsapp.trim()}» no parece un WhatsApp. Escríbelo como +34 612 345 678.` });
  }
  // Enlaces: completos, para que el botón lleve a algún sitio.
  for (const campo of CAMPOS_ENLACES) {
    const v = b.enlaces[campo].trim();
    if (v && !/^https?:\/\/\S+$/i.test(v)) {
      errores.push({ campo: "enlaces", mensaje: `El enlace de ${ETIQUETA_ENLACE[campo]} tiene que ser la dirección completa, empezando por https://.` });
    }
  }
  // Boletín: la invitación y adónde se apunta van juntas.
  const bt = b.boletinTexto.trim();
  const bu = b.boletinUrl.trim();
  if ((bt || bu || b.boletinCondiciones.trim()) && !bt) {
    errores.push({ campo: "boletinTexto", mensaje: "Falta el texto del boletín: lo que verá tu clienta, por ejemplo «Suscríbete y recibe nuestras novedades»." });
  }
  if (bt && !/^(https?:\/\/\S+|\/(?!\/)\S*)$/i.test(bu)) {
    errores.push({ campo: "boletinUrl", mensaje: "El boletín necesita la dirección donde apuntarse, empezando por https://." });
  }
  // Galería: foto de verdad y texto alternativo (lo leen los lectores de pantalla y Google).
  if (b.galeria.length > MAX_FOTOS_GALERIA) {
    errores.push({ campo: "galeria", mensaje: `Como mucho ${MAX_FOTOS_GALERIA} fotos en la galería. Ahora hay ${b.galeria.length}.` });
  }
  b.galeria.forEach((f, i) => {
    const url = f.url.trim();
    if (!/^(https?:\/\/\S+|\/(?!\/)\S*)$/i.test(url) || !EXT_FOTO.test(url)) {
      errores.push({ campo: "galeria", mensaje: `Foto ${i + 1}: la dirección tiene que empezar por https:// (o /) y acabar en .jpg, .png, .webp o .avif.` });
    }
    if (f.alt.trim().length < 3) {
      errores.push({ campo: "galeria", mensaje: `Foto ${i + 1}: falta el texto alternativo. Describe en una frase lo que se ve, por ejemplo «Recogido de novia con trenzas».` });
    }
  });
  for (const [id, texto] of Object.entries(b.descripciones)) {
    if (texto.trim().length > MAX_DESCRIPCION_SERVICIO) {
      errores.push({ campo: "descripciones", mensaje: `La descripción de «${id}» pasa de ${MAX_DESCRIPCION_SERVICIO} letras: déjala en una o dos frases.` });
    }
  }

  return errores;
}

const ETIQUETA_ENLACE: Record<(typeof CAMPOS_ENLACES)[number], string> = {
  blog: "tu blog",
  instagram: "Instagram",
  facebook: "Facebook",
  tienda: "la tienda",
  web: "tu web",
  resenas: "tu ficha de Google",
};

/* ---------------------------------------------------------------------- */
/* Serialización                                                           */
/* ---------------------------------------------------------------------- */

/**
 * El borrador convertido en los campos del perfil que se publican.
 *
 * Solo se llama con un borrador que ya ha pasado `validarBorrador`: aquí no se
 * vuelve a decidir qué es válido, solo se le da forma canónica. Las claves que
 * el dueño deja vacías se devuelven como array vacío (no ausentes) para que
 * borrar la carta o el equipo desde aquí APAGUE de verdad lo que hubiera, en
 * vez de dejar lo anterior pegado.
 */
export function perfilDesdeBorrador(b: BorradorLanding): Partial<SalonProfile> {
  return {
    name: b.name.trim(),
    tagline: b.tagline.trim(),
    about: b.about.trim(),
    address: b.address.trim(),
    phone: b.phone.trim(),
    instagram: b.instagram.trim(),
    heroImage: b.heroImage.trim(),
    logoUrl: b.logoUrl.trim(),
    rating: Number(b.rating.replace(",", ".")) || 0,
    reviewCount: Math.round(Number(b.reviewCount.replace(/\s/g, "")) || 0),
    specialties: b.specialties
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 8),
    openingHours: b.openingHours.map(normalizeDay),
    menu: lineas(b.menu)
      .map((l) => parseMenuEntry(aTilde(l)))
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, MAX_MENU_ENTRIES_SALON)
      .map(formatMenuEntry),
    team: lineas(b.team)
      .map((l) => parseTeamEntry(aTilde(l)))
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, MAX_TEAM_ENTRIES)
      .map(formatTeamEntry),
    faq: lineas(b.faq)
      // Solo se parte por la PRIMERA barra: una respuesta puede llevar «|»
      // dentro ("de 10 a 14 | y de 17 a 20") sin partirse en dos preguntas.
      .map((l) => {
        const i = l.indexOf(SEPARADOR_VISIBLE);
        if (i < 0) return null;
        return parseFaqEntry(`${l.slice(0, i).trim()}~${l.slice(i + 1).trim()}`);
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, MAX_FAQ_ENTRIES)
      .map(formatFaqEntry),
    priorityHours: lineas(b.priorityHours)
      .map((l) => parsePriorityRange(l))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, MAX_PRIORITY_RANGES)
      .map(formatPriorityRange),
    ...camposLote18(b),
  };
}

/**
 * Lo del lote P, en la forma del perfil. Lo que queda vacío se devuelve como
 * `undefined` (presente), para que borrarlo aquí lo borre de verdad. Las
 * descripciones son la excepción: sin ninguna escrita no se tocan (una carta
 * de ejemplo trae las suyas en cada servicio y no se deben vaciar).
 */
function camposLote18(b: BorradorLanding): Partial<SalonProfile> {
  const enlaces = Object.fromEntries(
    CAMPOS_ENLACES.map((c) => [c, b.enlaces[c].trim()] as const).filter(([, v]) => v),
  ) as NonNullable<SalonProfile["enlaces"]>;
  const texto = b.boletinTexto.trim();
  const url = b.boletinUrl.trim();
  const condiciones = b.boletinCondiciones.trim();
  const galeria = b.galeria
    .map((f) => ({ url: f.url.trim(), alt: f.alt.trim() }))
    .filter((f) => f.url)
    .slice(0, MAX_FOTOS_GALERIA);
  const descripciones = Object.fromEntries(
    Object.entries(b.descripciones)
      .map(([id, t]) => [id, t.trim().slice(0, MAX_DESCRIPCION_SERVICIO)] as const)
      .filter(([, t]) => t),
  );
  return {
    whatsapp: b.whatsapp.trim() || undefined,
    enlaces: Object.keys(enlaces).length ? enlaces : undefined,
    boletin: texto && url ? { texto, url, ...(condiciones ? { condiciones } : {}) } : undefined,
    galeriaPropia: galeria.length ? galeria : undefined,
    ...(Object.keys(descripciones).length ? { descripcionesServicios: descripciones } : {}),
  };
}

/** ¿Ha tocado algo el dueño respecto a lo que hay publicado? */
export function hayCambios(a: BorradorLanding, b: BorradorLanding): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
