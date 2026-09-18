/**
 * Diagnóstico: ¿son reales las credenciales de Postgres de `.env.local`?
 *
 * Se compara el SHA-256 de cada valor con el del literal "[SENSITIVE]", que es
 * lo que escribe `vercel env pull` cuando una variable está marcada como
 * sensible en Vercel: el CLI NO puede recuperar su valor. Se usa el hash y no
 * el valor para que la comprobación sea verificable sin enseñar ningún secreto.
 *
 *   bun run scripts/diagnostico-credenciales.ts
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const HASH_PLACEHOLDER = sha("[SENSITIVE]");

console.log(`SHA-256(16) del literal "[SENSITIVE]" = ${HASH_PLACEHOLDER}\n`);

for (const fichero of [".env.local", ".env.production.local"]) {
  let texto = "";
  try {
    texto = readFileSync(resolve(raiz, fichero), "utf8");
  } catch {
    console.log(`${fichero}: no existe`);
    continue;
  }
  console.log(`== ${fichero} (ruta: ${resolve(raiz, fichero)})`);
  for (const linea of texto.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    const nombre = m[1];
    if (!/^(POSTGRES_|SUPABASE_)/.test(nombre)) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    const h = sha(v);
    const marca = h === HASH_PLACEHOLDER ? "  <-- PLACEHOLDER, NO ES EL VALOR REAL" : "";
    console.log(`   ${nombre.padEnd(38)} len=${String(v.length).padStart(4)}  sha=${h}${marca}`);
  }
  console.log("");
}
