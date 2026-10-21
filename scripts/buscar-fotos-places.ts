/**
 * Busca en Google Places las fichas de los negocios de las demos de hoy y
 * guarda, por cada una, el id del sitio y la lista de fotos (posición y
 * tamaño) para poder montar `/api/foto?place=<id>&i=<n>`.
 *
 * La clave se lee aquí dentro (GOOGLE_MAPS_API_KEY del .env.local de Trimly,
 * o de la variable de entorno) y NUNCA se imprime ni se escribe. La salida no
 * lleva claves ni teléfonos.
 *
 * Uso (desde la raíz del worktree): bun scripts/buscar-fotos-places.ts [--todas-martes]
 * Con --todas-martes lee del CSV todas las paradas del 20-oct y no pisa lo ya obtenido.
 * Variables opcionales: FOTOS_ENV_FILE (otro .env), FOTOS_SALIDA (otro JSON).
 */
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

const ENV_FILE = process.env.FOTOS_ENV_FILE ?? "/home/tomi/Documents/starcarpet/Trimly/.env.local";
const SALIDA =
  process.env.FOTOS_SALIDA ??
  "/home/tomi/Documents/logibro/AlmacenExterno/starproyect-demos-2026-10-20/places-fotos.json";

const FIJOS = [
  { nombre: "DHF Estilistas", direccion: "C. del Fuego 33, Alcobendas, Madrid" },
  { nombre: "The Heirs Peluqueros", direccion: "C. de Peña del Águila 6, Arroyo del Fresno, Madrid" },
  { nombre: "Mino Barber Shop", direccion: "C. Chantada 7, Madrid" },
  { nombre: "Peluquería Unisex Latín Fire", direccion: "C. del Fuego 31, Alcobendas, Madrid" },
  { nombre: "Aqua Estilistas", direccion: "C. del Marqués de la Valdavia 2, Alcobendas, Madrid" },
];

const CSV =
  process.env.FOTOS_CSV ??
  "/home/tomi/Documents/logibro/AlmacenExterno/starproyect-demos-2026-10-20/demos-visitas.csv";
const TODAS = process.argv.includes("--todas-martes");

function filasCsv(texto: string): string[][] {
  const out: string[][] = [];
  let fila: string[] = [];
  let c = "";
  let q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) {
      if (ch === '"' && texto[i + 1] === '"') {
        c += '"';
        i++;
      } else if (ch === '"') q = false;
      else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      fila.push(c);
      c = "";
    } else if (ch === "\n") {
      fila.push(c);
      out.push(fila);
      fila = [];
      c = "";
    } else c += ch;
  }
  return out;
}

function negocios(): { nombre: string; direccion: string }[] {
  if (!TODAS) return FIJOS;
  const [cab, ...filas] = filasCsv(readFileSync(CSV, "utf8"));
  const ib = cab.indexOf("bloque");
  const inn = cab.indexOf("negocio");
  const iu = cab.indexOf("url_demo_produccion");
  const lista: { nombre: string; direccion: string }[] = [];
  for (const f of filas) {
    if (!f[ib]?.startsWith("2026-10-20")) continue;
    let dir = "";
    try {
      const d = new URL(f[iu]).searchParams.get("d") ?? "";
      dir = (JSON.parse(Buffer.from(d, "base64url").toString("utf8")) as { d?: string }).d ?? "";
    } catch {
      /* sin dirección: se busca solo por nombre */
    }
    const muni = f[ib].includes("Tomás") ? "San Sebastián de los Reyes, Madrid" : "Madrid";
    lista.push({ nombre: f[inn], direccion: [dir, muni].filter(Boolean).join(", ") });
  }
  for (const fijo of FIJOS) {
    const i = lista.findIndex((l) => l.nombre.toLowerCase() === fijo.nombre.toLowerCase());
    if (i >= 0) lista[i] = fijo;
    else lista.push(fijo);
  }
  return lista;
}

function leerClave(): string | null {
  const deEntorno = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (deEntorno) return deEntorno;
  try {
    const linea = readFileSync(ENV_FILE, "utf8")
      .split(/\r?\n/)
      .find((l) => /^\s*GOOGLE_MAPS_API_KEY\s*=/.test(l));
    const v = linea?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    return v || null;
  } catch {
    return null;
  }
}

const key = leerClave();
if (!key) {
  console.error("Sin clave de Places (no se encontró GOOGLE_MAPS_API_KEY). No se ha hecho nada.");
  process.exit(2);
}

const CAMPOS =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos.widthPx,places.photos.heightPx";

type Place = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{ widthPx?: number; heightPx?: number }>;
};

type Previo = { buscado: { nombre: string }; primero?: unknown };
let previos: Previo[] = [];
try {
  previos = (JSON.parse(readFileSync(SALIDA, "utf8")) as { resultado: Previo[] }).resultado;
} catch {
  /* primera vez: no hay nada previo */
}
const yaBuenos = new Map(previos.filter((r) => r.primero).map((r) => [r.buscado.nombre.toLowerCase(), r]));
const lista = negocios();
const resultado: Record<string, unknown>[] = [];
let fallos = 0;
for (const n of lista) {
  const previo = yaBuenos.get(n.nombre.toLowerCase());
  if (previo) {
    resultado.push(previo as Record<string, unknown>);
    console.log(`${n.nombre}: ya obtenido`);
    continue;
  }
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": CAMPOS,
      },
      body: JSON.stringify({
        textQuery: `${n.nombre}, ${n.direccion}`,
        languageCode: "es",
        maxResultCount: 3,
      }),
    });
    if (!res.ok) {
      fallos++;
      resultado.push({ buscado: n, error: `Google respondió ${res.status}` });
      console.log(`${n.nombre}: error ${res.status}`);
      continue;
    }
    const places = ((await res.json()) as { places?: Place[] }).places ?? [];
    const cand = places.map((p) => ({
      place_id: p.id,
      nombre: p.displayName?.text,
      direccion: p.formattedAddress,
      valoracion: p.rating,
      resenas: p.userRatingCount,
      n_fotos: p.photos?.length ?? 0,
      // Posición i = la que usa /api/foto?place=<id>&i=<i>
      fotos: (p.photos ?? []).map((f, i) => ({ i, ancho: f.widthPx, alto: f.heightPx })),
    }));
    resultado.push({ buscado: n, primero: cand[0] ?? null, otros_candidatos: cand.slice(1) });
    console.log(
      `${n.nombre}: ${cand[0] ? `${cand[0].nombre} | ${cand[0].direccion} | ${cand[0].n_fotos} fotos` : "sin resultados"}`,
    );
  } catch {
    fallos++;
    resultado.push({ buscado: n, error: "fallo de red" });
    console.log(`${n.nombre}: fallo de red`);
  }
}

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString(), resultado }, null, 2), {
  mode: 0o600,
});
chmodSync(SALIDA, 0o600);
console.log(`Escrito ${SALIDA} (${lista.length - fallos}/${lista.length} consultas correctas)`);
process.exit(fallos === lista.length ? 1 : 0);
