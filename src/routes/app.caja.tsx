import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { usePermisos, useTienePlan } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { calcularDescuadre, METODOS_PAGO, pagosDelDia, pagosEntreDias, pagosPorMetodo, TEXTO_CAJA_NO_FACTURA, totalPagos, type Pago } from "@/lib/pagos";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/caja")({
  head: () => ({ meta: [{ title: "Caja del día · siShow" }] }),
  component: CajaDelDia,
});

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const CONCEPTO: Record<Pago["concepto"], string> = { servicio: "Servicio", producto: "Producto", propina: "Propina", senal: "Señal", ajuste: "Ajuste" };
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
  const delDia = useMemo(() => [...pagosDelDia(pagos, dia, zona)].sort((a, b) => a.fecha.localeCompare(b.fecha)), [pagos, dia, zona]);
  const porMetodo = pagosPorMetodo(delDia);
  const total = totalPagos(delDia);
  const nombre = (id?: string) => equipo.find((e) => e.id === id)?.name ?? "—";
  const porPro = equipo
    .map((e) => ({ e, total: totalPagos(delDia.filter((p) => p.cobradoPor === e.id)) }))
    .filter((x) => x.total > 0);

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

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Cifra titulo="Total cobrado" valor={eur(total)} destacada />
        {METODOS_PAGO.map((m) => (
          <Cifra key={m} titulo={PAYMENT_METHOD_LABELS[m]} valor={eur(porMetodo[m])} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-[20px] border border-border bg-card xl:col-span-2">
          <h2 className="px-5 pt-4 pb-2 text-base font-extrabold">Cobros del día</h2>
          {delDia.length === 0 ? (
            <p className="px-5 pb-5 text-[14px] text-muted-foreground">Todavía no hay cobros este día. Se apuntan al cobrar cada cita («Cobrar» en su detalle).</p>
          ) : (
            <ul className="divide-y divide-lino border-t border-lino">
              {delDia.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-2.5 text-[14px]">
                  <span className="w-12 shrink-0 font-bold tabular-nums text-cafe-medio">{new Date(p.fecha).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="min-w-0 flex-1">
                    <b>{p.clientName ?? "Sin clienta"}</b> · {CONCEPTO[p.concepto]}
                    <span className="block text-[12.5px] text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[p.metodo]} · cobra {nombre(p.cobradoPor)}
                      {p.nota ? ` · ${p.nota}` : ""}
                      {p.origen === "tpv123" ? " · importado de TPV 123" : ""}
                    </span>
                  </span>
                  <b className="tabular-nums">{eur(p.importeEur)}</b>
                  {puede(permisos, "dinero.crear") && p.concepto !== "senal" && (
                    <button type="button" onClick={() => borrarPago(p.id)} aria-label={`Borrar el cobro de ${p.clientName ?? "sin clienta"}`} className="grid size-8 place-items-center rounded-full text-cafe-medio hover:bg-beige">
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
              <p className="mt-1 tabular-nums">{porPro.map((x) => `${x.e.name} ${eur(x.total)}`).join(" · ")}</p>
            </div>
          )}
        </section>

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
    </div>
  );
}

function Cifra({ titulo, valor, destacada = false }: { titulo: string; valor: string; destacada?: boolean }) {
  return (
    <div className={cn("rounded-[18px] border px-4 py-3", destacada ? "border-salvia bg-salvia-suave" : "border-border bg-card")}>
      <p className="text-[13px] font-bold text-cafe-medio">{titulo}</p>
      <p className="mt-0.5 text-[22px] font-extrabold tabular-nums">{valor}</p>
    </div>
  );
}
