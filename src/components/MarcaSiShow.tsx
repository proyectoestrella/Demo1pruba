import { cn } from "@/lib/utils";

/** Logo oficial de siShow (assets en /public/marca). Nunca para el logo de un salón. */
export function IconoSiShow({ className, size = 32 }: { className?: string; size?: number }) {
  return <img src="/marca/sishow-icono.svg" alt="siShow" width={size} height={size} className={cn("shrink-0 rounded-[22%]", className)} />;
}

/** Letras oficiales: oscuras sobre fondo claro, blancas sobre fondo oscuro. */
export function LetrasSiShow({ className, fondo = "claro" }: { className?: string; fondo?: "claro" | "oscuro" }) {
  return (
    <img
      src={fondo === "oscuro" ? "/marca/sishow-letras-blancas.svg" : "/marca/sishow-letras-oscuras.svg"}
      alt="siShow"
      className={cn("h-auto w-auto", className)}
    />
  );
}
