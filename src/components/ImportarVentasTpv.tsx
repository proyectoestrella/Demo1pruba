import { useMemo, useState } from "react";
import { toast } from "sonner";
import { leerTabla, type TablaImportacion } from "@/lib/importar-clientas";
import { importarPagosTpv } from "@/lib/importar-pagos-tpv";
import { importarPagosTpvServidor } from "@/lib/api/pagos.functions";
import { TEXTO_CAJA_NO_FACTURA, type Pago } from "@/lib/pagos";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { Button } from "@/components/ui/button";

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Clientas › Importar › «Ventas de TPV 123» (14b): el «Histórico X
 * Clientes» pasa a cobros de la caja, una línea por pago. Vista previa con
 * casadas / sin casar / errores y las ya importadas (misma factura = no se
 * duplica). En un salón real sube con importarPagosTpvServidor; en la demo
 * se queda en este navegador.
 */
export function ImportarVentasTpv() {
  const clientas = useSalonStore((s) => s.clients);
  const pagos = useSalonStore((s) => s.payments);
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  const cargarPagos = useSalonStore((s) => s.cargarPagos);
  const equipo = useEquipo();
  const [tabla, setTabla] = useState<TablaImportacion | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState("");

  const resultado = useMemo(() => {
    if (!tabla) return null;
    const codigos = new Map(clientas.filter((c) => c.tpvCode).map((c) => [String(c.tpvCode), c.id]));
    return importarPagosTpv(tabla, clientas, { equipo, codigos });
  }, [tabla, clientas, equipo]);
  const yaImportadas = useMemo(() => new Set(pagos.filter((p) => p.origen === "tpv123" && p.refExterna).map((p) => p.refExterna!)), [pagos]);
  const nuevos = resultado ? resultado.pagos.filter((p) => !yaImportadas.has(p.refExterna)) : [];
  const repetidos = resultado ? resultado.pagos.length - nuevos.length : 0;
  const totalNuevo = nuevos.reduce((t, p) => t + p.importeEur, 0);

  async function cargar(file?: File) {
    setError("");
    setHecho("");
    if (!file) return;
    try {
      setTabla(await leerTabla(file));
    } catch {
      setTabla(null);
      setError("No se ha podido leer ese fichero. Tiene que ser el Excel o CSV del «Histórico X Clientes» de TPV 123.");
    }
  }

  async function importar() {
    if (!nuevos.length) return;
    setOcupado(true);
    try {
      if (realSlug) {
        const r = await importarPagosTpvServidor({ data: { slug: realSlug, pagos: nuevos.map(({ fila: _f, ...p }) => p) } });
        const fechas = nuevos.map((p) => p.fecha.slice(0, 10)).sort();
        await cargarPagos(fechas[0], fechas[fechas.length - 1]);
        setHecho(`${r.insertados} cobros importados de TPV 123.`);
      } else {
        const ahora = new Date().toISOString();
        const locales: Pago[] = nuevos.map((p) => ({
          id: globalThis.crypto?.randomUUID?.() ?? `tpv-${p.refExterna}`,
          clientId: p.clienteId,
          clientName: p.clienteNombre,
          importeEur: p.importeEur,
          metodo: "efectivo",
          concepto: p.concepto,
          cobradoPor: p.cobradoPor,
          nota: p.nota,
          origen: "tpv123",
          refExterna: p.refExterna,
          fecha: p.fecha,
          createdAt: ahora,
        }));
        useSalonStore.setState((s) => ({ payments: [...s.payments, ...locales] }));
        setHecho(`${locales.length} cobros importados en esta demo (se quedan en este navegador).`);
      }
      toast.success("Ventas de TPV 123 importadas");
    } catch {
      setError("No se ha podido importar. No se ha guardado nada: inténtalo otra vez.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">Trae lo que ya cobraste en TPV 123 a la caja de siShow: una línea por cobro. Si subes el mismo fichero otra vez, no se duplica nada.</p>
      <label className="block space-y-1 font-medium">
        Histórico X Clientes (.csv o .xlsx)
        <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void cargar(e.target.files?.[0])} className="block w-full min-w-0 rounded border border-border p-2 text-sm font-normal" />
      </label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {resultado && (
        <>
          <p className="font-medium">
            {resultado.lineas} líneas · {resultado.casadas} con su clienta · {resultado.noCasadas} sin casar (se importan con el nombre) · {resultado.errores} con errores
            {repetidos > 0 && ` · ${repetidos} ya importadas`}
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-border p-2 tabular-nums">
            {resultado.pagos.slice(0, 10).map((p) => (
              <p key={p.refExterna} className={yaImportadas.has(p.refExterna) ? "text-muted-foreground line-through" : undefined}>
                {new Date(p.fecha).toLocaleDateString("es-ES")} · {p.clienteNombre}
                {p.clienteId ? "" : " (sin casar)"} · {p.nota ?? "Servicio"} · {eur(p.importeEur)} · factura {p.refExterna}
              </p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">TPV 123 no dice cómo se cobró cada línea: se apuntan como efectivo. {TEXTO_CAJA_NO_FACTURA}</p>
          <Button onClick={() => void importar()} disabled={ocupado || !nuevos.length} className="w-full sm:w-auto">
            {nuevos.length ? `Importar ${nuevos.length} cobros (${eur(totalNuevo)})` : "Nada nuevo que importar"}
          </Button>
        </>
      )}
      {hecho && (
        <p role="status" className="rounded bg-primary/10 p-3">
          {hecho}
        </p>
      )}
    </div>
  );
}
