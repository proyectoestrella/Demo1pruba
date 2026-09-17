import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  Gift,
  type LucideIcon,
  MessageCircle,
  Repeat,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { employees } from "@/lib/mock/salon";
import {
  buildCampanas,
  resumenDelMes,
  whatsappUrl,
  COMPARATIVA_OTRAS_PLATAFORMAS,
  type Campana,
  type CampanaPersona,
} from "@/lib/campanas";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ICONOS: Record<string, LucideIcon> = {
  "no-vuelven": Gift,
  "huecos-flojos": Clock,
  "segunda-visita": Repeat,
  resena: Star,
  upsell: Sparkles,
};

/**
 * Pantalla de campañas listas para enviar, calculadas sobre las citas y
 * clientes reales del salón — ver `lib/campanas.ts`. Nada se envía desde
 * aquí: cada tarjeta prepara el texto y la lista, y el dueño lo manda desde
 * su propio WhatsApp con un toque.
 */
export function CampanasPanel() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const salonProfile = useSalonStore((s) => s.salonProfile);

  const campanas = useMemo(
    () =>
      buildCampanas({
        appointments,
        clients,
        services,
        // `employees` vive mutado en sitio por tipo de negocio (ver
        // mock/salon.ts) y no en la store; esta pantalla vuelve a leerlo en
        // cada render, igual que ya hacen app.appointments.tsx e
        // app.insights.tsx.
        employees,
        salonName: salonProfile.name,
        salonAddress: salonProfile.address,
      }),
    [appointments, clients, services, salonProfile.name, salonProfile.address],
  );

  const resumen = resumenDelMes(campanas);

  return (
    <div className="space-y-6">
      <ResumenBanner recuperables={resumen.recuperables} huecos={resumen.huecos} />

      {campanas.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState
            icon={Users}
            title="Todavía no hay datos suficientes"
            description="En cuanto tengas más citas y clientes, aquí aparecerán campañas concretas para enviar."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campanas.map((campana) => (
            <CampanaCard key={campana.id} campana={campana} />
          ))}
        </div>
      )}

      <ComparativaCard />
    </div>
  );
}

function ResumenBanner({ recuperables, huecos }: { recuperables: number; huecos: number }) {
  if (recuperables === 0 && huecos === 0) return null;
  const partes: string[] = [];
  if (recuperables > 0) {
    partes.push(`recuperar ${recuperables} ${recuperables === 1 ? "cliente" : "clientes"}`);
  }
  if (huecos > 0) {
    partes.push(`rellenar ${huecos} ${huecos === 1 ? "hueco" : "huecos"}`);
  }
  return (
    <div className="flex items-start gap-4 rounded-xl border border-primary/30 bg-primary/5 p-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-display text-lg">
          Este mes puedes {partes.join(" y ")}.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Calculado sobre tus propias citas — cada tarjeta de abajo trae la lista y el mensaje listo.
        </p>
      </div>
    </div>
  );
}

function CampanaCard({ campana }: { campana: Campana }) {
  // Mientras el dueño no lo edite, el texto sigue al mensaje calculado: si
  // se fijara al montar, se quedaría con el nombre del salón de ejemplo que
  // renderiza el servidor antes de que el navegador recupere el perfil real.
  const [editado, setEditado] = useState<string | null>(null);
  const mensaje = editado ?? campana.mensaje;
  const Icon = ICONOS[campana.id] ?? Sparkles;

  async function copiarMensaje() {
    try {
      await navigator.clipboard.writeText(mensaje);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No he podido copiarlo — selecciónalo a mano", { description: mensaje });
    }
  }

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <Badge variant="secondary" className="shrink-0 font-normal text-muted-foreground">
          {campana.coste}
        </Badge>
      </div>

      <h3 className="mt-4 font-display text-xl">{campana.titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{campana.resumenAQuien}</p>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-2xl tabular-nums">{campana.cifra}</span>
        <span className="text-sm text-muted-foreground">{campana.cifraLabel}</span>
      </div>

      <Textarea
        value={mensaje}
        onChange={(e) => setEditado(e.target.value)}
        rows={4}
        className="mt-4 resize-none break-words text-sm"
        aria-label={`Mensaje sugerido para "${campana.titulo}"`}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copiarMensaje}>
          <Copy className="h-3.5 w-3.5" /> Copiar mensaje
        </Button>
      </div>

      <Accordion type="single" collapsible className="mt-4">
        <AccordionItem value="personas" className="border-none">
          <AccordionTrigger className="rounded-md border border-border/60 px-3 py-2 text-sm hover:no-underline">
            A quién: {campana.personas.length}{" "}
            {campana.personas.length === 1 ? "persona" : "personas"}
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <ListaPersonas personas={campana.personas} mensaje={mensaje} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function ListaPersonas({ personas, mensaje }: { personas: CampanaPersona[]; mensaje: string }) {
  return (
    <div className="max-h-72 divide-y divide-border/50 overflow-y-auto rounded-md border border-border/60">
      {personas.map((p) => (
        <div key={p.clientId} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{p.detalle}</p>
          </div>
          {p.telefono ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => window.open(whatsappUrl(p.telefono!, mensaje), "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">Sin teléfono</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ComparativaCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <h3 className="font-display text-xl">Lo que te cuesta en otras plataformas</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Precios reales de campañas de marketing que se pagan aparte, canal a canal.
      </p>

      {/* Desktop: tabla. Nunca de scroll horizontal en móvil — se sustituye por
       * tarjetas apiladas debajo, igual que ya hace app.appointments.tsx. */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Canal</th>
              <th className="py-2 pr-3 font-medium">Otras plataformas</th>
              <th className="py-2 font-medium">Aquí</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {COMPARATIVA_OTRAS_PLATAFORMAS.map((fila) => (
              <tr key={fila.concepto}>
                <td className="py-2.5 pr-3">{fila.concepto}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{fila.otras}</td>
                <td className="py-2.5 font-medium text-primary">{fila.siShow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3 md:hidden">
        {COMPARATIVA_OTRAS_PLATAFORMAS.map((fila) => (
          <div key={fila.concepto} className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">{fila.concepto}</p>
            <div className="mt-1.5 flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Otras plataformas: {fila.otras}</span>
              <span className="font-medium text-primary">Aquí: {fila.siShow}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
