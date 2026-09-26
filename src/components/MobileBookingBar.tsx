import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export interface MobileBookingBarProps {
  salonSlug: string;
}

/**
 * Botón fijo de «Reservar cita» en móvil (oculto desde md, donde la cabecera
 * ya lleva el suyo). Lote 17: SIEMPRE visible — antes se escondía al llegar
 * al pie y en la parte baja de la página no había forma de reservar sin
 * volver arriba. Para que no tape nada, el pie reserva su alto (ver
 * `s.$salonSlug.tsx`). Botón de 48 px, por encima del mínimo táctil.
 */
export function MobileBookingBar({ salonSlug }: MobileBookingBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-lino bg-background/95 px-4 pt-3 backdrop-blur md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      data-barra-fija="reserva"
    >
      <Link
        to="/s/$salonSlug/book"
        params={{ salonSlug }}
        search={(prev) => prev}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Reservar cita <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
