import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { clientFrequency, mostBookedService } from "@/lib/derive";
import { PageHeader } from "@/components/PageHeader";
import { Megaphone, Sparkles, MessageCircle, Gift, Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/marketing")({ component: Marketing });

const DORMANT_DAYS = 42; // ~6 weeks

function Marketing() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);

  const withStats = clients.map((c) => ({ ...c, ...clientFrequency(appointments, c.id) })).filter((c) => c.visits > 0);

  const now = Date.now();
  const dormant = withStats.filter((c) => c.lastVisit && now - +new Date(c.lastVisit) > DORMANT_DAYS * 86_400_000);

  const tueClientIds = new Set(
    appointments.filter((a) => new Date(a.start).getDay() === 2 && a.status !== "cancelled").map((a) => a.clientId),
  );

  const topSpenders = [...withStats].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
  const topService = mostBookedService(appointments);

  const suggestions = [
    {
      icon: Clock,
      title: "Llena las tardes de martes",
      body: `${tueClientIds.size} clientes ya han reservado en martes. Envíales un 10% de promo para animar el resto del hueco.`,
      cta: "Generar campaña",
    },
    {
      icon: Gift,
      title: "Recupera clientes dormidos",
      body: `${dormant.length} clientes no reservan desde hace más de 6 semanas. Mándales un recordatorio personalizado.`,
      cta: "Enviar recordatorio",
    },
    {
      icon: Sparkles,
      title: "Oferta de fidelidad",
      body: `Premia a tus ${topSpenders.length} clientes con más gasto con un blow-dry de cortesía.`,
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
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">Marketing con IA</p>
        <PageHeader title="Crece en piloto automático." />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {suggestions.map((s) => (
          <div key={s.title} className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <s.icon className="h-4 w-4" />
            </div>
            <h3 className="mt-4 font-display text-xl">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            <button
              type="button"
              onClick={() => toast.success("Campaña generada", { description: s.title })}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {s.cta} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-4 rounded-xl border border-dashed border-border bg-card p-6">
        <Megaphone className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="font-display text-lg">Integración con WhatsApp Business</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Próximamente — envía recordatorios, confirmaciones y ofertas directamente por WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
