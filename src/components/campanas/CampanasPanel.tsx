import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Copy,
  Send,
  Gift,
  type LucideIcon,
  MessageCircle,
  Repeat,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { cn } from "@/lib/utils";
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
  const employees = useEquipo();
  /**
   * Campañas preparadas en esta sesión. No se envía nada ni se guarda en el
   * servidor: es la lista de lo que ya tiene el mensaje listo y espera a que
   * la dueña lo mande desde su WhatsApp.
   */
  const [preparadas, setPreparadas] = useState<{ id: string; titulo: string; personas: number; cuando: string }[]>([]);

  const campanas = useMemo(
    () =>
      buildCampanas({
        appointments,
        clients,
        services,
        // El equipo de la store: el array de mock/salon.ts se muta en sitio y
        // no avisa a React cuando cambia.
        employees,
        salonName: salonProfile.name,
        salonAddress: salonProfile.address,
      }),
    [appointments, clients, services, employees, salonProfile.name, salonProfile.address],
  );

  const resumen = resumenDelMes(campanas);

  return (
    <div className="space-y-5">
      <ResumenBanner recuperables={resumen.recuperables} huecos={resumen.huecos} />

      {campanas.length === 0 ? (
        <div className="rounded-[20px] border border-border bg-card">
          <EmptyState
            icon={Users}
            title="Todavía no hay datos suficientes"
            description="En cuanto tengas más citas y clientes, aquí aparecerán campañas concretas para enviar."
          />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 xl:group-data-[panel=abierto]/panel:grid-cols-1">
          {campanas.map((campana) => (
            <CampanaCard
              key={campana.id}
              campana={campana}
              onPreparar={() =>
                setPreparadas((lista) => [
                  { id: `${campana.id}-${Date.now()}`, titulo: campana.titulo, personas: campana.personas.length, cuando: new Date().toISOString() },
                  ...lista,
                ])
              }
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2 xl:group-data-[panel=abierto]/panel:grid-cols-1">
        <HistorialCard preparadas={preparadas} />
        <ComparativaCard />
      </div>
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
    <div className="flex items-start gap-3 rounded-2xl bg-salvia-clara px-4 py-3.5 text-hoja-tinta">
      <Sparkles className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.6} />
      <div>
        <h2 className="text-base font-extrabold">
          Este mes puedes {partes.join(" y ")}.
        </h2>
        <p className="text-[12.5px]">
          Calculado sobre tus propias citas — cada tarjeta de abajo trae la lista y el mensaje listo.
        </p>
      </div>
    </div>
  );
}

/** «¡Hola, {nombre}!» → «¡Hola, Marta!»: el nombre de pila de quien lo recibe. */
function personalizar(mensaje: string, nombre: string | undefined) {
  return mensaje.replace(/\{nombre\}/g, (nombre ?? "").trim().split(/\s+/)[0] || "");
}

function CampanaCard({ campana, onPreparar }: { campana: Campana; onPreparar: () => void }) {
  // Mientras el dueño no lo edite, el texto sigue al mensaje calculado: si
  // se fijara al montar, se quedaría con el nombre del salón de ejemplo que
  // renderiza el servidor antes de que el navegador recupere el perfil real.
  const [editado, setEditado] = useState<string | null>(null);
  const [preparada, setPreparada] = useState(false);
  const mensaje = editado ?? campana.mensaje;
  const Icon = ICONOS[campana.id] ?? Sparkles;
  const primera = campana.personas[0];

  async function copiarMensaje(aviso = true) {
    try {
      await navigator.clipboard.writeText(mensaje);
      if (aviso) toast.success("Mensaje copiado");
      return true;
    } catch {
      if (aviso) toast.error("No he podido copiarlo — selecciónalo a mano", { description: mensaje });
      return false;
    }
  }
  async function preparar() {
    const copiado = await copiarMensaje(false);
    setPreparada(true);
    onPreparar();
    toast.success("Envío preparado", {
      description: copiado
        ? `Mensaje copiado. Mándalo tú desde tu WhatsApp a las ${campana.personas.length} personas de la lista.`
        : `Mándalo tú desde tu WhatsApp a las ${campana.personas.length} personas de la lista.`,
    });
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-border bg-card">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nata text-primary">
          <Icon className="size-[18px]" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold tracking-[-0.01em]">{campana.titulo}</h3>
          <p className="text-[12.5px] text-muted-foreground">{campana.resumenAQuien}</p>
        </div>
        <div className="max-w-[38%] text-right">
          <span className="block text-[22px] leading-tight font-extrabold tabular-nums">{campana.cifra}</span>
          <span className="line-clamp-2 text-[12px] leading-tight text-muted-foreground" title={campana.cifraLabel}>{campana.cifraLabel}</span>
        </div>
      </div>

      <div className="grid gap-3 px-5 pt-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col">
          <label className="mb-1.5 flex items-center justify-between text-[12.5px] font-bold text-cafe-medio" htmlFor={`msg-${campana.id}`}>
            Mensaje
            <button
              type="button"
              className="rounded-full border border-input px-2 py-0.5 text-[11.5px] font-bold hover:bg-nata"
              onClick={() => setEditado(`${mensaje}${mensaje.endsWith(" ") ? "" : " "}{nombre}`)}
            >
              + {"{nombre}"}
            </button>
          </label>
          <Textarea
            id={`msg-${campana.id}`}
            value={mensaje}
            onChange={(e) => setEditado(e.target.value)}
            rows={6}
            className="flex-1 resize-none text-sm [overflow-wrap:anywhere]"
          />
          <p className="mt-1 text-[11.5px] text-muted-foreground">«{"{nombre}"}» se cambia por el nombre de cada clienta.</p>
        </div>
        <div className="flex min-w-0 flex-col rounded-2xl bg-nata p-3">
          <p className="mb-2 text-[11.5px] font-bold text-muted-foreground">Así le llega{primera ? ` a ${primera.nombre.split(/\s+/)[0]}` : ""}</p>
          <div className="ml-auto max-w-[92%] min-w-0 rounded-2xl rounded-br-md bg-salvia-clara px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap text-foreground shadow-[var(--sombra-tarjeta)] [overflow-wrap:anywhere]">
            {personalizar(mensaje, primera?.nombre) || "Escribe el mensaje a la izquierda."}
            <span className="mt-1 block text-right text-[10.5px] text-hoja-tinta tabular-nums">{new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <Button className="gap-1.5" onClick={preparar}>
          {preparada ? <Check className="size-[18px]" strokeWidth={1.6} /> : <Send className="size-[18px]" strokeWidth={1.6} />}
          {preparada ? "Preparado otra vez" : "Preparar envío"}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => void copiarMensaje()}>
          <Copy className="size-[18px]" strokeWidth={1.6} /> Copiar mensaje
        </Button>
        <span className={cn("ml-auto inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold", preparada ? "border-[1.5px] border-dashed border-moca bg-card text-primary" : "bg-nata text-cafe-medio")}>
          {preparada ? "Preparada · falta tu visto bueno" : campana.coste}
        </span>
      </div>

      <Accordion type="single" collapsible className="mt-4 border-t border-border">
        <AccordionItem value="personas" className="border-none">
          <AccordionTrigger className="px-5 py-3 text-sm font-bold hover:no-underline">
            A quién: {campana.personas.length}{" "}
            {campana.personas.length === 1 ? "persona" : "personas"}
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <ListaPersonas personas={campana.personas} mensaje={mensaje} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function HistorialCard({ preparadas }: { preparadas: { id: string; titulo: string; personas: number; cuando: string }[] }) {
  return (
    <section className="rounded-[20px] border border-border bg-card">
      <div className="px-5 py-4">
        <h3 className="text-base font-extrabold tracking-[-0.01em]">Campañas preparadas</h3>
        <p className="text-[12.5px] text-muted-foreground">Lo que ya tiene el mensaje listo. Lo mandas tú desde tu WhatsApp: siShow no envía nada solo.</p>
      </div>
      {preparadas.length === 0 ? (
        <p className="border-t border-border px-5 py-4 text-[12.5px] text-muted-foreground">
          Todavía ninguna. Pulsa «Preparar envío» en una campaña y aparecerá aquí.
        </p>
      ) : (
        <ul>
          {preparadas.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-t border-border px-5 py-3">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm">{p.titulo}</b>
                <span className="text-[12.5px] text-muted-foreground tabular-nums">
                  {p.personas} personas · {new Date(p.cuando).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <span className="inline-flex h-6 items-center rounded-full border-[1.5px] border-dashed border-moca bg-card px-2.5 text-[12px] font-bold text-primary">
                Preparada · falta tu visto bueno
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ListaPersonas({ personas, mensaje }: { personas: CampanaPersona[]; mensaje: string }) {
  return (
    <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
      {personas.map((p) => (
        <div key={p.clientId} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{p.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{p.detalle}</p>
          </div>
          {p.telefono ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => window.open(whatsappUrl(p.telefono!, personalizar(mensaje, p.nombre)), "_blank", "noopener,noreferrer")}
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
    <div className="rounded-[20px] border border-border bg-card p-5">
      <h3 className="text-base font-extrabold tracking-[-0.01em]">Lo que te cuesta en otras plataformas</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Precios reales de campañas de marketing que se pagan aparte, canal a canal.
      </p>

      {/* Desktop: tabla. Nunca de scroll horizontal en móvil — se sustituye por
       * tarjetas apiladas debajo, igual que ya hace app.appointments.tsx. */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
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
                <td className="py-2.5 font-bold text-hoja-tinta">{fila.siShow}</td>
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
