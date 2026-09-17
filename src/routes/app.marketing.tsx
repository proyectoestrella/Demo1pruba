import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { clientFrequency, mostBookedService } from "@/lib/derive";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoonAction } from "@/components/ComingSoonAction";
import { CampanasPanel } from "@/components/campanas/CampanasPanel";
import { Megaphone, Sparkles, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/marketing")({ component: Marketing });

function Marketing() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);

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
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">Marketing</p>
        <PageHeader title="Campañas listas para enviar." />
        <p className="mt-1 text-sm text-muted-foreground">
          Calculadas a partir de tus propias reservas, con la lista y el mensaje ya preparados.
        </p>
      </div>

      <CampanasPanel />

      <div className="space-y-4 border-t border-border/60 pt-8">
        <div>
          <h2 className="font-display text-xl">Más ideas para más adelante</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sugerencias calculadas a partir de tus reservas, todavía sin lista ni mensaje.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((s) => (
            <div key={s.title} className="rounded-xl border border-border/60 bg-card p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 font-display text-xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              <ComingSoonAction label={s.cta} />
            </div>
          ))}
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-6">
          <Megaphone className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <h3 className="font-display text-lg">Recordatorios por WhatsApp</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lo estamos terminando: recordatorio y confirmación de cada cita por WhatsApp desde el
              panel. Hoy las campañas de arriba te dejan lista y mensaje para mandarlos tú.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
