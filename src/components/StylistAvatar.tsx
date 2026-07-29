import { cn } from "@/lib/utils";
import { employeeMap } from "@/lib/mock/salon";
import type { EmployeeId } from "@/lib/mock/types";

export type StylistAvatarSize = "sm" | "md" | "lg" | "xl";

const AVATAR_SIZE_CLASSES: Record<StylistAvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-32 text-2xl",
};

/** Fallback color token used when neither `colorVar` nor a resolvable `employeeId` is given. */
const FALLBACK_COLOR_VAR = "--stylist-luna";

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

/** Accepts "stylist-ines" or "--stylist-ines" and always returns the full CSS custom-property name. */
function normalizeColorVar(colorVar?: string): string | undefined {
  if (!colorVar) return undefined;
  return colorVar.startsWith("--") ? colorVar : `--${colorVar}`;
}

function resolveColorVar(colorVar?: string, employeeId?: EmployeeId): string {
  return (
    normalizeColorVar(colorVar) ??
    (employeeId ? employeeMap[employeeId]?.colorVar : undefined) ??
    FALLBACK_COLOR_VAR
  );
}

export interface StylistAvatarProps {
  /** Full name used to derive the 1-2 letter initials shown in the circle. */
  name: string;
  /** Stylist color token, e.g. "stylist-ines" or "--stylist-ines". Takes precedence over `employeeId`. */
  colorVar?: string;
  /** Employee id used to auto-resolve the color token from mock/salon.ts when `colorVar` is not passed. */
  employeeId?: EmployeeId;
  /**
   * Optional photo URL. When given, a real photo is shown (ring-bordered in
   * the stylist's color) instead of the initials-on-color avatar. Omit to
   * keep the original initials look — fully opt-in, existing callers are
   * unaffected.
   */
  photo?: string;
  size?: StylistAvatarSize;
  className?: string;
}

/**
 * Stylist avatar: shows a real photo when one is provided via `photo`, and
 * falls back to the original initials-on-color avatar otherwise (design rule
 * for the no-photo case: no AI-looking stylist face photos — see
 * DESIGN-DIRECTION §3.5). Callers opt in to photos explicitly per use site.
 */
export function StylistAvatar({
  name,
  colorVar,
  employeeId,
  photo,
  size = "md",
  className,
}: StylistAvatarProps) {
  const cssVar = resolveColorVar(colorVar, employeeId);

  if (photo) {
    return (
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded-full border-2 select-none",
          AVATAR_SIZE_CLASSES[size],
          className,
        )}
        style={{ borderColor: `var(${cssVar})` }}
        title={name}
      >
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        AVATAR_SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: `var(${cssVar})` }}
      title={name}
      aria-label={name}
    >
      {initialsFor(name)}
    </div>
  );
}

export interface StylistDotProps {
  colorVar?: string;
  employeeId?: EmployeeId;
  className?: string;
}

/** Compact color indicator (no initials) for dense contexts: tables, legends, filter chips. */
export function StylistDot({ colorVar, employeeId, className }: StylistDotProps) {
  const cssVar = resolveColorVar(colorVar, employeeId);
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: `var(${cssVar})` }}
      aria-hidden="true"
    />
  );
}
