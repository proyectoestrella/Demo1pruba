/**
 * Quién puede tocar qué. Es el punto único por el que pasan las funciones de
 * servidor antes de leer o escribir nada de un salón.
 *
 * EL PROBLEMA QUE CIERRA, sin adornos: hasta ahora cualquiera que escribiera
 * `/app?s=the-best-shave-barber` veía el panel de ese salón con la lista de
 * sus clientes y sus teléfonos. Las funciones de servidor entran con la
 * service role key —que se salta la seguridad de la base de datos por
 * definición— y ninguna comprobaba quién llamaba. El slug no es un secreto:
 * está en la URL pública de la web de reservas.
 *
 * LA REGLA, que manda sobre todo lo demás:
 *
 *   - Si el slug NO tiene fila en `salons`, es una DEMO de venta: se entra
 *     como siempre, sin pedir nada. Esto no se toca. El equipo comercial
 *     enseña las demos en la calle desde un enlace, y una demo que pida
 *     credenciales es una venta perdida.
 *   - Si el slug SÍ tiene fila, es un salón de pago: hace falta sesión y una
 *     fila en `salon_members` que diga que ese usuario puede entrar ahí.
 *
 * Quién decide cuál de los dos casos es: EL SERVIDOR, consultando `salons`.
 * Nunca un parámetro que mande el navegador.
 *
 * Este módulo es a propósito pura lógica, sin Supabase y sin cabeceras
 * dentro: todo lo que habla con el mundo entra por `DepsAutorizacion`. Así se
 * puede probar de verdad que el salón A no llega al B, que es lo único que
 * demuestra que esto funciona. El cableado real está en `autorizacion.server.ts`.
 */

/** Qué es quien está llamando, respecto al salón que ha pedido. */
export type Acceso =
  /** El slug no existe en `salons`: es una demo. Barra libre, como siempre. */
  | { tipo: "demo" }
  /** Salón de pago y quien llama pertenece a él. */
  | { tipo: "miembro"; userId: string }
  /** Salón de pago y quien llama NO ha demostrado pertenecer a él. */
  | { tipo: "ajeno" };

export interface DepsAutorizacion {
  /** ¿Hay fila en `salons` con este slug? */
  esSalonReal: (slug: string) => Promise<boolean>;
  /** El token que trae la petición en `Authorization`, o null si no trae ninguno. */
  tokenDeLaPeticion: () => string | null;
  /** Verifica el token contra Supabase y devuelve el id del usuario, o null. */
  usuarioDelToken: (token: string) => Promise<string | null>;
  /** ¿Existe fila en `salon_members` para esta pareja? */
  esMiembro: (userId: string, slug: string) => Promise<boolean>;
}

/**
 * Saca el token de una cabecera `Authorization`.
 *
 * Tolera el desorden real: minúsculas, mayúsculas y espacios de más. No
 * tolera una cabecera que no sea `Bearer`, ni un token vacío.
 */
export function extraerBearer(cabecera: string | null | undefined): string | null {
  if (!cabecera) return null;
  const limpio = cabecera.trim();
  const sep = limpio.indexOf(" ");
  if (sep < 0) return null;
  if (limpio.slice(0, sep).toLowerCase() !== "bearer") return null;
  const token = limpio.slice(sep + 1).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resuelve qué es quien llama respecto a este salón.
 *
 * El orden importa y es este a propósito:
 *
 *   1. Lo PRIMERO es preguntar si el salón es real. Si no lo es, se acabó:
 *      es una demo y no se pide nada. Ni siquiera se mira si hay token.
 *   2. Solo para un salón real se mira el token, se verifica y se comprueba
 *      la pertenencia.
 *
 * Nunca lanza. Devolver "ajeno" y dejar que decida quien llama es lo que
 * permite que `listSalonData` responda con menos datos en vez de con un error
 * —que es justo lo que necesita la web pública de reservas de un salón real.
 */
export async function resolverAcceso(slug: string, deps: DepsAutorizacion): Promise<Acceso> {
  if (!(await deps.esSalonReal(slug))) return { tipo: "demo" };

  const token = deps.tokenDeLaPeticion();
  if (!token) return { tipo: "ajeno" };

  let userId: string | null = null;
  try {
    userId = await deps.usuarioDelToken(token);
  } catch (err) {
    // Un token caducado, manipulado o un Supabase que no responde son todos
    // el mismo caso desde aquí: no se ha demostrado nada.
    console.error("No se pudo verificar la sesión de quien llama:", err);
    return { tipo: "ajeno" };
  }
  if (!userId) return { tipo: "ajeno" };

  // Tener sesión no es tener acceso. Un usuario del salón A tiene una sesión
  // perfectamente válida y aquí es exactamente igual de ajeno al salón B.
  if (!(await deps.esMiembro(userId, slug))) return { tipo: "ajeno" };

  return { tipo: "miembro", userId };
}

/** ¿Manda este llamante sobre el salón? Cierto para un miembro y para una demo. */
export function tieneMando(acceso: Acceso): boolean {
  return acceso.tipo === "miembro" || acceso.tipo === "demo";
}

/** El error que se le devuelve a quien pide un salón que no es suyo. */
export class AccesoDenegado extends Error {
  readonly code = "ACCESO_DENEGADO";
  constructor(slug: string) {
    super(
      `No tienes acceso al panel de "${slug}". Entra con tu correo desde /login, o pídele acceso a quien gestione el salón.`,
    );
    this.name = "AccesoDenegado";
  }
}

/**
 * Lo mismo, pero cortando: para todo lo que solo puede hacer el dueño.
 *
 * Lo usan las funciones que escriben o que leen datos de personas: guardar el
 * perfil, borrar citas, marcar deudas, escribir notas de un cliente.
 */
export async function exigirMando(slug: string, deps: DepsAutorizacion): Promise<Acceso> {
  const acceso = await resolverAcceso(slug, deps);
  if (!tieneMando(acceso)) throw new AccesoDenegado(slug);
  return acceso;
}

/**
 * Qué vista se le sirve de verdad a quien llama.
 *
 * Antes, `scope: "panel"` —el que devuelve la lista completa de clientes con
 * sus nombres, teléfonos, correos, notas y deudas— lo elegía QUIEN LLAMABA.
 * Es decir: la distinción entre "web pública" y "panel del dueño" la decidía
 * el navegador, que es como cerrar con llave y dejarla puesta.
 *
 * Ahora lo que manda el navegador es como mucho una PREFERENCIA, y el
 * servidor la recorta a lo que esa persona tiene derecho a ver:
 *
 *   - Un miembro (o una demo) que pide "panel" → recibe "panel".
 *   - Cualquiera que pida "publica" → recibe "publica", aunque sea el dueño.
 *     Así la web de reservas sigue siendo la web de reservas incluso abierta
 *     desde el móvil del dueño con la sesión iniciada.
 *   - Un ajeno que pide "panel" → recibe "publica". No se le da un error: la
 *     web de reservas de un salón de pago tiene que seguir funcionando para
 *     cualquiera que entre a pedir hora. Lo que no recibe es un solo dato de
 *     un cliente.
 */
export function vistaEfectiva(
  pedida: "panel" | "publica",
  acceso: Acceso,
): "panel" | "publica" {
  if (pedida === "publica") return "publica";
  return tieneMando(acceso) ? "panel" : "publica";
}
