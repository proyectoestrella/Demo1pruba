/**
 * Avatares de personas del panel (clientas y equipo): estilo DiceBear Open
 * Peeps (CC0 1.0, Pablo Stanley; se comprueba en `openPeeps.meta.license`).
 *
 * Prioridad de lo que se enseña, de más a menos fuerte:
 *   foto > avatar elegido > avatar por defecto (según el id) > iniciales.
 *
 * Aquí vive la parte pura (qué avatar toca y cómo se guarda); el dibujo está
 * en `avatar-svg.ts` para que esto no arrastre la librería a quien solo
 * necesita decidir.
 */

/** Cuántos avatares curados ofrece el selector. */
export const TOTAL_AVATARES = 48;

/**
 * Lo que se guarda en el perfil del salón (JSON existente, sin columnas
 * nuevas): el índice del curado. `style` deja la puerta abierta a otros
 * estilos o a opciones libres sin migrar nada.
 */
export interface AvatarElegido {
  style: "openPeeps";
  /** Posición en la rejilla de curados (0 a 47). */
  curado: number;
}

export type MapaAvatares = Record<string, AvatarElegido>;

export type OrigenAvatar = "foto" | "elegido" | "defecto" | "iniciales";

export interface AvatarResuelto {
  origen: OrigenAvatar;
  /** Índice del curado a dibujar (solo con `elegido` o `defecto`). */
  curado?: number;
  foto?: string;
}

export function hashTexto(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** ¿Es un valor guardado que sabemos dibujar? Protege de datos viejos o a medias. */
export function avatarValido(v: unknown): v is AvatarElegido {
  if (!v || typeof v !== "object") return false;
  const a = v as Partial<AvatarElegido>;
  return a.style === "openPeeps" && Number.isInteger(a.curado) && (a.curado as number) >= 0 && (a.curado as number) < TOTAL_AVATARES;
}

/** El curado que le toca a alguien que no ha elegido: siempre el mismo para el mismo id. */
export function curadoPorDefecto(id: string): number {
  return hashTexto(id) % TOTAL_AVATARES;
}

export function elegirAvatar(curado: number): AvatarElegido {
  return { style: "openPeeps", curado };
}

/**
 * Decide qué se pinta. Sin id ni avatar elegido no hay forma de que el
 * defecto sea estable, así que se cae a las iniciales.
 */
export function resolverAvatar(entrada: { id?: string; foto?: string | null; elegido?: unknown }): AvatarResuelto {
  const foto = entrada.foto?.trim();
  if (foto) return { origen: "foto", foto };
  if (avatarValido(entrada.elegido)) return { origen: "elegido", curado: entrada.elegido.curado };
  if (entrada.id) return { origen: "defecto", curado: curadoPorDefecto(entrada.id) };
  return { origen: "iniciales" };
}

export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Devuelve el mapa con el avatar de `id` cambiado (o quitado si `avatar` es null). */
export function conAvatar(mapa: MapaAvatares | undefined, id: string, avatar: AvatarElegido | null): MapaAvatares {
  const salida = { ...(mapa ?? {}) };
  if (avatar) salida[id] = avatar;
  else delete salida[id];
  return salida;
}
