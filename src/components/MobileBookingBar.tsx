import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export interface MobileBookingBarProps {
  salonSlug: string;
}

/**
 * Fixed bottom booking CTA, mobile-only (hidden from md up, where the header
 * already carries a persistent "Reservar" button). Hides itself once the
 * page footer scrolls into view so it never sits on top of footer content.
 */
export function MobileBookingBar({ salonSlug }: MobileBookingBarProps) {
  const [hideForFooter, setHideForFooter] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setHideForFooter(entry.isIntersecting), {
      rootMargin: "0px",
      threshold: 0,
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-3 backdrop-blur transition-transform duration-300 md:hidden ${
        hideForFooter ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <Link
        to="/s/$salonSlug/book"
        params={{ salonSlug }}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Reservar cita <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
