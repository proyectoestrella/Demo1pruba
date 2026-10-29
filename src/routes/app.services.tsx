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
import { CampoFiltro } from "@/components/CampoFiltro";
import { EmptyState } from "@/components/EmptyState";
import { ColumnasServicios } from "@/components/ColumnasServicios";
import { ServiceFormSheet } from "@/components/ServiceFormSheet";
import { AjusteLavadoIncluido } from "@/components/AjusteLavadoIncluido";
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
import { Clock, MoreHorizontal, Plus, Scissors, Search, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
      const carta = a.serviceIds
        .map((id) => services.find((x) => x.id === id))
        .filter((x): x is Service => !!x);
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
  const masPedidos = [...services]
    .map((sv) => ({ sv, ...(uso.get(sv.id) ?? { veces: 0, euros: 0, minutos: 0 }) }))
    .sort((x, y) => y.veces - x.veces);
  const maxVeces = Math.max(1, ...masPedidos.map((x) => x.veces));
  const porDinero = [...masPedidos].sort((x, y) => y.euros - x.euros);
  const maxEuros = Math.max(1, ...porDinero.map((x) => x.euros));
  const listaPedidos = masPedidos.filter((x) => x.veces > 0).slice(0, TOPE_LISTAS);
  const listaDinero = porDinero.filter((x) => x.euros > 0).slice(0, TOPE_LISTAS);

  // Secciones de SU carta, con buscador y filtro por sección.
  const [texto, setTexto] = useState("");
  const [secciones, setSecciones] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const todas = useMemo(() => agruparCarta(services), [services]);
  const grupos = useMemo(
    () =>
      agruparCarta(services, { texto }).filter(
        (grupo) => !secciones.length || secciones.includes(grupo.categoria),
      ),
    [services, secciones, texto],
  );
  const conSecciones = todas.length > 1;
  // Duraciones que su web no da y estimamos nosotros (demo registrada).
  const slugDemo = useSalonStore((s) =>
    s.demoActive && !s.realSalonSlug ? s.salonProfile.slug : undefined,
  );

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
    <div className="pagina">
      <PageHeader
        title="Servicios y precios"
        actions={
          edita ? (
            <Button className="gap-1.5" onClick={openCreate}>
              <Plus className="size-[18px]" strokeWidth={1.6} /> Nuevo servicio
            </Button>
          ) : undefined
        }
      />

      {edita && services.length > 0 && <AjusteLavadoIncluido />}

      {services.length === 0 ? (
        <div className="flex-1 tarjeta-principal bg-card">
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
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center sm:gap-3">
                {conSecciones && (
                  <Popover open={filtrosAbiertos} onOpenChange={setFiltrosAbiertos}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 shrink-0 gap-2 rounded-full"
                      >
                        <SlidersHorizontal className="size-4" strokeWidth={1.6} />
                        Filtrar
                        {secciones.length > 0 && (
                          <span className="rounded-full bg-miel px-2 text-xs">
                            {secciones.length}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="sin-scrollbar max-h-[65dvh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">Tipo de servicio</p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 gap-1 px-2"
                          onClick={() => setFiltrosAbiertos(false)}
                        >
                          <X className="size-4" aria-hidden="true" />
                          Cerrar
                        </Button>
                      </div>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Puedes seleccionar varias secciones.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mb-2 w-full justify-start"
                        onClick={() => setSecciones([])}
                      >
                        {secciones.length
                          ? "Quitar todos los filtros"
                          : "Mostrando todas las secciones"}
                      </Button>
                      <div role="group" aria-label="Secciones de tu carta" className="grid gap-1.5">
                        {todas.map((grupo) => (
                          <label
                            key={grupo.categoria}
                            className={cn(
                              "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm",
                              secciones.includes(grupo.categoria)
                                ? "bg-salvia-suave font-semibold text-hoja-tinta"
                                : "text-cafe-medio hover:bg-nata",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={secciones.includes(grupo.categoria)}
                              className="size-4 shrink-0 accent-[var(--hoja)]"
                              onChange={() =>
                                setSecciones((actuales) =>
                                  actuales.includes(grupo.categoria)
                                    ? actuales.filter((categoria) => categoria !== grupo.categoria)
                                    : [...actuales, grupo.categoria],
                                )
                              }
                            />
                            <span className="flex-1">{grupo.categoria}</span>
                            <span className="text-xs tabular-nums">{grupo.servicios.length}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <CampoFiltro
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={`Buscar entre tus ${services.length} servicios`}
                  aria-label="Buscar servicio"
                  className="lg:ml-auto"
                />
              </div>
              {secciones.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {secciones.map((categoria) => (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() =>
                        setSecciones((actuales) => actuales.filter((c) => c !== categoria))
                      }
                      aria-label={`Quitar filtro: ${categoria}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-miel px-3.5 text-[13px] font-semibold text-cafe"
                    >
                      {categoria}
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {grupos.length === 0 ? (
            <div className="tarjeta-principal bg-card">
              <EmptyState
                icon={Search}
                title="Ningún servicio con ese nombre"
                description="Prueba con otra palabra o quita el filtro de sección."
              />
            </div>
          ) : (
            grupos.map((grupo) => (
              <section
                key={grupo.categoria}
                className="flex flex-col gap-3"
                aria-label={grupo.categoria}
              >
                {conSecciones && (
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 pt-1">
                    <h2 className="text-lg font-extrabold tracking-[-0.01em]">{grupo.categoria}</h2>
                  </div>
                )}
                <ColumnasServicios>
                  {grupo.servicios.map((s) => {
                    const n = indiceColorServicio(s.id, services);
                    const veces = uso.get(s.id)?.veces ?? 0;
                    return (
                      <div
                        key={s.id}
                        tabIndex={s.description ? 0 : undefined}
                        className={cn(
                          "tarjeta-servicio flex w-full flex-col tarjeta-secundaria border border-l-4 bg-card px-[var(--relleno-tarjeta)] py-3",
                          s.active === false && "opacity-60",
                        )}
                        style={{ borderLeftColor: `var(--serv-${n}-borde)` }}
                      >
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <div className="min-w-0 flex-auto">
                            <h3 className="text-base font-extrabold tracking-[-0.01em]">
                              {s.name}
                            </h3>
                            {s.category && !conSecciones && (
                              <p className="text-[12.5px] text-muted-foreground">{s.category}</p>
                            )}
                          </div>
                          {/* Con varios precios o un «desde», el texto tal y como lo anuncia
                        el salón; se reserva con el más bajo. */}
                          {s.priceText ? (
                            <span
                              className="max-w-[9.5rem] shrink-0 pt-0.5 text-right text-[15px] leading-snug font-extrabold tabular-nums"
                              title={`Se reserva con ${eur(s.priceEur)}`}
                            >
                              {s.priceText}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xl font-extrabold tabular-nums">
                              {eur(s.priceEur).replace(",00", "")}
                            </span>
                          )}
                          {edita && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9"
                                  aria-label={`Opciones de ${s.name}`}
                                >
                                  <MoreHorizontal className="size-[18px]" strokeWidth={1.6} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(s)}>
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => deleteService(s.id)}
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {s.description && (
                          <div className="descripcion-servicio">
                            <div className="min-h-0 overflow-hidden">
                              <p className="pt-2 text-[13px] leading-relaxed text-muted-foreground">
                                {s.description}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="mt-1.5 mb-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio tabular-nums">
                            <Clock className="size-3.5" strokeWidth={1.6} />
                            {duracionEstimada(slugDemo, s.id, s.durationMin) ? (
                              <span title="Duración estimada: tu web no la dice. Cámbiala en «Editar».">
                                ≈ {s.durationMin} min
                              </span>
                            ) : (
                              `${s.durationMin} min`
                            )}
                          </span>
                          {/* Lote P: con 60 servicios, «Color en la agenda» sesenta veces era
                        ruido; el color sigue en el borde y en esta muestra. */}
                          <span
                            className="inline-flex size-6 items-center justify-center rounded-md border border-cafe/40"
                            style={{ background: `var(--serv-${n})` }}
                            title="Color en la agenda"
                          >
                            <i
                              className="size-2.5 rounded-[3px]"
                              style={{ background: `var(--serv-${n}-borde)` }}
                            />
                            <span className="sr-only">Color en la agenda</span>
                          </span>
                          {servicioLlevaSenal(regla, s) && (
                            <span className="inline-flex h-6 items-center rounded-full bg-arena px-2.5 text-[12.5px] font-bold text-cafe-medio">
                              20 % de señal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                          <span className="text-[12.5px] text-muted-foreground tabular-nums">
                            {veces
                              ? `${veces} ${veces === 1 ? "vez" : "veces"} en 30 días`
                              : "Sin pedir en 30 días"}
                          </span>
                          <label className="flex items-center gap-2 text-[12.5px] font-bold text-cafe-medio">
                            {s.active === false ? "Oculto" : "Se puede reservar"}
                            {edita && (
                              <Switch
                                aria-label={`Permitir reservas para ${s.name}`}
                                checked={s.active !== false}
                                onCheckedChange={(checked) => {
                                  updateService(s.id, { active: checked });
                                }}
                              />
                            )}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </ColumnasServicios>
              </section>
            ))
          )}

          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:group-data-[panel=abierto]/panel:grid-cols-1">
            <section className="tarjeta-principal bg-card">
              <div className="flex flex-wrap items-baseline gap-x-2.5 px-[var(--relleno-tarjeta)] py-4">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">Lo más pedido</h2>
                <span className="text-[12.5px] text-muted-foreground">
                  {services.length > TOPE_LISTAS
                    ? `Los ${TOPE_LISTAS} primeros · veces en los últimos 30 días`
                    : "Veces en los últimos 30 días"}
                </span>
              </div>
              <div className="space-y-2.5 px-[var(--relleno-tarjeta)] pb-[var(--relleno-tarjeta)]">
                {listaPedidos.length === 0 && (
                  <p className="text-[13px] text-muted-foreground">
                    En los últimos 30 días no se ha pedido ningún servicio.
                  </p>
                )}
                {listaPedidos.map(({ sv, veces }, i) => (
                  <div
                    key={sv.id}
                    className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span className="font-semibold leading-tight [overflow-wrap:anywhere]">
                      {sv.name}
                    </span>
                    <span className="h-3 overflow-hidden rounded-full bg-nata">
                      <i
                        className="block h-full rounded-full"
                        style={{
                          width: `${(veces / maxVeces) * 100}%`,
                          background: i === 0 ? "var(--hoja)" : "var(--salvia)",
                        }}
                      />
                    </span>
                    <b className="text-right tabular-nums">{veces}</b>
                  </div>
                ))}
              </div>
            </section>
            {veDinero && (
              <section className="tarjeta-principal bg-card">
                <div className="flex flex-wrap items-baseline gap-x-2.5 px-[var(--relleno-tarjeta)] py-4">
                  <h2 className="text-base font-extrabold tracking-[-0.01em]">
                    Lo que deja cada servicio
                  </h2>
                  <span className="text-[12.5px] text-muted-foreground">
                    {services.length > TOPE_LISTAS ? `Los ${TOPE_LISTAS} que más dejan · ` : ""}
                    ingresos estimados en 30 días y lo que rinde cada hora
                  </span>
                </div>
                <div className="space-y-2.5 px-[var(--relleno-tarjeta)] pb-[var(--relleno-tarjeta)]">
                  {listaDinero.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      En los últimos 30 días todavía no ha entrado dinero por la carta.
                    </p>
                  )}
                  {listaDinero.map(({ sv, euros, minutos }, i) => (
                    <div
                      key={sv.id}
                      className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem_4.5rem] items-center gap-3 text-sm"
                    >
                      <span className="font-semibold leading-tight [overflow-wrap:anywhere]">
                        {sv.name}
                      </span>
                      <span className="h-3 overflow-hidden rounded-full bg-nata">
                        <i
                          className="block h-full rounded-full"
                          style={{
                            width: `${(euros / maxEuros) * 100}%`,
                            background: i === 0 ? "var(--hoja)" : "var(--salvia)",
                          }}
                        />
                      </span>
                      <b className="text-right tabular-nums">{eurRedondo(euros)}</b>
                      <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">
                        {minutos ? `${eurRedondo((euros / minutos) * 60)}/h` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      <ServiceFormSheet open={formOpen} onOpenChange={setFormOpen} service={editing} />
    </div>
  );
}
