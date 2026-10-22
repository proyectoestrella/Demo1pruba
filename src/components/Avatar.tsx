import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSalonStore } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { hashTexto, iniciales, resolverAvatar } from "@/lib/avatar";
import { retratoGuardado, retratoPorDefecto } from "@/lib/retratos-avatar";
import { useFotoActiva } from "@/hooks/use-foto-persona";
import { useDibujoRetratos } from "@/hooks/use-dibujo-retratos";

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
  size?: AvatarSize | number;
  /** Variable CSS de un color para el aro (profesionales). */
  aro?: string;
  /** Un color ya resuelto para el aro (cuando no hay variable). */
  aroColor?: string;
  className?: string;
  /** Si el nombre ya está escrito al lado, el avatar es decorativo (por defecto). */
  decorativo?: boolean;
  /** Sin foto ni avatar elegido, iniciales en vez del retrato automático (clientas, 22-oct). */
  inicialesPorDefecto?: boolean;
}

/**
 * El avatar de una persona, en un solo sitio.
 * Prioridad: foto > avatar elegido > avatar por defecto según el id > iniciales.
 * Sin foto ni avatar elegido, un retrato estable según el id. Los retratos
 * son DiceBear «Notionists», generados en el navegador sin red; la librería se
 * carga bajo demanda y, mientras tanto, se pinta un círculo neutro del mismo
 * tamaño (sin saltos de maquetación).
 * Este es el único punto de render de avatar.
 */
export function Avatar({
  nombre,
  id,
  foto,
  elegido,
  size = "md",
  aro,
  aroColor,
  className,
  decorativo = true,
  inicialesPorDefecto = false,
}: AvatarProps) {
  const t =
    typeof size === "number"
      ? { px: size, texto: size >= 40 ? "text-sm" : "text-[11px]" }
      : TAMANOS[size];
  const [fotoRota, setFotoRota] = useState<string | null>(null);
  const r = resolverAvatar({ id, foto: foto && foto !== fotoRota ? foto : undefined, elegido });
  const conDibujo = (r.origen === "elegido" && r.avatar !== undefined) || (r.origen === "defecto" && !inicialesPorDefecto);
  const dibujo = useDibujoRetratos(conDibujo);
  const retratoElegido = r.origen === "elegido" ? retratoGuardado(elegido) : undefined;
  const retratoAutomatico = r.origen === "defecto" && !inicialesPorDefecto ? retratoPorDefecto(id ?? nombre) : undefined;
  const uri =
    conDibujo && dibujo
      ? retratoElegido || retratoAutomatico
        ? dibujo.uriRetrato(
            retratoElegido ?? retratoAutomatico!,
            t.px,
            retratoAutomatico ? (id ?? nombre) : undefined,
          )
        : dibujo.avatarDiceBearUri(r.avatar!, t.px)
      : undefined;
  const caja = cn("relative block shrink-0 overflow-hidden rounded-full select-none", className);
  const estilo = {
    width: t.px,
    height: t.px,
    ...(aro || aroColor ? { boxShadow: `0 0 0 2px ${aro ? `var(${aro})` : aroColor}` } : {}),
  };
  const accesible = decorativo
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": nombre };

  if (r.origen === "foto") {
    return (
      <span className={caja} style={estilo} {...accesible} data-avatar="foto">
        <img
          src={r.foto}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFotoRota(r.foto ?? null)}
          className="h-full w-full object-cover"
        />
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
  if (conDibujo && dibujo === undefined) {
    // DiceBear aún cargando: círculo neutro del mismo tamaño.
    return (
      <span className={cn(caja, "bg-nata")} style={estilo} {...accesible} data-avatar="cargando" />
    );
  }
  // Sin dibujo (o si DiceBear no pudo cargar): iniciales.
  const color = PALETA[hashTexto(id ?? nombre) % PALETA.length];
  return (
    <span
      className={cn(
        caja,
        "!flex items-center justify-center font-display font-semibold tracking-tight text-cafe",
        t.texto,
      )}
      style={{ ...estilo, backgroundColor: `var(${color})` }}
      {...accesible}
      data-avatar="iniciales"
    >
      {iniciales(nombre)}
    </span>
  );
}

/** Avatar de una clienta: lee el que se haya elegido en el perfil del salón. */
export function AvatarClienta({
  id,
  nombre,
  foto,
  size,
  className,
}: {
  id?: string;
  nombre: string;
  foto?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const elegido = useSalonStore((s) => (id ? s.salonProfile.avataresClientas?.[id] : undefined));
  // Una foto subida a propósito manda sobre todo; si falla la carga, Avatar cae al dibujado.
  const subida = useFotoActiva("clienta", id);
  return (
    <Avatar
      nombre={nombre}
      id={id}
      foto={subida ?? foto}
      elegido={elegido}
      size={size}
      className={className}
      inicialesPorDefecto
    />
  );
}

/** Avatar de una profesional del panel, con el aro de su color. */
export function AvatarProfesional({
  id,
  nombre,
  foto,
  size,
  colorVar,
  aroColor,
  className,
}: {
  id: string;
  nombre: string;
  foto?: string | null;
  size?: AvatarSize | number;
  colorVar?: string;
  aroColor?: string;
  className?: string;
}) {
  const elegido = useSalonStore((s) => s.salonProfile.avataresEquipo?.[id]);
  const subida = useFotoActiva("equipo", id);
  const variable = colorVar ?? employeeMap[id]?.colorVar;
  const aro = variable ? (variable.startsWith("--") ? variable : `--${variable}`) : undefined;
  // Foto subida (activa) > avatar elegido > foto de stock de las demos de barbería.
  return (
    <Avatar
      nombre={nombre}
      id={id}
      foto={subida ?? (elegido ? undefined : foto)}
      elegido={elegido}
      size={size}
      aro={aroColor ? undefined : aro}
      aroColor={aroColor}
      className={className}
    />
  );
}
