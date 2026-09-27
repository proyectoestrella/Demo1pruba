/**
 * Alta del subdominio de un salón en Vercel: `<slug>.sishow.es` → proyecto
 * `prueba28juliokt` (equipo `estrellavercel-s-projects`).
 *
 *   bun scripts/alta-subdominio.ts <slug>             # simulación (por defecto)
 *   bun scripts/alta-subdominio.ts <slug> --aplicar   # lo hace de verdad
 *
 * Necesita `VERCEL_TOKEN` en el entorno (nunca en el repo):
 *
 *   set -a; source <credenciales.env>; set +a
 *
 * Simulación: solo LEE (si hay token): dice si el dominio ya está en el
 * proyecto, si está verificado y cómo ve Vercel su DNS, y qué haría. No
 * escribe nada. Sin token, enseña el plan sin llamar a la API.
 *
 * --aplicar: añade el dominio al proyecto (POST /v10/projects/:p/domains),
 * si Vercel lo deja sin verificar intenta verificarlo
 * (POST /v9/projects/:p/domains/:d/verify) y termina leyendo su configuración
 * DNS (GET /v6/domains/:d/config). Es idempotente: si ya estaba, no lo
 * vuelve a añadir.
 *
 * Código de salida: 0 listo (o simulación sin errores), 1 error, 2 añadido
 * pero pendiente (verificación o DNS/certificado todavía no listos).
 *
 * Otras variables opcionales: `VERCEL_PROYECTO` (por defecto
 * prueba28juliokt), `VERCEL_EQUIPO` (slug del equipo, por defecto
 * estrellavercel-s-projects), `VITE_SISHOW_DOMINIO` (por defecto sishow.es).
 * Ver docs/dominios-sishow.md.
 */
import { slugAdmiteSubdominio, subdominioDeSalon } from "../src/lib/host";

export const PROYECTO_POR_DEFECTO = "prueba28juliokt";
export const EQUIPO_POR_DEFECTO = "estrellavercel-s-projects";
const API = "https://api.vercel.com";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export type OpcionesAlta = {
  slug: string;
  aplicar: boolean;
  token?: string;
  proyecto?: string;
  equipo?: string;
  dominio?: string;
  fetch?: Fetch;
  log?: (linea: string) => void;
};

export type ResultadoAlta = {
  codigo: 0 | 1 | 2;
  dominio: string | null;
  existia: boolean | null;
  anadido: boolean;
  verificado: boolean | null;
  dnsBien: boolean | null;
  llamadas: string[];
};

type DominioProyecto = { name: string; verified: boolean; verification?: Array<{ type: string; domain: string; value: string; reason: string }> };
type ConfigDominio = {
  misconfigured: boolean;
  configuredBy: string | null;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
};

async function leerJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mensajeError(cuerpo: Record<string, unknown>): string {
  const e = cuerpo.error as { code?: string; message?: string } | undefined;
  return e ? `${e.code ?? "error"}: ${e.message ?? ""}`.trim() : JSON.stringify(cuerpo).slice(0, 300);
}

