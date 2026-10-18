import {
  IDS_AVATAR,
  claveAvatarValida,
  serializarAvatar,
  type AvatarClave,
  type AvatarComposicion,
  type AvatarId,
} from "./avatar-svg";

/** Avatares propios que se guardan a partir de ahora. */
export interface AvatarElegido {
  style: "trimly";
  /** Id de v1 o receta compacta de v2 (`v2:01234`). */
  avatar: AvatarClave;
}
/** Forma que ya vive en perfiles guardados de versiones anteriores. */
export interface AvatarOpenPeepsLegado {
  style: "openPeeps";
  curado: number;
}
export type AvatarGuardado = AvatarElegido | AvatarOpenPeepsLegado;
export type MapaAvatares = Record<string, AvatarGuardado>;
export type OrigenAvatar = "foto" | "elegido" | "defecto" | "iniciales";
export interface AvatarResuelto {
  origen: OrigenAvatar;
  avatar?: AvatarClave;
  foto?: string;
}

/** Los 48 índices Open Peeps se traducen de forma estable a la nueva familia. */
export const TOTAL_AVATARES_LEGADOS = 48;
export const MAPA_OPEN_PEEPS_LEGADO: readonly AvatarId[] = Array.from(
  { length: TOTAL_AVATARES_LEGADOS },
  (_, indice) => IDS_AVATAR[indice % IDS_AVATAR.length],
);

export function hashTexto(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
export function avatarIdValido(valor: unknown): valor is AvatarClave {
  return claveAvatarValida(valor);
}

/** Acepta tanto el formato nuevo como los 48 valores Open Peeps ya guardados. */
export function avatarValido(valor: unknown): valor is AvatarGuardado {
  if (!valor || typeof valor !== "object") return false;
  const avatar = valor as Partial<AvatarGuardado>;
  return (
    (avatar.style === "trimly" && avatarIdValido((avatar as Partial<AvatarElegido>).avatar)) ||
    (avatar.style === "openPeeps" &&
      Number.isInteger((avatar as Partial<AvatarOpenPeepsLegado>).curado) &&
      (avatar as Partial<AvatarOpenPeepsLegado>).curado! >= 0 &&
      (avatar as Partial<AvatarOpenPeepsLegado>).curado! < TOTAL_AVATARES_LEGADOS)
  );
}

/** Resuelve una elección guardada (también la histórica) al id de SVG actual. */
export function avatarIdDeElegido(valor: unknown): AvatarClave | undefined {
  if (!avatarValido(valor)) return undefined;
  return valor.style === "trimly" ? valor.avatar : MAPA_OPEN_PEEPS_LEGADO[valor.curado];
}
/** Avatar que se guarda desde el selector; v2 ocupa solo cinco caracteres de receta. */
export function elegirAvatar(avatar: AvatarClave | AvatarComposicion): AvatarElegido {
  const clave = typeof avatar === "string" ? avatar : serializarAvatar(avatar);
  if (!avatarIdValido(clave)) throw new Error("Avatar no válido");
  return { style: "trimly", avatar: clave };
}
/** Avatar automático estable para el mismo id. */
export function avatarPorDefecto(id: string): AvatarId {
  return IDS_AVATAR[hashTexto(id) % IDS_AVATAR.length];
}

export function resolverAvatar(entrada: {
  id?: string;
  foto?: string | null;
  elegido?: unknown;
}): AvatarResuelto {
  const foto = entrada.foto?.trim();
  if (foto) return { origen: "foto", foto };
  const elegido = avatarIdDeElegido(entrada.elegido);
  if (elegido) return { origen: "elegido", avatar: elegido };
  if (entrada.id) return { origen: "defecto", avatar: avatarPorDefecto(entrada.id) };
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
export function conAvatar(
  mapa: MapaAvatares | undefined,
  id: string,
  avatar: AvatarElegido | null,
): MapaAvatares {
  const salida = { ...(mapa ?? {}) };
  if (avatar) salida[id] = avatar;
  else delete salida[id];
  return salida;
}
