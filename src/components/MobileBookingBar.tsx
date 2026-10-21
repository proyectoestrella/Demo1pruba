import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { FUERA, IconoWhatsApp } from "@/components/web-salon/EnlacesSalon";
import { useEffect, useState } from "react";

export interface MobileBookingBarProps {
  salonSlug: string;
  /** Lote 18.4: con WhatsApp, un botón redondo al lado de «Reservar cita». */
  whatsappUrl?: string;
  /** Elemento cuyo CTA sustituye esta barra mientras permanece visible. */
  heroId: string;
}

/**
 * Botón fijo de «Reservar cita» en móvil (oculto desde md, donde la cabecera
 * ya lleva el suyo). Aparece al dejar atrás la portada: así no duplica sus
 * CTA y sigue disponible durante el resto de la página. El pie reserva su
 * alto (ver `s.$salonSlug.tsx`). Botón de 48 px, por encima del mínimo táctil.
 */
export function MobileBookingBar({ salonSlug, whatsappUrl, heroId }: MobileBookingBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero) return;

    const actualizar = () => setVisible(hero.getBoundingClientRect().bottom <= 0);
    actualizar();

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroId]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-lino bg-background/95 px-4 pt-3 backdrop-blur md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      data-barra-fija="reserva"
    >
      <div className="flex items-center gap-2">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            {...FUERA}
            aria-label="Escribir por WhatsApp"
            className="grid size-12 shrink-0 place-items-center rounded-full border border-lino-fuerte bg-card text-ws-eucalipto hover:bg-ws-arena"
          >
            <IconoWhatsApp className="h-5 w-5" />
          </a>
        )}
        <Link
          to="/s/$salonSlug/book"
          params={{ salonSlug }}
          search={(prev) => prev}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Reservar cita <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
