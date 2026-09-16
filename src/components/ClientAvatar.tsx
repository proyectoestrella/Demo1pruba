import { cn } from "@/lib/utils";

export type ClientAvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ClientAvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
};

// Paleta de gráficos (no la de estilistas, para no dar a entender que un
// cliente "es" un profesional): cinco tonos ya preparados para claro y
// oscuro en styles.css.
const PALETTE = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

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
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
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
