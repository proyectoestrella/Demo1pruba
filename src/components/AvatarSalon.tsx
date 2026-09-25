import { useState } from "react";
import { useSalonStore } from "@/lib/store";
import { logoDelSalon } from "@/lib/logo-salon";
import { cn } from "@/lib/utils";

/**
 * Círculo del salón: su logo recortado al círculo sobre fondo blanco, o la
 * inicial si no hay logo o la imagen no carga. `logoForzado` sirve para la
 * vista previa del editor, antes de guardar.
 */
export function AvatarSalon({
  size,
  className,
  claseInicial,
  logoForzado,
}: {
  size: number;
  className?: string;
  /** Aspecto del círculo con la inicial (fondo y tipografía). */
  claseInicial?: string;
  logoForzado?: string | null;
}) {
  const name = useSalonStore((s) => s.salonProfile.name);
  const logoUrl = useSalonStore((s) => s.salonProfile.logoUrl);
  const esDemo = useSalonStore((s) => !s.realSalonSlug);
  const logo = logoForzado !== undefined ? logoForzado : logoDelSalon({ name, logoUrl }, esDemo);
  const [fallo, setFallo] = useState<string | null>(null);
  const inicial = name.trim().charAt(0).toUpperCase() || "?";
  if (logo && fallo !== logo) {
    return (
      <span
        className={cn("block shrink-0 overflow-hidden rounded-full border border-lino bg-white", className)}
        style={{ width: size, height: size }}
      >
        <img src={logo} alt={`Logo de ${name}`} onError={() => setFallo(logo)} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full font-extrabold", claseInicial ?? "bg-stylist-mario text-cafe", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {inicial}
    </span>
  );
}
