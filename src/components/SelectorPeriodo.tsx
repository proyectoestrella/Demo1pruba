import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { CalendarDays, Check } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import {
  ETIQUETA_PERIODO,
  claveDeDia,
  deClaveDeDia,
  rangoDePeriodo,
  textoRango,
  type PeriodoId,
} from "@/lib/periodos";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BOTONES: PeriodoId[] = ["hoy", "semana", "mes", "personalizado"];

/**
 * Selector de periodo de la analítica.
 *
 * Pensado para un dedo entre dos cortes: cuatro objetivos de 44 px de alto en
 * una sola fila, el elegido marcado con relleno sólido, y debajo —siempre
 * visible, sin tener que abrir nada— las fechas exactas que se están mirando.
 * "Fechas" abre un calendario de rango que se maneja tocando dos días.
 *
 * No calcula nada: el periodo vive en la store (y se persiste) y los números
 * salen de `lib/periodos.ts`.
 */
export function SelectorPeriodo({ className }: { className?: string }) {
  const periodo = useSalonStore((s) => s.periodoAnalitica);
  const rangoGuardado = useSalonStore((s) => s.rangoAnalitica);
  const setPeriodo = useSalonStore((s) => s.setPeriodoAnalitica);
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<DateRange | undefined>(() =>
    rangoGuardado
      ? { from: deClaveDeDia(rangoGuardado.desde), to: deClaveDeDia(rangoGuardado.hasta) }
      : undefined,
  );

  const rango = rangoDePeriodo(periodo, new Date(), rangoGuardado);
  const etiquetaFechas =
    periodo === "personalizado" && rangoGuardado ? textoRango(rango) : "Fechas";

  function aplicar() {
    if (!borrador?.from) return;
    const hasta = borrador.to ?? borrador.from;
    setPeriodo("personalizado", { desde: claveDeDia(borrador.from), hasta: claveDeDia(hasta) });
    setAbierto(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="group"
        aria-label="Periodo de las estadísticas"
        className="grid grid-cols-4 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1"
      >
        {BOTONES.map((id) => {
          const activo = periodo === id;
          const esFechas = id === "personalizado";
          const contenido = esFechas ? (
            <>
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{activo ? etiquetaFechas : "Fechas"}</span>
            </>
          ) : (
            ETIQUETA_PERIODO[id]
          );
          const clases = cn(
            // 44 px de alto: el mínimo para tocar sin fallar con el iPad en la mano.
            "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors",
            activo
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background hover:text-foreground",
          );

          if (!esFechas) {
            return (
              <button
                key={id}
                type="button"
                aria-pressed={activo}
                onClick={() => setPeriodo(id)}
                className={clases}
              >
                {contenido}
              </button>
            );
          }
          return (
            <Popover key={id} open={abierto} onOpenChange={setAbierto}>
              <PopoverTrigger asChild>
                <button type="button" aria-pressed={activo} className={clases}>
                  {contenido}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto max-w-[min(22rem,calc(100vw-1.5rem))] p-0"
              >
                <Calendar
                  mode="range"
                  locale={es}
                  weekStartsOn={1}
                  numberOfMonths={1}
                  defaultMonth={borrador?.from ?? new Date()}
                  selected={borrador}
                  onSelect={setBorrador}
                  // Celdas grandes: el calendario por defecto es de ratón.
                  className="[--cell-size:2.6rem]"
                />
                <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {borrador?.from
                      ? `${textoRango({
                          inicio: borrador.from,
                          fin: new Date(+(borrador.to ?? borrador.from) + 86_400_000),
                        })}`
                      : "Toca el primer día y luego el último."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 shrink-0 px-4"
                    disabled={!borrador?.from}
                    onClick={aplicar}
                  >
                    <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                    Ver
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Estás viendo <strong className="font-medium text-foreground">{textoRango(rango)}</strong>
      </p>
    </div>
  );
}
