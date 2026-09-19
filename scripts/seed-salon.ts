/**
 * Da de alta (o actualiza) un salón REAL en la tabla `salons`.
 *
 *   bun run scripts/seed-salon.ts                 # comprueba y enseña lo que hay
 *   bun run scripts/seed-salon.ts --escribir      # da de alta a The Best Shave & Barber
 *
 * Va por REST con la service role key, no por Postgres: insertar una fila sí lo
 * puede hacer PostgREST, y así este script funciona aunque no haya credenciales
 * de conexión directa. Lo que NO puede hacer PostgREST es crear la tabla — eso
 * es `scripts/migrate.ts` (o el SQL Editor de Supabase con `supabase/schema.sql`).
 *
 * No toca ninguna fila de `appointments` ni de `clients`: la basura de pruebas
 * que hay con slug `the-best-shave-barber` se queda donde está, a propósito.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { DEFAULT_OPENING_HOURS } from "../src/lib/opening-hours";
import type { SalonProfile } from "../src/lib/mock/types";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Igual que en migrate.ts: el fichero manda sobre el entorno de la terminal. */
function envLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let texto = "";
  try {
    texto = readFileSync(resolve(raiz, ".env.local"), "utf8");
  } catch {
    return out;
  }
  for (const linea of texto.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/** Precedencia normal: el entorno explícito manda sobre `.env.local`, y el
 *  literal "[SENSITIVE]" de `vercel env pull` no cuenta como valor. */
function limpio(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string" && v !== "[SENSITIVE]") out[k] = v;
  }
  return out;
}

const ENV = { ...limpio(envLocal()), ...limpio(process.env) } as Record<string, string | undefined>;
const URL_BASE = ENV.SUPABASE_URL;
const KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

/**
 * The Best Shave & Barber — primer cliente de pago.
 *
 * Los datos (nombre, dirección, teléfono, nota, horario y foto de portada) son
 * los mismos que lleva su enlace de demo en `src/lib/rutero.ts`, parada 20: es
 * lo que ya vio Adam y lo que ya está en circulación por WhatsApp.
 *
 * `menu` va VACÍO a propósito: sin carta propia, la app usa el catálogo
 * estándar de barbería (`SERVICE_CATALOG.barberia`, ids estables: corte,
 * degradado, corte-barba, barba, afeitado, infantil, cejas). Cuando Adam mande
 * sus precios reales se cambian desde Ajustes y, ahora sí, persisten.
 */
const THE_BEST_SHAVE: SalonProfile = {
  id: "the-best-shave-barber",
  slug: "the-best-shave-barber",
  name: "THE BEST SHAVE & BARBER",
  tagline: "Barbería",
  about: "",
  address: "Calle rafaela aparicio, Av. de Maruja Mallo, Hortaleza, 28055 Madrid, España",
  phone: "622 87 46 38",
  instagram: "",
  openingHours: [
    "10:00–14:00, 16:00–20:30",
    "10:00–14:00, 16:00–20:30",
    "10:00–14:00, 16:00–20:30",
    "10:00–14:00, 16:00–20:30",
    "10:00–14:00, 16:00–20:30",
    "10:00–14:00, 16:00–20:30",
    "Cerrado",
  ],
  rating: 4.8,
  reviewCount: 132,
  specialties: [],
  heroImage: "/api/foto?place=ChIJJWSRJ_ovQg0RIt4E5C61Mdg&i=0",
  photoCount: 10,
  galleryPhotos: ["4", "2", "5", "3"],
  // Adam trabaja solo: un único profesional en el equipo, no los tres de ejemplo.
  team: ["Adam~Cortes, barba y afeitado clásico"],
  menu: [],
  // Política de plantón pactada con él: 7 € y 2 h de antelación.
  noShowFeeEur: 7,
  noShowNoticeHours: 2,
  smartSpread: false,
  lastSlotBufferMin: 0,
};

void DEFAULT_OPENING_HOURS; // referencia documental: el horario de arriba es el suyo, no el por defecto.

const SALONES: SalonProfile[] = [THE_BEST_SHAVE];

async function rest(path: string, init?: RequestInit) {
  if (!URL_BASE || !KEY) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function main() {
  const escribir = process.argv.includes("--escribir");

  if (escribir) {
    for (const salon of SALONES) {
      await rest("salons?on_conflict=slug", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([
          { slug: salon.slug, profile: salon, updated_at: new Date().toISOString() },
        ]),
      });
      console.log(`Alta/actualización de ${salon.slug} hecha.`);
    }
  }

  // Lectura de verificación: lo que hay DE VERDAD en la base, no lo que se
  // acaba de mandar.
  const filas = await rest("salons?select=slug,updated_at,profile");
  console.log("\nFilas en `salons`:");
  for (const f of filas as Array<{ slug: string; updated_at: string; profile: SalonProfile }>) {
    console.log(
      ` · ${f.slug} — "${f.profile.name}" · equipo ${JSON.stringify(f.profile.team)} · plantón ${f.profile.noShowFeeEur} € · ${f.updated_at}`,
    );
  }
  if (!escribir) console.log("\n(solo lectura — usa --escribir para dar de alta)");
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
