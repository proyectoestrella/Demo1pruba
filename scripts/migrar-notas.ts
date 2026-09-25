/**
 * Relleno de las columnas del lote 3 en Supabase a partir de lo que iba
 * codificado en `appointments.note` y `clients.penalty_note`.
 *
 *   bun run scripts/migrar-notas.ts            # solo cuenta y enseña (sin escribir)
 *   bun run scripts/migrar-notas.ts --aplicar  # escribe los parches
 *
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (entorno o .env.local) y
 * que supabase/pendiente.sql esté aplicado (si falta una columna, PostgREST
 * lo dice y no se escribe nada). Es idempotente: la segunda pasada no
 * encuentra marcadores y no toca ninguna fila. Usa los mismos parsers que la
 * aplicación (src/lib/migrar-notas.ts): nada de SQL con expresiones regulares.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

import { parcheCitaDesdeNota, parcheClienteDesdeNota } from "../src/lib/migrar-notas";
import { MANUAL_BLOCK_NOTE } from "../src/lib/no-show";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function envLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let texto = "";
  try { texto = readFileSync(resolve(raiz, ".env.local"), "utf8"); } catch { return out; }
  for (const linea of texto.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    let valor = m[2].trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) valor = valor.slice(1, -1);
    if (valor && valor !== "[SENSITIVE]") out[m[1]] = valor;
  }
  return out;
}

const ENV = { ...envLocal(), ...process.env };
const url = ENV.SUPABASE_URL;
const key = ENV.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (entorno o .env.local).");
  process.exit(1);
}
const aplicar = process.argv.includes("--aplicar");
const db = createClient(url, key, { auth: { persistSession: false } });

async function* paginar<T>(tabla: string, columnas: string, filtro: (q: any) => any): AsyncGenerator<T> {
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await filtro(db.from(tabla).select(columnas)).order("id").range(desde, desde + 499);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    for (const fila of (data ?? []) as T[]) yield fila;
    if (!data || data.length < 500) break;
  }
}

let citas = 0, citasParcheadas = 0, fichas = 0, fichasParcheadas = 0;

type Cita = { id: string; note: string | null; booking_answers: unknown | null; deposit_due_at: string | null; deposit_period_hours: number | null; origen: string | null };
for await (const cita of paginar<Cita>("appointments", "id, note, booking_answers, deposit_due_at, deposit_period_hours, origen", (q) => q.like("note", "%[siShow:%"))) {
  citas += 1;
  const parche = parcheCitaDesdeNota(cita);
  if (!parche) continue;
  citasParcheadas += 1;
  if (!aplicar) { console.log(`cita ${cita.id}:`, JSON.stringify(parche)); continue; }
  const { error } = await db.from("appointments").update(parche).eq("id", cita.id);
  if (error) throw new Error(`appointments ${cita.id}: ${error.message}`);
}

type Ficha = { id: string; penalty_eur: number | string | null; penalty_note: string | null; manual_block: boolean | null };
for await (const ficha of paginar<Ficha>("clients", "id, penalty_eur, penalty_note, manual_block", (q) => q.like("penalty_note", `${MANUAL_BLOCK_NOTE}%`))) {
  fichas += 1;
  const parche = parcheClienteDesdeNota(ficha);
  if (!parche) continue;
  fichasParcheadas += 1;
  if (!aplicar) { console.log(`ficha ${ficha.id}:`, JSON.stringify(parche)); continue; }
  const { error } = await db.from("clients").update(parche).eq("id", ficha.id);
  if (error) throw new Error(`clients ${ficha.id}: ${error.message}`);
}

console.log(`${aplicar ? "Aplicado" : "Simulación (sin escribir; añade --aplicar)"}: citas con marcador ${citas}, parcheadas ${citasParcheadas}; fichas con bloqueo en nota ${fichas}, parcheadas ${fichasParcheadas}.`);
