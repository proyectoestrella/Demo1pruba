import { cn } from "@/lib/utils";

/** Símbolo de siShow: «sí» en blanco sobre un círculo moca. */
export function SimboloSishow({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#7A5539" />
      <text
        x="20"
        y="26.2"
        textAnchor="middle"
        fontFamily="Manrope, ui-sans-serif, system-ui, sans-serif"
        fontWeight="800"
        fontSize="17"
        fill="#FFFFFF"
      >
        sí
      </text>
    </svg>
  );
}

/** Logotipo completo: símbolo y nombre. El texto visible es el nombre accesible. */
export function MarcaSishow({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SimboloSishow />
      <span className="text-[1.35rem] font-extrabold leading-none tracking-[-0.02em]">siShow</span>
    </span>
  );
}
