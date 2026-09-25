import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { eur } from "@/lib/copy";
import {
  MARCADORES_SENAL,
  PLANTILLA_SENAL_POR_DEFECTO,
  marcadoresQueFaltan,
  reglaSenal,
  rellenarPlantillaSenal,
  resumenCancelacionSenal,
} from "@/lib/senal-maqueta";
import type { SalonProfile } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Ajustes › Señal (9j, Método A): UNA sola regla por salón, con los campos
 * del contrato de BACKEND. siShow no cobra ni comprueba pagos: la clienta
 * hace el Bizum al salón y la dueña marca que ha llegado.
 */
export function AjustesSenal() {
  const perfil = useSalonStore((s) => s.salonProfile);
  const services = useSalonStore((s) => s.services);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const desdePerfil = () => ({
    depositEnabled: !!perfil.depositEnabled,
    depositMode: perfil.depositMode ?? "fijo",
    depositAmountEur: String(perfil.depositAmountEur || 10),
    depositPercent: String(perfil.depositPercent ?? 20),
    depositAppliesTo: perfil.depositAppliesTo ?? "todas",
    depositMinMinutes: String(perfil.depositMinMinutes ?? 60),
    depositServiceIds: perfil.depositServiceIds ?? [],
    depositDeadlineHours: String(perfil.depositDeadlineHours && perfil.depositDeadlineHours <= 4 ? perfil.depositDeadlineHours : 4),
    depositBizumPhone: perfil.depositBizumPhone ?? "",
    depositAuto: !!perfil.depositAuto,
    depositAutoRelease: !!perfil.depositAutoRelease,
    depositCancelHours: String(reglaSenal(perfil).horasCancelacion),
    depositTemplate: perfil.depositTemplate ?? "",
  });
  const [f, setF] = useState(desdePerfil);
  // Si el perfil cambia desde fuera (otra pestaña, reinicio), el formulario le sigue.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setF(desdePerfil()), [perfil]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  function guardar() {
    const num = (t: string) => Number(t.replace(",", "."));
    const importe = num(f.depositAmountEur);
    const pct = num(f.depositPercent);
    if (f.depositEnabled) {
      if (f.depositBizumPhone.replace(/\D/g, "").length < 9) return toast.error("Escribe el número de Bizum al que te pagan la señal.");
      if (f.depositMode === "fijo" && (!Number.isFinite(importe) || importe < 1 || importe > 200)) return toast.error("La señal fija tiene que estar entre 1 y 200 €.");
      if (f.depositMode === "porcentaje" && (!Number.isFinite(pct) || pct < 1 || pct > 100)) return toast.error("El porcentaje tiene que estar entre 1 y 100.");
      if (f.depositAppliesTo === "servicios" && f.depositServiceIds.length === 0) return toast.error("Elige al menos un servicio que lleve señal.");
    }
    const patch: Partial<SalonProfile> = {
      depositEnabled: f.depositEnabled,
      depositMode: f.depositMode,
      depositAmountEur: Math.min(200, Math.max(1, Math.round(importe) || 10)),
      depositPercent: Math.min(100, Math.max(1, Math.round(pct) || 20)),
      depositAppliesTo: f.depositAppliesTo,
      depositMinMinutes: Math.max(5, Math.round(num(f.depositMinMinutes)) || 60),
      depositServiceIds: f.depositServiceIds,
      depositDeadlineHours: Number(f.depositDeadlineHours) as 1 | 2 | 4,
      depositBizumPhone: f.depositBizumPhone.trim(),
      depositAuto: f.depositAuto,
      depositAutoRelease: f.depositAutoRelease,
      depositCancelHours: Math.min(168, Math.max(0, Math.round(num(f.depositCancelHours)) || 24)),
      depositTemplate: f.depositTemplate.trim() || undefined,
    };
    guardarPerfil(patch);
  }

  const regla = reglaSenal({ ...perfil, ...{ depositEnabled: f.depositEnabled, depositBizumPhone: f.depositBizumPhone, depositMode: f.depositMode, depositAmountEur: Number(f.depositAmountEur) || 10, depositPercent: Number(f.depositPercent) || 20, depositCancelHours: Number(f.depositCancelHours) || 24 } });
  const faltan = marcadoresQueFaltan(f.depositTemplate);
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(12, 0, 0, 0);
  const vence = new Date(Date.now() + Number(f.depositDeadlineHours) * 3_600_000);
  const campo = "h-10 rounded-xl border border-input bg-blanco px-3 text-[14px]";
  const etiqueta = "grid gap-1.5 text-[13px] font-bold text-cafe";
  const segmento = (activo: boolean) => cn("h-9 rounded-full px-3.5 text-[13px] font-bold", activo ? "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.14)]" : "text-cafe-medio");

  return (
    <div className="space-y-5 border-t border-lino pt-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-extrabold">Señal</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Una sola regla para todo el salón. La clienta hace el Bizum a tu número y tú marcas que ha llegado:{" "}
            <strong>siShow no cobra ni comprueba ningún pago.</strong>
          </p>
        </div>
        <Switch aria-label="Pedir señal" checked={f.depositEnabled} onCheckedChange={(v) => set("depositEnabled", v)} />
      </div>

      {f.depositEnabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={etiqueta}>
              Cuánto
              <span className="inline-flex w-fit gap-0.5 rounded-full bg-beige p-1">
                <button type="button" className={segmento(f.depositMode === "fijo")} onClick={() => set("depositMode", "fijo")}>Importe fijo</button>
                <button type="button" className={segmento(f.depositMode === "porcentaje")} onClick={() => set("depositMode", "porcentaje")}>Porcentaje</button>
              </span>
              {f.depositMode === "fijo" ? (
                <label className="flex items-center gap-2 font-normal">
                  <input aria-label="Importe de la señal" className={cn(campo, "w-24")} inputMode="decimal" value={f.depositAmountEur} onChange={(e) => set("depositAmountEur", e.target.value)} /> €
                </label>
              ) : (
                <label className="flex items-center gap-2 font-normal">
                  <input aria-label="Porcentaje del servicio" className={cn(campo, "w-20")} inputMode="numeric" value={f.depositPercent} onChange={(e) => set("depositPercent", e.target.value)} /> % del precio del servicio
                </label>
              )}
            </div>
            <label className={etiqueta}>
              Número de Bizum
              <input className={campo} inputMode="tel" value={f.depositBizumPhone} onChange={(e) => set("depositBizumPhone", e.target.value)} placeholder="600 111 222" />
            </label>
          </div>

          <div className={etiqueta}>
            A quién se la pides
            <select className={campo} value={f.depositAppliesTo} onChange={(e) => set("depositAppliesTo", e.target.value as typeof f.depositAppliesTo)}>
              <option value="todas">A todas las reservas</option>
              <option value="nuevas">Solo a clientas nuevas</option>
              <option value="duracion">A los servicios largos</option>
              <option value="servicios">A unos servicios concretos</option>
            </select>
            {f.depositAppliesTo === "duracion" && (
              <label className="flex items-center gap-2 font-normal">
                De <input aria-label="Minutos mínimos" className={cn(campo, "w-20")} inputMode="numeric" value={f.depositMinMinutes} onChange={(e) => set("depositMinMinutes", e.target.value)} /> minutos o más
              </label>
            )}
            {f.depositAppliesTo === "servicios" && (
              <span className="flex flex-wrap gap-1.5 font-normal">
                {services.filter((s) => s.active !== false).map((s) => {
                  const on = f.depositServiceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("depositServiceIds", on ? f.depositServiceIds.filter((x) => x !== s.id) : [...f.depositServiceIds, s.id])}
                      className={cn("h-8 rounded-full border px-3 text-[13px] font-bold", on ? "border-salvia bg-salvia-clara text-foreground" : "border-lino bg-card text-cafe-medio")}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </span>
            )}
            {f.depositAppliesTo === "nuevas" && <span className="text-[12.5px] font-normal text-muted-foreground">La web no sabe si una clienta es nueva: dirá «si es tu primera visita» y tú decides al pedirla.</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={etiqueta}>
              Plazo para hacer el Bizum
              <select className={campo} value={f.depositDeadlineHours} onChange={(e) => set("depositDeadlineHours", e.target.value)}>
                {[1, 2, 3, 4].map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "hora" : "horas"}
                  </option>
                ))}
              </select>
              <span className="text-[12.5px] font-normal text-muted-foreground">Nunca pasa de la hora de la cita.</span>
            </label>
            <label className={etiqueta}>
              Se devuelve si cancela con más de
              <span className="flex items-center gap-2 font-normal">
                <input aria-label="Horas de cancelación" className={cn(campo, "w-20")} inputMode="numeric" value={f.depositCancelHours} onChange={(e) => set("depositCancelHours", e.target.value)} /> horas de antelación
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <Interruptor
              titulo="Pedirla sola al reservar por la web"
              texto="La reserva ya nace con la señal pedida y la web enseña tu Bizum. Si lo apagas, se la pides tú por WhatsApp desde la cita."
              valor={f.depositAuto}
              onCambio={(v) => set("depositAuto", v)}
            />
            <Interruptor
              titulo="Liberar el hueco sola si vence"
              texto="Si pasa el plazo sin recibirla, la cita se cancela y el hueco queda libre. Si lo apagas, se te avisa en Hoy y decides tú."
              valor={f.depositAutoRelease}
              onCambio={(v) => set("depositAutoRelease", v)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="plantilla-senal" className="text-[13px] font-bold text-cafe">
              Mensaje de WhatsApp para pedirla
            </label>
            <textarea
              id="plantilla-senal"
              rows={3}
              value={f.depositTemplate || PLANTILLA_SENAL_POR_DEFECTO}
              onChange={(e) => set("depositTemplate", e.target.value === PLANTILLA_SENAL_POR_DEFECTO ? "" : e.target.value)}
              className="w-full rounded-xl border border-input bg-blanco px-3 py-2 text-[14px] leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5">
              {MARCADORES_SENAL.map((m) => (
                <button key={m} type="button" onClick={() => set("depositTemplate", `${(f.depositTemplate || PLANTILLA_SENAL_POR_DEFECTO).trimEnd()} ${m}`)} className="h-7 rounded-full border border-salvia bg-salvia-suave px-2.5 text-[12.5px] font-bold text-hoja-tinta">
                  {m}
                </button>
              ))}
            </div>
            {faltan.length > 0 && (
              <p role="alert" className="text-[12.5px] font-bold text-melocoton-tinta">
                Falta {faltan.join(" y ")}: sin eso la clienta no sabe cuánto ni a qué número.
              </p>
            )}
            <p className="rounded-2xl bg-nata px-3 py-2 text-[13px] leading-snug text-cafe">
              {rellenarPlantillaSenal(f.depositTemplate, {
                nombre: "Lucía",
                salon: perfil.name,
                importeEur: regla.modo === "porcentaje" ? Math.max(1, Math.round((45 * regla.porcentaje) / 100)) : regla.importeEur,
                bizum: f.depositBizumPhone || "600 111 222",
                startISO: manana.toISOString(),
                venceISO: vence.toISOString(),
              })}
            </p>
          </div>

          <p className="rounded-2xl border border-lino bg-card px-3.5 py-2.5 text-[13px] text-cafe-medio">
            <b className="text-cafe">Lo que dirá tu web: </b>
            {resumenCancelacionSenal(regla, (n) => eur(n).replace(",00", ""))}
          </p>
        </>
      )}
      <div className="flex justify-end">
        <Button onClick={guardar}>Guardar la señal</Button>
      </div>
    </div>
  );
}

function Interruptor({ titulo, texto, valor, onCambio }: { titulo: string; texto: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-nata px-3.5 py-3">
      <div>
        <p className="text-[14px] font-bold">{titulo}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{texto}</p>
      </div>
      <Switch aria-label={titulo} checked={valor} onCheckedChange={onCambio} />
    </div>
  );
}
