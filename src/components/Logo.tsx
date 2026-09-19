import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  /**
   * Nombre accesible del icono para lectores de pantalla. Por defecto
   * "Trimly" (el panel y el login, donde no hay un salón de por medio), pero
   * la web pública de un salón debe pasar el nombre DEL SALÓN: un lector de
   * pantalla no debe anunciar el nombre interno del producto en la web de un
   * cliente de pago (hallazgo de accesibilidad de la auditoría de UX).
   */
  label?: string;
}

/**
 * Trimly monogram: a pair of open barber scissors inside a circular frame.
 * Hand-drawn inline SVG (no external assets — CSP forbids remote images).
 * Uses `currentColor` so it inherits the surrounding text color and adapts
 * automatically to light/dark theme.
 */
export function Logo({ className, label = "Trimly" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className={cn("h-8 w-8 shrink-0 text-primary", className)}
    >
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.5" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11.2" cy="10.4" r="2.3" />
        <circle cx="11.2" cy="21.6" r="2.3" />
        <path d="M12.9 11.9 L23 22" />
        <path d="M12.9 20.1 L23 10" />
      </g>
    </svg>
  );
}