export async function altaSubdominio(o: OpcionesAlta): Promise<ResultadoAlta> {
  const log = o.log ?? ((l: string) => console.log(l));
  const f: Fetch = o.fetch ?? ((u, i) => fetch(u, i));
  const proyecto = o.proyecto || PROYECTO_POR_DEFECTO;
  const equipo = o.equipo || EQUIPO_POR_DEFECTO;
  const res: ResultadoAlta = {
    codigo: 0,
    dominio: null,
    existia: null,
    anadido: false,
    verificado: null,
    dnsBien: null,
    llamadas: [],
  };

  const slug = o.slug.trim().toLowerCase();
  if (!slugAdmiteSubdominio(slug)) {
    log(`✗ «${o.slug}» no sirve como subdominio: solo a-z, 0-9 y guiones, sin guion en los bordes, hasta 63 caracteres, y no reservado (www, app, api…).`);
    res.codigo = 1;
    return res;
  }
  const dominio = subdominioDeSalon(slug, o.dominio) as string;
  res.dominio = dominio;
  const modo = o.aplicar ? "APLICAR" : "SIMULACIÓN";
  log(`${modo} · ${dominio} → proyecto ${proyecto} (equipo ${equipo})`);

  if (!o.token) {
    if (o.aplicar) {
      log("✗ Falta VERCEL_TOKEN en el entorno. Cárgalo con: set -a; source <credenciales.env>; set +a");
      res.codigo = 1;
      return res;
    }
    log("· Sin VERCEL_TOKEN: no consulto a Vercel. Con --aplicar haría:");
    log(`  1. POST ${API}/v10/projects/${proyecto}/domains?slug=${equipo}  {"name":"${dominio}"}`);
    log(`  2. si queda sin verificar: POST ${API}/v9/projects/${proyecto}/domains/${dominio}/verify?slug=${equipo}`);
    log(`  3. GET ${API}/v6/domains/${dominio}/config?slug=${equipo}  (¿DNS y certificado listos?)`);
    return res;
  }

  const q = `slug=${encodeURIComponent(equipo)}`;
  const cab = { authorization: `Bearer ${o.token}`, "content-type": "application/json" };
  const llamar = async (metodo: "GET" | "POST", ruta: string, cuerpo?: unknown) => {
    res.llamadas.push(`${metodo} ${ruta}`);
    const r = await f(`${API}${ruta}${ruta.includes("?") ? "&" : "?"}${q}`, {
      method: metodo,
      headers: cab,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: r.status, cuerpo: await leerJson(r) };
  };
  const rutaDominio = `/v9/projects/${encodeURIComponent(proyecto)}/domains/${encodeURIComponent(dominio)}`;

  // 1. ¿Ya está en el proyecto?
  const actual = await llamar("GET", rutaDominio);
  let estado: DominioProyecto | null = null;
  if (actual.status === 200) {
    estado = actual.cuerpo as unknown as DominioProyecto;
    res.existia = true;
    log(`· Ya está en el proyecto (verificado: ${estado.verified ? "sí" : "no"}).`);
  } else if (actual.status === 404) {
    res.existia = false;
    log("· Todavía no está en el proyecto.");
  } else {
    log(`✗ No pude consultar el dominio (${actual.status}) ${mensajeError(actual.cuerpo)}`);
    res.codigo = 1;
    return res;
  }

  // 2. Añadirlo.
  if (!estado) {
    if (!o.aplicar) {
      log(`→ Con --aplicar: POST /v10/projects/${proyecto}/domains {"name":"${dominio}"}`);
    } else {
      const alta = await llamar("POST", `/v10/projects/${encodeURIComponent(proyecto)}/domains`, { name: dominio });
      if (alta.status !== 200) {
        log(`✗ Vercel no lo añadió (${alta.status}) ${mensajeError(alta.cuerpo)}`);
        res.codigo = 1;
        return res;
      }
      estado = alta.cuerpo as unknown as DominioProyecto;
      res.anadido = true;
      log(`✓ Añadido al proyecto (verificado: ${estado.verified ? "sí" : "no"}).`);
    }
  }

  // 3. Verificación (solo si Vercel la pide: dominio usado en otra cuenta).
  if (estado) {
    res.verificado = estado.verified;
    if (!estado.verified) {
      for (const v of estado.verification ?? []) {
        log(`  Vercel pide un registro ${v.type} en ${v.domain} = ${v.value} (${v.reason})`);
      }
      if (!o.aplicar) {
        log(`→ Con --aplicar: POST ${rutaDominio}/verify`);
      } else {
        const ver = await llamar("POST", `${rutaDominio}/verify`);
        res.verificado = ver.status === 200 && (ver.cuerpo as { verified?: boolean }).verified === true;
        log(res.verificado ? "✓ Verificado." : `· Aún sin verificar (${ver.status}) ${mensajeError(ver.cuerpo)}`);
      }
    }
  }

  // 4. DNS y certificado, tal como los ve Vercel.
  const conf = await llamar("GET", `/v6/domains/${encodeURIComponent(dominio)}/config?projectIdOrName=${encodeURIComponent(proyecto)}`);
  if (conf.status === 200) {
    const c = conf.cuerpo as unknown as ConfigDominio;
    res.dnsBien = !c.misconfigured;
    const cname = (c.recommendedCNAME ?? []).sort((a, b) => a.rank - b.rank)[0]?.value;
    log(
      c.misconfigured
        ? `· DNS todavía sin apuntar a Vercel (configuredBy: ${c.configuredBy ?? "nada"}). Registro esperado: CNAME ${slug} → ${cname ?? "cname.vercel-dns.com"} (o el comodín *).`
        : `✓ DNS apuntando a Vercel (${c.configuredBy}); el certificado se emite solo.`,
    );
  } else {
    log(`· No pude leer la configuración DNS (${conf.status}) ${mensajeError(conf.cuerpo)}`);
  }

  if (o.aplicar && (res.verificado === false || res.dnsBien === false)) res.codigo = 2;
  if (o.aplicar && res.verificado && res.dnsBien) log(`✓ Listo: https://${dominio}`);
  return res;
}

export function leerArgumentos(argv: string[]): { slug: string | null; aplicar: boolean } {
  const aplicar = argv.includes("--aplicar");
  const slug = argv.find((a) => !a.startsWith("--")) ?? null;
  return { slug, aplicar };
}

if (import.meta.main) {
  const { slug, aplicar } = leerArgumentos(process.argv.slice(2));
  if (!slug) {
    console.log("Uso: bun scripts/alta-subdominio.ts <slug> [--aplicar]");
    process.exit(1);
  }
  const r = await altaSubdominio({
    slug,
    aplicar,
    token: process.env.VERCEL_TOKEN,
    proyecto: process.env.VERCEL_PROYECTO,
    equipo: process.env.VERCEL_EQUIPO,
  });
  process.exit(r.codigo);
}
