import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { PAYMENT_METHOD_LABELS, type Appointment, type PaymentMethod } from "@/lib/mock/types";
import { METODOS_PAGO, TEXTO_CAJA_NO_FACTURA, type Pago } from "@/lib/pagos";
import { importeACobrar, planDeCobro, senalYaPagada } from "@/lib/cobro-panel";
import { avisar, conCambio, deshacerCambio } from "@/lib/deshacer-maqueta";
import { useMiEmployeeId } from "@/lib/accesos-panel";
import { useEquipo } from "@/lib/use-equipo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const texto = (n: number) => (n % 1 ? n.toFixed(2).replace(".", ",") : String(n));

/**
 * Cobrar una cita (14b): importe prellenado (carta menos señal ya pagada),
 * una o dos formas de pago, propina, quién cobra y una nota. Apunta un pago
 * por línea (`registrarPago`), la propina aparte, y marca la cita cobrada
 * (`markPaid`, que es lo que descuenta la señal y crea su pago en el
 * servidor). Todo se deshace desde el aviso.
 */
export function VentanaCobrar({ cita, abierta, onCerrar }: { cita: Appointment; abierta: boolean; onCerrar: () => void }) {
  const equipo = useEquipo();
  const mio = useMiEmployeeId();
  const registrarPago = useSalonStore((s) => s.registrarPago);
  const borrarPago = useSalonStore((s) => s.borrarPago);
  const markPaid = useSalonStore((s) => s.markPaid);
  const propuesto = importeACobrar(cita);
  const senal = senalYaPagada(cita);
  const [lineas, setLineas] = useState<Array<{ importe: string; metodo: PaymentMethod }>>([{ importe: texto(propuesto), metodo: "efectivo" }]);
  const [propina, setPropina] = useState("");
  const [cobradoPor, setCobradoPor] = useState<string>(mio ?? cita.employeeId);
  const [nota, setNota] = useState("");
  useEffect(() => {
    if (!abierta) return;
    setLineas([{ importe: texto(propuesto), metodo: "efectivo" }]);
    setPropina("");
    setCobradoPor(mio ?? cita.employeeId);
    setNota("");
  }, [abierta, cita.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = planDeCobro(lineas, propina);
  const nombre = cita.clientName.split(" ")[0];

  function cambiarLinea(i: number, parche: Partial<{ importe: string; metodo: PaymentMethod }>) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...parche } : l)));
  }
  function mixto() {
    const primera = Number(lineas[0].importe.replace(",", ".")) || 0;
    const resto = Math.max(0, Math.round((propuesto - primera) * 100) / 100);
    const otro = METODOS_PAGO.find((m) => m !== lineas[0].metodo) ?? "tarjeta";
    setLineas([lineas[0], { importe: texto(resto), metodo: otro }]);
  }

  function cobrar() {
    if (plan.error) return;
    const ahora = new Date().toISOString();
    const base = { appointmentId: cita.id, clientId: cita.clientId || undefined, clientName: cita.clientName, cobradoPor, nota: nota.trim() || undefined, fecha: ahora };
    const creados: Pago[] = [];
    // Los pagos no pasan por el historial (un alta se deshace borrándola); la cita cobrada sí.
    const { cambio } = conCambio(() => {
      for (const l of plan.lineas) creados.push(registrarPago({ ...base, importeEur: l.importeEur, metodo: l.metodo, concepto: "servicio" }));
      if (plan.propina > 0) creados.push(registrarPago({ ...base, importeEur: plan.propina, metodo: plan.metodoPrincipal, concepto: "propina" }));
      if (!cita.paidAt) markPaid(cita.id, plan.metodoPrincipal);
    });
    onCerrar();
    const detalle = plan.lineas.length > 1 ? plan.lineas.map((l) => `${eur(l.importeEur)} ${PAYMENT_METHOD_LABELS[l.metodo].toLowerCase()}`).join(" + ") : PAYMENT_METHOD_LABELS[plan.metodoPrincipal].toLowerCase();
    avisar(`Cobrado a ${nombre}: ${eur(plan.total)} (${detalle})`, () => {
      conCambio(() => creados.forEach((p) => borrarPago(p.id)));
      if (cambio) {
        const r = deshacerCambio(cambio.id);
        if (!r.ok) toast.error("Los pagos se han quitado, pero la cita sigue marcada como cobrada.");
      }
      toast.success("Hecho: vuelve a estar sin cobrar", { duration: 2500 });
    });
  }

  const boton = (activo: boolean) => cn("h-9 rounded-full border px-3.5 text-[13px] font-bold", activo ? "border-salvia bg-salvia-clara text-foreground" : "border-lino bg-card text-cafe-medio hover:bg-beige");
  return (
    <Dialog open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[19px] font-extrabold">Cobrar a {cita.clientName}</DialogTitle>
          <DialogDescription className="tabular-nums">
            Precio de carta {eur(cita.priceEur)}
            {senal > 0 && ` · señal ya pagada −${eur(senal)}`} · a cobrar <b className="text-foreground">{eur(propuesto)}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lineas.map((l, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-lino px-3.5 py-3">
              <div className="flex items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-bold">
                  {lineas.length > 1 ? `Pago ${i + 1}` : "Importe"}
                  <Input inputMode="decimal" value={l.importe} onChange={(e) => cambiarLinea(i, { importe: e.target.value })} aria-label={`Importe del pago ${i + 1}`} className="h-9 w-28 text-right tabular-nums" />
                  <span className="font-normal text-muted-foreground">€</span>
                </label>
                {i > 0 && (
                  <button type="button" onClick={() => setLineas([lineas[0]])} aria-label="Quitar la segunda forma de pago" className="grid size-8 place-items-center rounded-full text-cafe-medio hover:bg-beige">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Forma del pago ${i + 1}`}>
                {METODOS_PAGO.map((m) => (
                  <button key={m} type="button" aria-pressed={l.metodo === m} onClick={() => cambiarLinea(i, { metodo: m })} className={boton(l.metodo === m)}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {lineas.length === 1 && (
            <button type="button" onClick={mixto} className="inline-flex items-center gap-1 text-[13px] font-bold text-hoja-tinta hover:underline">
              <Plus className="size-3.5" /> Paga una parte de otra forma
            </button>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[13px] font-bold">
              Propina (opcional)
              <Input inputMode="decimal" value={propina} onChange={(e) => setPropina(e.target.value)} placeholder="0" className="h-9 tabular-nums" />
            </label>
            <label className="space-y-1 text-[13px] font-bold">
              Cobra
              <select value={cobradoPor} onChange={(e) => setCobradoPor(e.target.value)} className="h-9 w-full rounded-md border border-input bg-blanco px-2 text-[14px] font-normal">
                {equipo.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-[13px] font-bold">
            Nota (opcional)
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: descuento de amiga" className="h-9" />
          </label>
          {plan.error && lineas.some((l) => l.importe !== "") && <p className="text-[13px] text-melocoton-tinta">{plan.error}</p>}
          <p className="text-[12px] leading-snug text-muted-foreground">{TEXTO_CAJA_NO_FACTURA}</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={cobrar} disabled={!!plan.error} className="rounded-full px-5 font-bold tabular-nums">
            Cobrar {plan.error ? "" : eur(plan.total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
