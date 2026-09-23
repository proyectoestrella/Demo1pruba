import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import type { Appointment, Employee, Service } from "@/lib/mock/types";
import { claveDeDia, textoRango, type Rango } from "@/lib/periodos";
import { selectServiceMap } from "@/lib/store";
import { citasToCsv, resumenMensualToCsv, downloadCsv } from "@/lib/export-csv";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Periodo = "7d" | "30d" | "mes" | "todo";

const PERIODOS: { value: Periodo; label: string; archivo: string }[] = [
  { value: "7d", label: "Últimos 7 días", archivo: "ultimos-7-dias" },
  { value: "30d", label: "Últimos 30 días", archivo: "ultimos-30-dias" },
  { value: "mes", label: "Este mes", archivo: "este-mes" },
  { value: "todo", label: "Todo el histórico", archivo: "historico" },
];

function inicioDePeriodo(periodo: Periodo, now: Date): Date {
  if (periodo === "todo") return new Date(0);
  const inicio = new Date(now);
  if (periodo === "mes") {
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }
  inicio.setDate(inicio.getDate() - (periodo === "7d" ? 7 : 30));
  return inicio;
}

export interface ExportCsvButtonsProps {
  appointments: Appointment[];
  services: Service[];
  employees: Employee[];
  /**
   * Periodo que manda, cuando la pantalla ya tiene su propio selector
   * (Analítica). Si viene, el desplegable de aquí desaparece: dos selectores
   * de periodo en la misma pantalla diciendo cosas distintas es justo lo que
   * confunde al dueño. Sin él, el componente se gobierna solo (Agenda).
   */
  rango?: Rango;
  className?: string;
}

/**
 * Descarga de citas a CSV (con separador `;` y BOM para que Excel en español
 * las abra bien — ver `lib/export-csv.ts`) para el periodo elegido, y del
 * resumen del mes en curso con totales por día y por profesional. Todo se
 * genera en el propio navegador, sin backend de por medio.
 */
export function ExportCsvButtons({
  appointments,
  services,
  employees,
  rango,
  className,
}: ExportCsvButtonsProps) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const serviceMap = useMemo(() => selectServiceMap(services), [services]);
  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees],
  );

  function exportarCitas() {
    const now = new Date();
    const desde = rango ? +rango.inicio : +inicioDePeriodo(periodo, now);
    // Con un rango del selector se exporta el rango entero, futuras incluidas:
    // es lo que el dueño está viendo en pantalla. Sin él, hasta hoy.
    const hasta = rango ? +rango.fin : +now + 1;
    const enPeriodo = appointments.filter(
      (a) => +new Date(a.start) >= desde && +new Date(a.start) < hasta,
    );
    const csv = citasToCsv(enPeriodo, serviceMap, employeeMap);
    const etiqueta = rango
      ? `${claveDeDia(rango.inicio)}_${claveDeDia(new Date(+rango.fin - 86_400_000))}`
      : (PERIODOS.find((p) => p.value === periodo)?.archivo ?? periodo);
    downloadCsv(`citas-${etiqueta}-${now.toISOString().slice(0, 10)}.csv`, csv);
  }

  function exportarResumenMes() {
    const now = new Date();
    const desde = +inicioDePeriodo("mes", now);
    const delMes = appointments.filter(
      (a) => +new Date(a.start) >= desde && +new Date(a.start) <= +now,
    );
    const csv = resumenMensualToCsv(delMes, employees);
    downloadCsv(`resumen-del-mes-${now.toISOString().slice(0, 7)}.csv`, csv);
  }

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      {rango ? (
        <span className="text-xs text-muted-foreground">{textoRango(rango)}</span>
      ) : (
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[170px]" aria-label="Periodo a exportar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarCitas}>
        <Download className="h-3.5 w-3.5" /> Exportar a Excel (CSV)
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarResumenMes}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> Resumen del mes
      </Button>
    </div>
  );
}
