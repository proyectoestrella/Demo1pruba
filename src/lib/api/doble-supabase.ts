export function tokenConSesion(alias: string): string {
  return `prueba.${Buffer.from(JSON.stringify({ session_id: alias })).toString("base64url")}.firma`;
}
/**
 * Doble de Supabase para las pruebas de las funciones de servidor REALES.
 * Solo en memoria: no abre red ni toca ningún proyecto. Soporta lo justo:
 * select/eq/in/order/range/maybeSingle/insert/upsert/update/delete y
 * auth.getUser(token). Apunta cada escritura en `escrituras`.
 */
type Fila = Record<string, unknown>;
export interface Escritura { tabla: string; op: string; datos?: unknown; filtros: Array<[string, unknown]> }

export function crearDobleSupabase(
  tablas: Record<string, Fila[]>,
  opciones: {
    tokens?: Record<string, string>;
    errorEn?: Record<string, string>;
    errorEscrituraEn?: Record<string, { code?: string; message: string }>;
    /** Falla desde una lectura concreta; permite comprobar la segunda lectura del perfil. */
    errorDespuesDe?: Record<string, { lectura: number; mensaje: string }>;
  } = {},
) {
  const sesiones = new Map(Object.entries(opciones.tokens ?? {}).map(([alias, usuario]) => [alias, usuario]));
  const rpc = async (nombre: string, args: { usuario: string; sesion?: string }) => {
    if (nombre === "cerrar_sesiones_usuario") {
      for (const [id, usuario] of sesiones) if (usuario === args.usuario) sesiones.delete(id);
      return { data: null, error: null };
    }
    if (nombre === "sesion_usuario_vigente") return { data: sesiones.get(args.sesion ?? "") === args.usuario, error: null };
    return { data: null, error: { message: "RPC no implementada" } };
  };
  const escrituras: Escritura[] = [];
  const consultas: Array<{ tabla: string; filtros: Array<[string, unknown]>; or?: string[] }> = [];
  const lecturas: Record<string, number> = {};
  const from = (tabla: string) => {
    const filtros: Array<[string, unknown]> = [];
    let op = "select";
    let datos: unknown;
    let opts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    const err = () =>
      op !== "select" && opciones.errorEscrituraEn?.[tabla]
        ? opciones.errorEscrituraEn[tabla]
        : opciones.errorEn?.[tabla]
          ? { message: opciones.errorEn[tabla] }
          : null;
    let selecciona = false;
    let afectadas: Fila[] = [];
    const noNulos: string[] = [];
    const comp: Array<(f: Fila) => boolean> = [];
    const filtrosOr: string[] = [];
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every(([c, v]) => (Array.isArray(v) ? v.includes(f[c]) : f[c] === v)) && comp.every((fn) => fn(f)) && noNulos.every((c) => f[c] !== null && f[c] !== undefined));
    const resultado = () => {
      if (op !== "select") {
        escrituras.push({ tabla, op, datos, filtros: [...filtros] });
        if (err()) return { data: null, error: err() };
        // Semántica mínima de upsert/insert para poder comprobar QUÉ datos quedan.
        if (op === "update") { for (const f of filas()) Object.assign(f, datos as Fila); }
        if (op === "delete") { const fuera = new Set(filas()); tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !fuera.has(f)); }
        if (op === "insert" || op === "upsert") {
          const t = (tablas[tabla] ??= []);
          for (const d of (Array.isArray(datos) ? datos : [datos]) as Fila[]) {
            const cols = (opts.onConflict ?? "id").split(",");
            const previa = t.find((f) => cols.every((c) => f[c] !== undefined && f[c] === d[c]));
            if (previa && op === "upsert") { if (!opts.ignoreDuplicates) Object.assign(previa, d); afectadas.push(previa); }
            else { const nueva = { id: `id-${t.length + 1}`, ...d }; t.push(nueva); afectadas.push(nueva); }
          }
        }
        return { data: selecciona ? afectadas : null, error: null };
      }
      consultas.push({ tabla, filtros: [...filtros], ...(filtrosOr.length ? { or: [...filtrosOr] } : {}) });
      const numeroLectura = (lecturas[tabla] ?? 0) + 1;
      lecturas[tabla] = numeroLectura;
      const errorPosterior = opciones.errorDespuesDe?.[tabla];
      const error = errorPosterior && numeroLectura >= errorPosterior.lectura
        ? { message: errorPosterior.mensaje }
        : err();
      return { data: error ? null : filas(), error };
    };
    const q: any = {
      select: () => { selecciona = true; return q; },
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
      in: (c: string, v: unknown[]) => { filtros.push([c, v]); return q; },
      not: (c: string, _o: string, _v: unknown) => { noNulos.push(c); return q; },
      gte: (c: string, v: string) => { comp.push((f) => String(f[c]) >= v); return q; },
      gt: (c: string, v: string) => { comp.push((f) => String(f[c]) > v); return q; },
      lte: (c: string, v: string) => { comp.push((f) => String(f[c]) <= v); return q; },
      lt: (c: string, v: string) => { comp.push((f) => String(f[c]) < v); return q; },
      neq: (c: string, v: unknown) => { comp.push((f) => f[c] !== v); return q; },
      is: (c: string, v: unknown) => { comp.push((f) => (f[c] ?? null) === v); return q; },
      or: (filtro: string) => { filtrosOr.push(filtro); return q; },
      order: () => q,
      range: () => q,
      limit: () => q,
      maybeSingle: async () => { const r = resultado(); return { data: (r.data as Fila[] | null)?.[0] ?? null, error: r.error }; },
      single: async () => { const r = resultado(); return { data: (r.data as Fila[] | null)?.[0] ?? null, error: r.error }; },
      insert: (d: unknown) => { op = "insert"; datos = d; return q; },
      upsert: (d: unknown, o?: typeof opts) => { op = "upsert"; datos = d; opts = o ?? {}; return q; },
      update: (d: unknown) => { op = "update"; datos = d; return q; },
      delete: () => { op = "delete"; return q; },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko),
    };
    return q;
  };
  const auth = {
    getUser: async (token: string) => {
      const alias = Object.keys(opciones.tokens ?? {}).find(a => tokenConSesion(a) === token);
      const id = opciones.tokens?.[alias ?? token];
      return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "invalid" } };
    },
  };
  return { from, auth, rpc, escrituras, consultas, tablas };
}
