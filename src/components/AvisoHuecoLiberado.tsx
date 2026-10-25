import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { usePlanSalon } from "@/lib/accesos-panel";
import { rutaIncluidaEnPlan } from "@/lib/plan-basico";

/**
 * Lista de espera operativa (apuntes del 22-oct: «que no queden huecos
 * vacíos»): en cuanto se cancela una cita y hay clientas esperando, el panel
 * lo avisa en cualquier pantalla con un botón directo a «Avisar».
 */
export function AvisoHuecoLiberado() {
  const hueco = useSalonStore((s) => s.lastFreedSlot);
  const enEspera = useSalonStore((s) => s.waitlist.length);
  const slug = useSalonStore((s) => s.realSalonSlug ?? s.salonProfile.slug);
  const plan = usePlanSalon();
  const navigate = useNavigate();
  const ultimo = useRef<string | null>(null);
  useEffect(() => {
    if (!hueco || hueco === ultimo.current) return;
    ultimo.current = hueco;
    if (enEspera === 0 || !rutaIncluidaEnPlan("/app/waitlist", plan, slug)) return;
    const cuando = new Date(hueco).toLocaleString("es-ES", { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    toast(`Se ha liberado un hueco (${cuando})`, {
      description: `${enEspera} ${enEspera === 1 ? "clienta espera" : "clientas esperan"} en la lista de espera.`,
      duration: 20_000,
      action: { label: "Avisar", onClick: () => void navigate({ to: "/app/waitlist" }) },
    });
  }, [hueco, enEspera, plan, slug, navigate]);
  return null;
}
