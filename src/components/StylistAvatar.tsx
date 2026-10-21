import { cn } from "@/lib/utils";
import { employeeMap } from "@/lib/mock/salon";
import type { EmployeeId } from "@/lib/mock/types";
import { Avatar } from "@/components/Avatar";

export type StylistAvatarSize = "sm" | "md" | "lg" | "xl";

const AVATAR_SIZE_CLASSES: Record<StylistAvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-32 text-2xl",
};

const AVATAR_SIZE_PIXELS: Record<StylistAvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 56,
  xl: 128,
};

/** Fallback color token used when neither `colorVar` nor a resolvable `employeeId` is given. */
const FALLBACK_COLOR_VAR = "--stylist-ruben";

/** Accepts "stylist-mario" or "--stylist-mario" and always returns the full CSS custom-property name. */
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
  /** Stylist color token, e.g. "stylist-mario" or "--stylist-mario". Takes precedence over `employeeId`. */
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
 * Adapter for the legacy public-site API. The actual face is rendered by the
 * shared Avatar component, so the panel and web never drift into two avatar
 * families.
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
  const pixels = AVATAR_SIZE_PIXELS[size];

  return (
    <Avatar
      nombre={name}
      id={employeeId}
      foto={photo}
      size={pixels}
      aro={cssVar}
      className={cn("border-0 font-bold text-foreground", AVATAR_SIZE_CLASSES[size], className)}
      decorativo={false}
    />
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
