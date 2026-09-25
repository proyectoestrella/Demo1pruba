import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { clientFrequency, mostBookedService } from "@/lib/derive";
import { beforeLoadSiModuloVisible, useRedirigirSiModuloOculto } from "@/lib/route-guards";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoonAction } from "@/components/ComingSoonAction";
import { CampanasPanel } from "@/components/campanas/CampanasPanel";
import { Megaphone, Sparkles, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/marketing")({
  beforeLoad: beforeLoadSiModuloVisible("marketing"),
  component: Marketing,
});

function Marketing() {
  const visible = useRedirigirSiModuloOculto("marketing");
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  if (!visible) return null;

  const withStats = clients
    .map((c) => ({ ...c, ...clientFrequency(appointments, c.id) }))
    .filter((c) => c.visits > 0);

  const topSpenders = [...withStats].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
  const topService = mostBookedService(appointments);

  // "Llena las tardes de martes" y "Recupera clientes dormidos" ya no van
  // aquí: son, literalmente, las campañas "Huecos flojos" y "Clientes que no
  // vuelven" de arriba, ya con lista y mensaje de verdad en vez de un botón
  // "Próximamente" — mantener las dos versiones confundía más que ayudaba.
  const suggestions = [
    {
      icon: Sparkles,
      title: "Oferta de fidelidad",
      body: `Premia a tus ${topSpenders.length} clientes con más gasto con un servicio de cortesía.`,
      cta: "Preparar recompensa",
    },
    {
      icon: MessageCircle,
      title: "Caption para Instagram",
      body: `Destaca "${topService}", tu servicio más reservado esta temporada.`,
      cta: "Generar caption",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title="Marketing"
        description="Campañas calculadas a partir de tus propias reservas, con la lista y el mensaje ya preparados."
      />

      <CampanasPanel />

      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.02em]">Más ideas para más adelante</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Sugerencias calculadas a partir de tus reservas, todavía sin lista ni mensaje.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {suggestions.map((s) => (
            <div key={s.title} className="rounded-[20px] border border-border bg-card p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-nata text-primary">
                <s.icon className="size-[18px]" strokeWidth={1.6} />
              </span>
              <h3 className="mt-3 text-base font-extrabold">{s.title}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">{s.body}</p>
              <ComingSoonAction label={s.cta} />
            </div>
          ))}
        <div className="rounded-[20px] border border-border bg-card p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-nata text-primary">
            <Megaphone className="size-[18px]" strokeWidth={1.6} />
          </span>
          <div>
            <h3 className="mt-3 text-base font-extrabold">Recordatorios por WhatsApp</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Lo estamos terminando: recordatorio y confirmación de cada cita por WhatsApp desde el
              panel. Hoy las campañas de arriba te dejan lista y mensaje para mandarlos tú.
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
