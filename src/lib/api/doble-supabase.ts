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
  opciones: { tokens?: Record<string, string>; errorEn?: Record<string, string> } = {},
) {
  const escrituras: Escritura[] = [];
  const consultas: Array<{ tabla: string; filtros: Array<[string, unknown]> }> = [];
  const from = (tabla: string) => {
    const filtros: Array<[string, unknown]> = [];
    let op = "select";
    let datos: unknown;
    const err = () => (opciones.errorEn?.[tabla] ? { message: opciones.errorEn[tabla] } : null);
    const noNulos: string[] = [];
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every(([c, v]) => (Array.isArray(v) ? v.includes(f[c]) : f[c] === v)) && noNulos.every((c) => f[c] !== null && f[c] !== undefined));
    const resultado = () => {
      if (op !== "select") { escrituras.push({ tabla, op, datos, filtros: [...filtros] }); return { data: null, error: err() }; }
      consultas.push({ tabla, filtros: [...filtros] });
      return { data: err() ? null : filas(), error: err() };
    };
    const q: any = {
      select: () => q,
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
      in: (c: string, v: unknown[]) => { filtros.push([c, v]); return q; },
      not: (c: string, _o: string, _v: unknown) => { noNulos.push(c); return q; },
      order: () => q,
      range: () => q,
      limit: () => q,
      maybeSingle: async () => { const r = resultado(); return { data: (r.data as Fila[] | null)?.[0] ?? null, error: r.error }; },
      single: async () => { const r = resultado(); return { data: (r.data as Fila[] | null)?.[0] ?? null, error: r.error }; },
      insert: (d: unknown) => { op = "insert"; datos = d; return q; },
      upsert: (d: unknown) => { op = "upsert"; datos = d; return q; },
      update: (d: unknown) => { op = "update"; datos = d; return q; },
      delete: () => { op = "delete"; return q; },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko),
    };
    return q;
  };
  const auth = {
    getUser: async (token: string) => {
      const id = opciones.tokens?.[token];
      return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "invalid" } };
    },
  };
  return { from, auth, escrituras, consultas };
}
