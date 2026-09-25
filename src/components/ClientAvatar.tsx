import { cn } from "@/lib/utils";

export type ClientAvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ClientAvatarSize, string> = {
  sm: "size-[34px] text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-[52px] text-[17px]",
};

// Pasteles «Arena» con iniciales en café (DESIGN.md: el texto sobre pastel
// va siempre en café). Solo arena y nata tostada: los tonos de las
// profesionales (taupe, salvia) se reservan para ellas.
const PALETTE = ["--arena", "--nata", "--lino"];

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export interface ClientAvatarProps {
  name: string;
  size?: ClientAvatarSize;
  className?: string;
}

/**
 * Avatar de iniciales para clientes: no hay foto de cliente en el modelo
 * (ni la puede haber sin tocar src/lib/mock, fuera de alcance), así que el
 * color se deriva de forma estable a partir del nombre — el mismo cliente
 * siempre sale con el mismo color, sin guardar nada nuevo.
 */
export function ClientAvatar({ name, size = "md", className }: ClientAvatarProps) {
  const cssVar = PALETTE[hashString(name) % PALETTE.length];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold text-cafe select-none",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: `var(${cssVar})` }}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </div>
  );
}
