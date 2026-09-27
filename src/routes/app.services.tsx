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
import { agruparCarta } from "@/lib/servicios-panel";
import { duracionEstimada } from "@/lib/demos";
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
import { Clock, MoreHorizontal, Plus, Scissors, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  // Lote P: con una carta de 60 servicios, las dos listas de abajo enseñan
  // los diez primeros; «Sin pedir» no aporta nada en una barra vacía.
  const TOPE_LISTAS = 10;
  const masPedidos = [...services].map((sv) => ({ sv, ...(uso.get(sv.id) ?? { veces: 0, euros: 0, minutos: 0 }) })).sort((x, y) => y.veces - x.veces);
  const maxVeces = Math.max(1, ...masPedidos.map((x) => x.veces));
  const porDinero = [...masPedidos].sort((x, y) => y.euros - x.euros);
  const maxEuros = Math.max(1, ...porDinero.map((x) => x.euros));
  const listaPedidos = masPedidos.filter((x) => x.veces > 0).slice(0, TOPE_LISTAS);
  const listaDinero = porDinero.filter((x) => x.euros > 0).slice(0, TOPE_LISTAS);

  // Secciones de SU carta, con buscador y filtro por sección.
  const [texto, setTexto] = useState("");
  const [seccion, setSeccion] = useState<string | null>(null);
  const todas = useMemo(() => agruparCarta(services), [services]);
  const grupos = useMemo(() => agruparCarta(services, { categoria: seccion, texto }), [services, seccion, texto]);
  const conSecciones = todas.length > 1;
  // Duraciones que su web no da y estimamos nosotros (demo registrada).
  const slugDemo = useSalonStore((s) => (s.demoActive && !s.realSalonSlug ? s.salonProfile.slug : undefined));
  const hayEstimadas = services.some((s) => duracionEstimada(slugDemo, s.id, s.durationMin));

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
          {(services.length > 8 || conSecciones) && (
            <div className="flex flex-col gap-3">
              <label className="relative block max-w-md">
                <span className="sr-only">Buscar servicio</span>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-cafe-suave" strokeWidth={1.6} aria-hidden="true" />
                <Input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={`Buscar entre tus ${services.length} servicios`}
                  className="h-11 rounded-full pl-10"
                />
              </label>
              {conSecciones && (
                // En el móvil, una tira que se desliza: siete secciones en fila
                // se comían media pantalla antes del primer servicio.
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Secciones de tu carta">
                  {[{ categoria: null as string | null, n: services.length, etiqueta: "Todas" }, ...todas.map((g) => ({ categoria: g.categoria as string | null, n: g.servicios.length, etiqueta: g.categoria }))].map((c) => (
                    <button
                      key={c.etiqueta}
                      type="button"
                      aria-pressed={seccion === c.categoria}
                      onClick={() => setSeccion(c.categoria)}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold whitespace-nowrap",
                        seccion === c.categoria ? "border-cafe bg-cafe text-white" : "border-border bg-card text-cafe-medio hover:bg-nata",
                      )}
                    >
                      {c.etiqueta}
                      <span className={cn("tabular-nums", seccion === c.categoria ? "text-white/80" : "text-cafe-suave")}>{c.n}</span>
                    </button>
                  ))}
                </div>
              )}
              {hayEstimadas && (
                <p className="text-[12.5px] text-muted-foreground">
                  Las duraciones con <b className="text-cafe-medio">≈</b> son una estimación nuestra: tu web no las dice. Cámbialas en «Editar» y dejan de estarlo.
                </p>
              )}
            </div>
          )}

          {grupos.length === 0 ? (
            <div className="rounded-[20px] border border-border bg-card">
              <EmptyState icon={Search} title="Ningún servicio con ese nombre" description="Prueba con otra palabra o quita el filtro de sección." />
            </div>
          ) : grupos.map((grupo) => (
          <section key={grupo.categoria} className="flex flex-col gap-3" aria-label={grupo.categoria}>
            {conSecciones && (
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 pt-1">
                <h2 className="text-lg font-extrabold tracking-[-0.01em]">{grupo.categoria}</h2>
                <span className="text-[12.5px] text-muted-foreground tabular-nums">
                  {grupo.servicios.length} {grupo.servicios.length === 1 ? "servicio" : "servicios"} · {grupo.desde === grupo.hasta ? eur(grupo.desde).replace(",00", "") : `de ${eur(grupo.desde).replace(",00", "")} a ${eur(grupo.hasta).replace(",00", "")}`}
                </span>
              </div>
            )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:group-data-[panel=abierto]/panel:grid-cols-1">
            {grupo.servicios.map((s) => {
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
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <div className="min-w-0 flex-auto">
                      <h3 className="text-base font-extrabold tracking-[-0.01em]">{s.name}</h3>
                      {s.category && !conSecciones && <p className="text-[12.5px] text-muted-foreground">{s.category}</p>}
                    </div>
                    {/* Con varios precios o un «desde», el texto tal y como lo anuncia
                        el salón; se reserva con el más bajo. */}
                    {s.priceText ? (
                      <span className="max-w-[9.5rem] shrink-0 pt-0.5 text-right text-[15px] leading-snug font-extrabold tabular-nums" title={`Se reserva con ${eur(s.priceEur)}`}>{s.priceText}</span>
                    ) : (
                      <span className="shrink-0 text-xl font-extrabold tabular-nums">{eur(s.priceEur).replace(",00", "")}</span>
                    )}
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
                  {s.description && <p className="mt-1 line-clamp-3 text-[13px] text-muted-foreground" title={s.description}>{s.description}</p>}
                  <div className="mt-3 mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio tabular-nums">
                      <Clock className="size-3.5" strokeWidth={1.6} />
                      {duracionEstimada(slugDemo, s.id, s.durationMin) ? (
                        <span title="Duración estimada: tu web no la dice. Cámbiala en «Editar».">≈ {s.durationMin} min</span>
                      ) : `${s.durationMin} min`}
                    </span>
                    {/* Lote P: con 60 servicios, «Color en la agenda» sesenta veces era
                        ruido; el color sigue en el borde y en esta muestra. */}
                    <span className="inline-flex size-6 items-center justify-center rounded-md border border-cafe/40" style={{ background: `var(--serv-${n})` }} title="Color en la agenda">
                      <i className="size-2.5 rounded-[3px]" style={{ background: `var(--serv-${n}-borde)` }} />
                      <span className="sr-only">Color en la agenda</span>
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
          </section>
          ))}

          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:group-data-[panel=abierto]/panel:grid-cols-1">
            <section className="rounded-[20px] border border-border bg-card">
              <div className="flex flex-wrap items-baseline gap-x-2.5 px-5 py-4">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">Lo más pedido</h2>
                <span className="text-[12.5px] text-muted-foreground">{services.length > TOPE_LISTAS ? `Los ${TOPE_LISTAS} primeros · veces en los últimos 30 días` : "Veces en los últimos 30 días"}</span>
              </div>
              <div className="space-y-2.5 px-5 pb-5">
                {listaPedidos.length === 0 && <p className="text-[13px] text-muted-foreground">En los últimos 30 días no se ha pedido ningún servicio.</p>}
                {listaPedidos.map(({ sv, veces }, i) => (
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
                <span className="text-[12.5px] text-muted-foreground">{services.length > TOPE_LISTAS ? `Los ${TOPE_LISTAS} que más dejan · ` : ""}ingresos estimados en 30 días y lo que rinde cada hora</span>
              </div>
              <div className="space-y-2.5 px-5 pb-5">
                {listaDinero.length === 0 && <p className="text-[13px] text-muted-foreground">En los últimos 30 días todavía no ha entrado dinero por la carta.</p>}
                {listaDinero.map(({ sv, euros, minutos }, i) => (
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
