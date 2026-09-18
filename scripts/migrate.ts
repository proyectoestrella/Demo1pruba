/**
 * Aplica `supabase/schema.sql` contra la base de datos.
 *
 * PostgREST (la API REST de Supabase, la que usa `getSupabaseServerClient`) no
 * ejecuta DDL: no hay forma de crear una tabla con la service role key. La
 * única vía desde aquí es una conexión Postgres directa, y para eso está
 * `POSTGRES_URL_NON_POOLING` en `.env.local` — el pooler de Supabase (pgbouncer
 * en modo transacción) no admite todo el DDL, así que se usa la directa.
 *
 *   bun run scripts/migrate.ts
 *
 * Es idempotente (`if not exists` en todo): se puede volver a lanzar sin miedo.
 * No borra ni modifica ninguna fila existente salvo para rellenar las columnas
 * nuevas (`phone_key`, `local_id`) de las filas que ya estaban.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { Client } from "pg";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Lee `.env.local` a mano como respaldo de `process.env`.
 *
 * Bun ya carga `.env.local`, pero solo cuando el script se lanza desde la raíz
 * del proyecto; leerlo aquí hace que `bun run <ruta absoluta>` funcione igual.
 * La precedencia es la de siempre: lo que venga explícito en el entorno manda
 * sobre el fichero, para poder apuntar el script a otra base sin editarlo.
 */
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
    let valor = m[2].trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    out[m[1]] = valor;
  }
  return out;
}

const ENV = { ...limpio(envLocal()), ...limpio(process.env) } as Record<string, string | undefined>;

/**
 * `vercel env pull` escribe el literal "[SENSITIVE]" en las variables marcadas
 * como sensibles en Vercel: el CLI no puede recuperar su valor. Un valor así no
 * es una credencial, es un hueco — se descarta para que el mensaje de error sea
 * "falta la variable" y no un críptico "getaddrinfo EREFUSED".
 */
function limpio(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string" && v !== "[SENSITIVE]") out[k] = v;
  }
  return out;
}

/**
 * Candidatos de conexión, en orden de preferencia.
 *
 * `POSTGRES_URL_NON_POOLING` (db.<ref>.supabase.co) es la directa y la que
 * Supabase recomienda para DDL, PERO desde marzo de 2026 ese host solo resuelve
 * a IPv6 y esta máquina no tiene IPv6 (`ip -6 route show default` vacío): da
 * EREFUSED antes de abrir el socket. El pooler (`POSTGRES_URL`) sí es IPv4 y
 * acepta DDL perfectamente, así que se prueba después.
 */
function candidatos(): Array<{ nombre: string; url: string }> {
  const lista: Array<{ nombre: string; url: string | undefined }> = [
    { nombre: "POSTGRES_URL_NON_POOLING", url: ENV.POSTGRES_URL_NON_POOLING },
    { nombre: "POSTGRES_URL", url: ENV.POSTGRES_URL },
    { nombre: "POSTGRES_PRISMA_URL", url: ENV.POSTGRES_PRISMA_URL?.split("?")[0] },
  ];
  return lista.filter((c): c is { nombre: string; url: string } => Boolean(c.url));
}

async function conectar() {
  const errores: string[] = [];
  for (const { nombre, url } of candidatos()) {
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`Conectado por ${nombre} (${new URL(url).hostname}).`);
      return client;
    } catch (err) {
      let host = "?";
      try {
        host = new URL(url).hostname;
      } catch {
        host = "(url no parseable)";
      }
      errores.push(`${nombre} [${host}]: ${(err as Error).message}`);
      await client.end().catch(() => {});
    }
  }
  throw new Error(`No se pudo conectar a Postgres.\n  ${errores.join("\n  ")}`);
}

async function main() {
  if (!candidatos().length) {
    console.error(
      [
        "No hay ninguna cadena de conexión a Postgres utilizable.",
        "",
        "POSTGRES_URL / POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL de .env.local",
        'valen el literal "[SENSITIVE]": `vercel env pull` no puede recuperar el valor',
        "de una variable marcada como sensible en Vercel.",
        "",
        "Dos formas de desbloquearlo:",
        "  a) Pegar supabase/schema.sql en el SQL Editor de Supabase y ejecutarlo.",
        "  b) Exportar la cadena del POOLER (IPv4) y relanzar este script:",
        "     POSTGRES_URL='postgresql://postgres.<ref>:<clave>@aws-0-<region>.pooler.supabase.com:5432/postgres' \\",
        "       bun run scripts/migrate.ts",
        "",
        "Ojo: db.<ref>.supabase.co (la directa) solo resuelve a IPv6 y esta máquina",
        "no tiene ruta IPv6, así que ahí no conecta ni con la clave correcta.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const sql = readFileSync(resolve(raiz, "supabase/schema.sql"), "utf8");
  const client = await conectar();
  try {
    // Todo el fichero en una sola transacción: o entra el esquema entero o no
    // entra nada, para no dejar la base a medias si una sentencia falla.
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Esquema aplicado.");

    // Verificación en la misma conexión: que las columnas estén DE VERDAD, no
    // que la sentencia no haya dado error.
    const cols = await client.query(
      `select table_name, column_name
         from information_schema.columns
        where table_schema = 'public'
          and (table_name = 'salons'
               or (table_name = 'clients' and column_name in ('penalty_eur','penalty_note','phone_key'))
               or (table_name = 'appointments' and column_name in ('local_id','client_name')))
        order by table_name, column_name`,
    );
    console.table(cols.rows);

    const nul = await client.query(
      `select is_nullable from information_schema.columns
        where table_schema='public' and table_name='appointments' and column_name='client_id'`,
    );
    console.log("appointments.client_id is_nullable =", nul.rows[0]?.is_nullable);
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
