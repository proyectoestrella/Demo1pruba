import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ClipboardCopy, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { usePermisos, useTienePlan } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { calcularDescuadre, pagosEntreDias, TEXTO_CAJA_NO_FACTURA } from "@/lib/pagos";
import { PAYMENT_METHOD_LABELS } from "@/lib/mock/types";
import { downloadCsv, pagosToCsvGestoria } from "@/lib/export-csv";
import { generarCsvGestoria } from "@/lib/api/pagos.functions";
import { leerEuros } from "@/lib/cobro-panel";
import { fechaLocal } from "@/lib/hoja-del-dia";
import { zonaDelSalon } from "@/lib/zona-horaria";
import { PageHeader } from "@/components/PageHeader";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { BotonConPlan } from "@/components/BotonConPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContador } from "@/lib/movimiento-panel";
import { cn } from "@/lib/utils";
import { VentanaCobrar } from "@/components/VentanaCobrar";
import type { Appointment } from "@/lib/mock/types";
import {
  METODOS_CAJA,
  diasAnteriores,
  movimientosPorDia,
  pendientesDeCobrar,
  porHora,
  porProfesional as porProfesionalDe,
  resumen,
  textoResumen,
  variacion,
} from "@/lib/caja-resumen-panel";

export const Route = createFileRoute("/app/caja")({
  head: () => ({ meta: [{ title: "Caja del día · siShow" }] }),
  component: CajaDelDia,
});

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const diaDe = (clave: string) => {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const sumarDias = (clave: string, n: number) => {
  const d = diaDe(clave);
  d.setDate(d.getDate() + n);
  return fechaLocal(d);
};

/**
 * Caja del día (14b, página `caja`: gerente y subencargada). Lo cobrado ese
 * día por forma de pago y por profesional, la lista de cobros, «Cerrar el
 * día» con el efectivo contado y el descuadre, y «Exportar para la
 * gestoría». Lo esperado del cierre es solo el EFECTIVO apuntado (lo que hay
 * en el cajón). Nada de esto es un ticket ni una factura.
 */
function CajaDelDia() {
  const hoy = fechaLocal(new Date());
  const [dia, setDia] = useState(hoy);
  const pagos = useSalonStore((s) => s.payments);
  const cargarPagos = useSalonStore((s) => s.cargarPagos);
  const borrarPago = useSalonStore((s) => s.borrarPago);
  const cerrarCaja = useSalonStore((s) => s.cerrarCaja);
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  const equipo = useEquipo();
  const permisos = usePermisos();
  const guardaCierre = useTienePlan("caja-cierre");
  useEffect(() => {
    void cargarPagos(dia, dia);
  }, [dia, cargarPagos]);

  // El día en la zona del salón (como el servidor), no el del navegador ni el de UTC.
  const zona = useSalonStore((s) => zonaDelSalon(s.salonProfile));
  const citas = useSalonStore((s) => s.appointments);
  const salonNombre = useSalonStore((s) => s.salonProfile.name);
  // Lote 16: pagos apuntados + citas cobradas sin pago (historial y demo),
  // del día, de ayer y del mismo día de la semana pasada, en una pasada.
  const porDia = useMemo(() => movimientosPorDia(pagos, citas, sumarDias(dia, -7), dia, zona), [pagos, citas, dia, zona]);
  const delDia = porDia.get(dia) ?? [];
  const r = resumen(delDia);
  const porMetodo = r.porMetodo;
  const total = r.total;
  const rAyer = resumen(porDia.get(sumarDias(dia, -1)) ?? []);
  const rSemana = resumen(porDia.get(sumarDias(dia, -7)) ?? []);
  const horas = porHora(delDia);
  const maxHora = Math.max(1, ...horas.map((h) => h.total));
  const anteriores = useMemo(() => diasAnteriores(pagos, citas, dia, zona, 14), [pagos, citas, dia, zona]);
  const [ahoraCaja] = useState(() => new Date());
  const pendientes = useMemo(() => pendientesDeCobrar(citas, dia, zona, ahoraCaja), [citas, dia, zona, ahoraCaja]);
  const [cobrando, setCobrando] = useState<Appointment | null>(null);
  const [verPendientes, setVerPendientes] = useState(false);
  const nombre = (id?: string) => equipo.find((e) => e.id === id)?.name ?? "—";
  const porPro = porProfesionalDe(delDia, equipo);
  const [copiado, setCopiado] = useState(false);
  async function copiarResumen() {
    const texto = textoResumen({ salon: salonNombre, etiquetaDia: dia === hoy ? `hoy, ${etiquetaDia}` : etiquetaDia, r, porProfesional: porPro, pendientes: dia === hoy ? pendientes.length : 0 });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
      toast.success("Resumen copiado: pégalo en WhatsApp o en el correo a la gestoría");
    } catch {
      toast.error("No se ha podido copiar. Tu navegador no deja usar el portapapeles aquí.");
    }
  }

  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const contadoN = leerEuros(contado);
  const cuadre = Number.isFinite(contadoN) ? calcularDescuadre(contadoN, porMetodo.efectivo) : null;
  async function cerrar() {
    if (!cuadre) return;
    const r = await cerrarCaja(dia, cuadre.efectivoContado, nota.trim() || undefined);
    if (r) toast.success(`Día cerrado: ${cuadre.descuadre === 0 ? "cuadra" : cuadre.descuadre > 0 ? `sobran ${eur(cuadre.descuadre)}` : `faltan ${eur(-cuadre.descuadre)}`}.`);
    else toast("En esta demo el cierre no se guarda: es el cálculo, para enseñarlo.");
  }

  const [desde, setDesde] = useState(sumarDias(hoy, -30));
  const [hasta, setHasta] = useState(hoy);
  async function exportar() {
    let csv: string | null = null;
    if (realSlug) {
      const r = await generarCsvGestoria({ data: { slug: realSlug, desde, hasta } });
      csv = r.csv;
    } else {
      csv = pagosToCsvGestoria(pagosEntreDias(pagos, desde, hasta, zona));
    }
    if (!csv) return void toast.error("No se ha podido generar el fichero. Inténtalo en un momento.");
    downloadCsv(`caja-${desde}-a-${hasta}.csv`, csv);
    toast.success("Fichero para la gestoría descargado");
  }

  const etiquetaDia = diaDe(dia).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader title="Caja del día" description="Lo cobrado, cómo se cobró y quién lo cobró. Para cuadrar el cajón al cerrar." />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Día anterior" onClick={() => setDia(sumarDias(dia, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-[12rem] text-center text-[15px] font-extrabold first-letter:uppercase">{dia === hoy ? `Hoy, ${etiquetaDia}` : etiquetaDia}</p>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Día siguiente" disabled={dia >= hoy} onClick={() => setDia(sumarDias(dia, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        {dia !== hoy && (
          <Button variant="ghost" onClick={() => setDia(hoy)}>
            Volver a hoy
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="gap-2 rounded-full font-bold" onClick={() => void copiarResumen()}>
          <ClipboardCopy className="size-4" /> {copiado ? "Copiado ✓" : "Copiar resumen"}
        </Button>
        {dia === hoy && pendientes.length > 0 && (
          <Button className="rounded-full font-bold" onClick={() => setVerPendientes(true)}>
            Cobrar pendientes de hoy · {pendientes.length}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="entrada-lista col-span-2 rounded-[18px] border border-salvia bg-salvia-suave px-4 py-3 lg:col-span-1">
          <p className="text-[13px] font-bold text-hoja-tinta">Total cobrado · {r.cobros} {r.cobros === 1 ? "cobro" : "cobros"}</p>
          <p className="mt-0.5 text-[26px] font-extrabold tabular-nums"><Contador valor={total} formato={eur} /></p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-cafe-medio tabular-nums">
            <Comparacion etiqueta="vs ayer" ahora={total} antes={rAyer.total} />
            <Comparacion etiqueta="vs hace 7 días" ahora={total} antes={rSemana.total} />
          </p>
        </div>
        {METODOS_CAJA.map((m) => (
          <div key={m} className="entrada-lista rounded-[18px] border border-border bg-card px-4 py-3">
            <p className="flex items-baseline justify-between text-[13px] font-bold text-cafe-medio">
              {PAYMENT_METHOD_LABELS[m]}
              <span className="text-[12px] font-semibold tabular-nums">{total > 0 ? `${Math.round((porMetodo[m] / total) * 100)} %` : "—"}</span>
            </p>
            <p className="mt-0.5 text-[22px] font-extrabold tabular-nums"><Contador valor={porMetodo[m]} formato={eur} /></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-beige" aria-hidden>
              <div className="barra-rellena h-full rounded-full bg-moca" style={{ width: `${total > 0 ? (porMetodo[m] / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
        <section className="rounded-[20px] border border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-extrabold">Por hora</h2>
            <p className="text-[12.5px] text-muted-foreground">Lo cobrado en cada hora{delDia.length ? "" : " · aún sin cobros este día"}</p>
          </div>
          <div className="mt-3 flex h-32 items-end gap-[2px]" role="img" aria-label={`Cobros por hora: ${horas.filter((h) => h.total > 0).map((h) => `${h.hora}:00 ${eur(h.total)}`).join(", ") || "ninguno"}`}>
            {horas.map((h) => (
              <div key={h.hora} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${h.hora}:00 – ${h.hora + 1}:00 · ${eur(h.total)}`}>
                <div className="barra-sube w-full rounded-t-[4px] bg-moca group-hover:bg-moca-fuerte" style={{ height: `${(h.total / maxHora) * 100}%`, minHeight: h.total > 0 ? 3 : 0 }} />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded-md bg-cafe px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white tabular-nums group-hover:block">{eur(h.total)}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px] border-t border-lino pt-1 text-[11px] text-muted-foreground tabular-nums">
            {horas.map((h) => (
              <span key={h.hora} className="min-w-0 flex-1 text-center">{h.hora % 2 === 0 ? h.hora : ""}</span>
            ))}
          </div>
        </section>
        <section className="rounded-[20px] border border-border bg-card">
          <h2 className="px-5 pt-4 pb-2 text-base font-extrabold">Cobros del día</h2>
          {delDia.length === 0 ? (
            <p className="px-5 pb-5 text-[14px] text-muted-foreground">Todavía no hay cobros este día. Se apuntan al cobrar cada cita («Cobrar» en su detalle){dia === hoy && pendientes.length > 0 ? ` — tienes ${pendientes.length} por cobrar arriba` : ""}.</p>
          ) : (
            <ul className="divide-y divide-lino border-t border-lino">
              {delDia.map((m) => (
                <li key={m.id} className="entrada-lista flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-2.5 text-[14px]">
                  <span className="w-12 shrink-0 font-bold tabular-nums text-cafe-medio">{String(Math.floor(m.minuto / 60)).padStart(2, "0")}:{String(m.minuto % 60).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <b>{m.clienta}</b> · {m.concepto}
                    <span className="block text-[12.5px] text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[m.metodo]} · {m.fuente === "cita" ? "atiende" : "cobra"} {nombre(m.profesional)}
                      {m.pago?.nota ? ` · ${m.pago.nota}` : ""}
                      {m.pago?.origen === "tpv123" ? " · importado de TPV 123" : ""}
                    </span>
                  </span>
                  <b className="tabular-nums">{eur(m.importeEur)}</b>
                  {m.pago && puede(permisos, "dinero.crear") && m.pago.concepto !== "senal" && (
                    <button type="button" onClick={() => borrarPago(m.pago!.id)} aria-label={`Borrar el cobro de ${m.clienta}`} className="grid size-8 place-items-center rounded-full text-cafe-medio hover:bg-beige">
                      <Trash2 className="size-4" strokeWidth={1.7} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {porPro.length > 0 && (
            <div className="border-t border-lino px-5 py-3 text-[13.5px]">
              <p className="font-bold text-cafe-medio">Por profesional</p>
              <p className="mt-1 tabular-nums">{porPro.map((x) => `${x.nombre} ${eur(x.total)}`).join(" · ")}</p>
            </div>
          )}
        </section>
        </div>

        <div className="space-y-4">
          {puede(permisos, "dinero.cerrar") && (
            <section className="rounded-[20px] border border-border bg-card px-5 py-4">
              <h2 className="text-base font-extrabold">Cerrar el día</h2>
              <p className="mt-1 text-[13.5px] text-cafe-medio">Cuenta el efectivo del cajón. En efectivo se ha apuntado <b className="tabular-nums text-foreground">{eur(porMetodo.efectivo)}</b>.</p>
              <label className="mt-3 block space-y-1 text-[13px] font-bold">
                Efectivo contado
                <Input inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" className="h-10 tabular-nums" />
              </label>
              {cuadre && (
                <p className={cn("mt-2 rounded-xl px-3 py-2 text-[14px] font-bold tabular-nums", cuadre.descuadre === 0 ? "bg-salvia-suave text-hoja-tinta" : "bg-melocoton text-melocoton-tinta")}>
                  {cuadre.descuadre === 0 ? "Cuadra" : cuadre.descuadre > 0 ? `Sobran ${eur(cuadre.descuadre)}` : `Faltan ${eur(-cuadre.descuadre)}`}
                </p>
              )}
              {guardaCierre ? (
                <>
                  <label className="mt-3 block space-y-1 text-[13px] font-bold">
                    Nota (opcional)
                    <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: 5 € de cambio para mañana" className="h-9" />
                  </label>
                  <Button className="mt-3 w-full rounded-full font-bold" disabled={!cuadre} onClick={() => void cerrar()}>
                    Cerrar el día
                  </Button>
                </>
              ) : (
                <LlegaConPlan funcion="caja-cierre" compacta className="mt-3" />
              )}
            </section>
          )}

          <section className="rounded-[20px] border border-border bg-card py-4">
            <h2 className="px-5 text-base font-extrabold">Días anteriores</h2>
            <p className="px-5 text-[12.5px] text-muted-foreground">Los últimos 14 días con cobros. Pulsa uno para verlo.</p>
            {anteriores.length === 0 ? (
              <p className="px-5 pt-2 text-[13.5px] text-muted-foreground">Sin cobros en las dos semanas anteriores.</p>
            ) : (
              <ul className="mt-2 max-h-72 overflow-y-auto">
                {anteriores.map((d) => (
                  <li key={d.dia}>
                    <button type="button" onClick={() => setDia(d.dia)} className="flex w-full items-center gap-3 px-5 py-2 text-left text-[13.5px] hover:bg-beige">
                      <span className="min-w-0 flex-1 first-letter:uppercase">{diaDe(d.dia).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="text-[12px] text-muted-foreground tabular-nums">{d.resumen.cobros} cobros</span>
                      <b className="tabular-nums">{eur(d.resumen.total)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {puede(permisos, "dinero.exportar") && (
            <section className="rounded-[20px] border border-border bg-card px-5 py-4">
              <h2 className="text-base font-extrabold">Exportar para la gestoría</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[13px] font-bold">
                  Desde
                  <Input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className="h-9" />
                </label>
                <label className="space-y-1 text-[13px] font-bold">
                  Hasta
                  <Input type="date" value={hasta} min={desde} max={hoy} onChange={(e) => setHasta(e.target.value)} className="h-9" />
                </label>
              </div>
              <div className="mt-3">
                <BotonConPlan funcion="caja-exportar" etiqueta="Exportar para la gestoría">
                  <Button variant="outline" className="w-full gap-2 rounded-full font-bold" onClick={() => void exportar()}>
                    <Download className="size-4" /> Descargar el fichero (CSV)
                  </Button>
                </BotonConPlan>
              </div>
            </section>
          )}

          <p className="px-1 text-[12.5px] leading-snug text-muted-foreground">{TEXTO_CAJA_NO_FACTURA} El ticket o la factura los emite tu TPV.</p>
        </div>
      </div>

      <Dialog open={verPendientes} onOpenChange={setVerPendientes}>
        <DialogContent className="max-w-md rounded-[20px]">
          <DialogHeader>
            <DialogTitle>Por cobrar hoy</DialogTitle>
            <DialogDescription>Citas de hoy que ya empezaron y siguen sin cobrar.</DialogDescription>
          </DialogHeader>
          {pendientes.length === 0 ? (
            <p className="text-[14px] text-hoja-tinta">Todo cobrado ✓</p>
          ) : (
            <ul className="-mx-2 max-h-[60vh] divide-y divide-lino overflow-y-auto">
              {pendientes.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-2 py-2.5 text-[14px]">
                  <span className="w-12 shrink-0 font-bold tabular-nums text-cafe-medio">{new Date(a.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="min-w-0 flex-1 truncate"><b>{a.clientName}</b> · {nombre(a.employeeId)}</span>
                  <Button size="sm" className="rounded-full font-bold" onClick={() => setCobrando(a)}>
                    Cobrar {eur(a.priceEur)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      {cobrando && <VentanaCobrar cita={cobrando} abierta={!!cobrando} onCerrar={() => setCobrando(null)} />}
    </div>
  );
}

/** Cifra que sube hasta su valor (lote 16); sin animación si se pide menos movimiento. */
function Contador({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const n = useContador(valor);
  return <>{formato(n)}</>;
}

function Comparacion({ etiqueta, ahora, antes }: { etiqueta: string; ahora: number; antes: number }) {
  const v = variacion(ahora, antes);
  if (v === null) return <span>{etiqueta}: —</span>;
  return (
    <span>
      {etiqueta}: <b className={cn(v >= 0 ? "text-hoja-tinta" : "text-melocoton-tinta")}>{v > 0 ? "+" : ""}{v} %</b>
    </span>
  );
}

