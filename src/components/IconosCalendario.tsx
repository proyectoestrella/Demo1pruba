import { useId } from "react";

/**
 * Baldosas de icono para los botones "añadir al calendario" de la
 * confirmación de reserva pública (bloque de siempre y hoja móvil). SVG
 * inline propios —no son los logos reales de Apple ni de Google— pero
 * reconocibles por su lenguaje visual: franja roja con el día de la semana
 * al estilo de la app Calendario de iOS, y marco de cuatro colores al
 * estilo de Google Calendar. Ambos pintan el día real de la cita.
 *
 * `useId()` evita que dos baldosas iguales en la misma pantalla (el bloque
 * de siempre + la hoja móvil, montados a la vez) compartan el mismo
 * `clipPath` y se rompan entre sí.
 */

interface IconoBaldosaProps {
  className?: string;
}

export function IconoCalendarioApple({
  diaSemana,
  diaMes,
  className,
}: IconoBaldosaProps & { diaSemana: string; diaMes: number }) {
  const clipId = `hoja-apple-${useId()}`;
  return (
    <svg viewBox="0 0 40 40" role="img" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0.5" y="0.5" width="39" height="39" rx="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0.5" y="0.5" width="39" height="39" fill="#FFFFFF" />
        <rect x="0.5" y="0.5" width="39" height="12" fill="#FA3B30" />
        <text
          x="20"
          y="9"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="0.5"
          fill="#FFFFFF"
          fontFamily="system-ui, sans-serif"
        >
          {diaSemana}
        </text>
        <text
          x="20"
          y="27"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="17"
          fontWeight="800"
          fill="#2B2118"
          fontFamily="system-ui, sans-serif"
        >
          {diaMes}
        </text>
      </g>
      <rect x="0.5" y="0.5" width="39" height="39" rx="9" fill="none" stroke="#E3DCD3" />
    </svg>
  );
}

export function IconoCalendarioGoogle({ diaMes, className }: IconoBaldosaProps & { diaMes: number }) {
  const clipId = `hoja-google-${useId()}`;
  return (
    <svg viewBox="0 0 40 40" role="img" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0.5" y="0.5" width="39" height="39" rx="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0.5" y="0.5" width="39" height="39" fill="#FFFFFF" />
        <rect x="0.5" y="0.5" width="15" height="6" fill="#4285F4" />
        <rect x="24.5" y="0.5" width="15" height="6" fill="#34A853" />
        <rect x="0.5" y="33.5" width="15" height="6" fill="#FBBC04" />
        <rect x="24.5" y="33.5" width="15" height="6" fill="#EA4335" />
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="16"
          fontWeight="800"
          fill="#3C4043"
          fontFamily="system-ui, sans-serif"
        >
          {diaMes}
        </text>
      </g>
      <rect x="0.5" y="0.5" width="39" height="39" rx="9" fill="none" stroke="#E3DCD3" />
    </svg>
  );
}
