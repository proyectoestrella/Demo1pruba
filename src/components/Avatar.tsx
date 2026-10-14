import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSalonStore } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { hashTexto, iniciales, resolverAvatar } from "@/lib/avatar";
import { uriDeCurado } from "@/lib/avatar-svg";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const TAMANOS: Record<AvatarSize, { px: number; texto: string }> = {
  xs: { px: 24, texto: "text-[10px]" },
  sm: { px: 34, texto: "text-xs" },
  md: { px: 40, texto: "text-sm" },
  lg: { px: 56, texto: "text-base" },
  xl: { px: 72, texto: "text-xl" },
  "2xl": { px: 96, texto: "text-3xl" },
};

// Pasteles «Arena» con iniciales en café (DESIGN.md): solo arena, nata y lino.
const PALETA = ["--arena", "--nata", "--lino"];

export interface AvatarProps {
  nombre: string;
  /** Id de la persona: da el avatar por defecto, siempre el mismo. */
  id?: string;
  /** Foto real, si existe: sustituye a cualquier avatar. */
  foto?: string | null;
  /** Avatar elegido y guardado (`AvatarElegido`). */
  elegido?: unknown;
  size?: AvatarSize;
  /** Variable CSS de un color para el aro (profesionales). */
  aro?: string;
  className?: string;
  /** Si el nombre ya está escrito al lado, el avatar es decorativo (por defecto). */
  decorativo?: boolean;
}

/**
 * El avatar de una persona, en un solo sitio.
 * Prioridad: foto > avatar elegido > avatar por defecto según el id > iniciales.
 * Se dibuja en el navegador, sin red.
 */
export function Avatar({ nombre, id, foto, elegido, size = "md", aro, className, decorativo = true }: AvatarProps) {
  const t = TAMANOS[size];
  const [fotoRota, setFotoRota] = useState<string | null>(null);
  let r = resolverAvatar({ id, foto: foto && foto !== fotoRota ? foto : undefined, elegido });
  let uri: string | undefined;
  if (r.curado !== undefined) {
    try {
      uri = uriDeCurado(r.curado);
    } catch {
      r = { origen: "iniciales" };
    }
  }
  const caja = cn("relative shrink-0 overflow-hidden rounded-full select-none", className);
  const estilo = { width: t.px, height: t.px, ...(aro ? { boxShadow: `0 0 0 2px var(${aro})` } : {}) };
  const accesible = decorativo ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": nombre };

  if (r.origen === "foto") {
    return (
      <span className={caja} style={estilo} {...accesible} data-avatar="foto">
        <img src={r.foto} alt="" onError={() => setFotoRota(r.foto ?? null)} className="h-full w-full object-cover" />
      </span>
    );
  }
  if (uri) {
    return (
      <span className={caja} style={estilo} {...accesible} data-avatar={r.origen}>
        <img src={uri} alt="" draggable={false} className="h-full w-full object-cover" />
      </span>
    );
  }
  const color = PALETA[hashTexto(id ?? nombre) % PALETA.length];
  return (
    <span
      className={cn(caja, "flex items-center justify-center font-extrabold text-cafe", t.texto)}
      style={{ ...estilo, backgroundColor: `var(${color})` }}
      {...accesible}
      data-avatar="iniciales"
    >
      {iniciales(nombre)}
    </span>
  );
}

/** Avatar de una clienta: lee el que se haya elegido en el perfil del salón. */
export function AvatarClienta({ id, nombre, foto, size, className }: { id?: string; nombre: string; foto?: string | null; size?: AvatarSize; className?: string }) {
  const elegido = useSalonStore((s) => (id ? s.salonProfile.avataresClientas?.[id] : undefined));
  return <Avatar nombre={nombre} id={id} foto={foto} elegido={elegido} size={size} className={className} />;
}

/** Avatar de una profesional del panel, con el aro de su color. */
export function AvatarProfesional({ id, nombre, foto, size, colorVar, className }: { id: string; nombre: string; foto?: string | null; size?: AvatarSize; colorVar?: string; className?: string }) {
  const elegido = useSalonStore((s) => s.salonProfile.avataresEquipo?.[id]);
  const variable = colorVar ?? employeeMap[id]?.colorVar;
  const aro = variable ? (variable.startsWith("--") ? variable : `--${variable}`) : undefined;
  return <Avatar nombre={nombre} id={id} foto={foto} elegido={elegido} size={size} aro={aro} className={className} />;
}
