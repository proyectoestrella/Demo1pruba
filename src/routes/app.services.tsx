import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { useSalonStore } from "@/lib/store";
import { reglaSenal, servicioLlevaSenal } from "@/lib/senal";
import { eur, eurRedondo } from "@/lib/copy";
import { indiceColorServicio } from "@/lib/hoy-arena";
import type { Service } from "@/lib/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ServiceFormSheet } from "@/components/ServiceFormSheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, MoreHorizontal, Plus, Scissors } from "lucide-react";

export const Route = createFileRoute("/app/services")({ component: ServicesPage });

function ServicesPage() {
  const services = useSalonStore((s) => s.services);
  const regla = reglaSenal(useSalonStore((s) => s.salonProfile));
  const updateService = useSalonStore((s) => s.updateService);
  const deleteService = useSalonStore((s) => s.deleteService);
  // Lote 11: recepción ve la carta pero no la cambia ni ve lo que deja cada servicio.
  const permisos = usePermisos();
  const edita = puede(permisos, "servicio.editar");
  const veDinero = puede(permisos, "dinero.ver-global");
  const appointments = useSalonStore((s) => s.appointments);

  // Últimos 30 días: cuántas veces se ha pedido cada servicio y lo que ha
  // dejado. Una cita con dos servicios reparte su importe según la carta.
  const uso = useMemo(() => {
    const desde = Date.now() - 30 * 86_400_000;
    const ahora = Date.now();
    const m = new Map<string, { veces: number; euros: number; minutos: number }>();
    for (const a of appointments) {
      const t = +new Date(a.start);
      if (t < desde || t > ahora) continue;
      if (a.status === "cancelled" || a.status === "no-show" || a.status === "blocked") continue;
      const carta = a.serviceIds.map((id) => services.find((x) => x.id === id)).filter((x): x is Service => !!x);
      const base = carta.reduce((t2, x) => t2 + x.priceEur, 0) || 1;
      for (const sv of carta) {
        const r = m.get(sv.id) ?? { veces: 0, euros: 0, minutos: 0 };
        r.veces += 1;
        r.euros += (a.priceEur * sv.priceEur) / base;
        r.minutos += sv.durationMin;
        m.set(sv.id, r);
      }
    }
    return m;
  }, [appointments, services]);
  const masPedidos = [...services].map((sv) => ({ sv, ...(uso.get(sv.id) ?? { veces: 0, euros: 0, minutos: 0 }) })).sort((x, y) => y.veces - x.veces);
  const maxVeces = Math.max(1, ...masPedidos.map((x) => x.veces));
  const porDinero = [...masPedidos].sort((x, y) => y.euros - x.euros);
  const maxEuros = Math.max(1, ...porDinero.map((x) => x.euros));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: Service) {
    setEditing(s);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title="Servicios y precios"
        description="Tu carta: lo que ofreces, cuánto dura y cuánto cuesta. El color es el que tiene en la agenda."
        actions={
          edita ? (
            <Button className="gap-1.5" onClick={openCreate}>
              <Plus className="size-[18px]" strokeWidth={1.6} /> Nuevo servicio
            </Button>
          ) : undefined
        }
      />

      {services.length === 0 ? (
        <div className="flex-1 rounded-[20px] border border-border bg-card">
          <EmptyState
            icon={Scissors}
            title="Sin servicios todavía"
            description="Añade tu primer servicio para que tus clientas puedan reservarlo."
            action={<Button onClick={openCreate}>Nuevo servicio</Button>}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:group-data-[panel=abierto]/panel:grid-cols-1">
            {services.map((s) => {
              const n = indiceColorServicio(s.id, services);
              const veces = uso.get(s.id)?.veces ?? 0;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex flex-col rounded-[20px] border border-l-4 border-border bg-card px-5 py-4",
                    s.active === false && "opacity-60",
                  )}
                  style={{ borderLeftColor: `var(--serv-${n}-borde)` }}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-extrabold tracking-[-0.01em]">{s.name}</h3>
                      {s.category && <p className="text-[12.5px] text-muted-foreground">{s.category}</p>}
                    </div>
                    <span className="text-xl font-extrabold tabular-nums">{eur(s.priceEur).replace(",00", "")}</span>
                    {edita && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-9" aria-label={`Opciones de ${s.name}`}>
                          <MoreHorizontal className="size-[18px]" strokeWidth={1.6} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteService(s.id)}>
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                  {s.description && <p className="mt-1 text-[13px] text-muted-foreground">{s.description}</p>}
                  <div className="mt-3 mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio tabular-nums">
                      <Clock className="size-3.5" strokeWidth={1.6} />
                      {s.durationMin} min
                    </span>
                    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-cafe px-2.5 text-[12.5px] font-bold text-cafe" style={{ background: `var(--serv-${n})` }}>
                      <i className="size-2.5 rounded-[3px]" style={{ background: `var(--serv-${n}-borde)` }} />
                      Color en la agenda
                    </span>
                    {servicioLlevaSenal(regla, s) && (
                      <span className="inline-flex h-6 items-center rounded-full bg-arena px-2.5 text-[12.5px] font-bold text-cafe-medio">20 % de señal</span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-[12.5px] text-muted-foreground tabular-nums">
                      {veces ? `${veces} ${veces === 1 ? "vez" : "veces"} en 30 días` : "Sin pedir en 30 días"}
                    </span>
                    <label className="flex items-center gap-2 text-[12.5px] font-bold text-cafe-medio">
                      {s.active === false ? "Oculto" : "Se puede reservar"}
                      {edita && <Switch
                        checked={s.active !== false}
                        onCheckedChange={(checked) => {
                          updateService(s.id, { active: checked });
                        }}
                      />}
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:group-data-[panel=abierto]/panel:grid-cols-1">
            <section className="rounded-[20px] border border-border bg-card">
              <div className="flex flex-wrap items-baseline gap-x-2.5 px-5 py-4">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">Lo más pedido</h2>
                <span className="text-[12.5px] text-muted-foreground">Veces en los últimos 30 días</span>
              </div>
              <div className="space-y-2.5 px-5 pb-5">
                {masPedidos.map(({ sv, veces }, i) => (
                  <div key={sv.id} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm">
                    <span className="font-semibold leading-tight [overflow-wrap:anywhere]">{sv.name}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-nata">
                      <i className="block h-full rounded-full" style={{ width: `${(veces / maxVeces) * 100}%`, background: i === 0 ? "var(--hoja)" : "var(--salvia)" }} />
                    </span>
                    <b className="text-right tabular-nums">{veces}</b>
                  </div>
                ))}
              </div>
            </section>
            {veDinero && <section className="rounded-[20px] border border-border bg-card">
              <div className="flex flex-wrap items-baseline gap-x-2.5 px-5 py-4">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">Lo que deja cada servicio</h2>
                <span className="text-[12.5px] text-muted-foreground">Ingresos estimados en 30 días y lo que rinde cada hora</span>
              </div>
              <div className="space-y-2.5 px-5 pb-5">
                {porDinero.map(({ sv, euros, minutos }, i) => (
                  <div key={sv.id} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem_4.5rem] items-center gap-3 text-sm">
                    <span className="font-semibold leading-tight [overflow-wrap:anywhere]">{sv.name}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-nata">
                      <i className="block h-full rounded-full" style={{ width: `${(euros / maxEuros) * 100}%`, background: i === 0 ? "var(--hoja)" : "var(--salvia)" }} />
                    </span>
                    <b className="text-right tabular-nums">{eurRedondo(euros)}</b>
                    <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">{minutos ? `${eurRedondo((euros / minutos) * 60)}/h` : "—"}</span>
                  </div>
                ))}
              </div>
            </section>}
          </div>
        </>
      )}

      <ServiceFormSheet open={formOpen} onOpenChange={setFormOpen} service={editing} />

    </div>
  );
}
