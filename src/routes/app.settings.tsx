import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/settings")({ component: Settings });

/**
 * Ajustes = POLÍTICAS. Lo que se LEE en la web pública (nombre, presentación,
 * foto, teléfono, dirección, horario, carta, equipo, preguntas frecuentes,
 * franjas prioritarias) se edita en «Mi web» (`/app/web`), viendo el efecto.
 *
 * Antes estaba en los dos sitios: aquí se cambiaba el nombre a ciegas y allí
 * también, con dos formularios que podían decir cosas distintas sobre lo
 * mismo. Manda «Mi web» y aquí solo queda el enlace — una decisión de la que
 * no hay que volver: dos formularios sobre un solo perfil siempre acaban
 * discrepando, y el que gana es el último que guardó.
 */
function Settings() {
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);

  // Plantones — política de penalización por cancelar tarde o no presentarse.
  const [noShowEnabled, setNoShowEnabled] = useState((salonProfile.noShowFeeEur ?? 0) > 0);
  const [noShowFeeEur, setNoShowFeeEur] = useState(String(salonProfile.noShowFeeEur || 7));
  const [noShowNoticeHours, setNoShowNoticeHours] = useState(
    String(salonProfile.noShowNoticeHours ?? 2),
  );

  // Fianza por Bizum — número al que se pide y cuánto. Ver lib/avisos.ts.
  const [depositEnabled, setDepositEnabled] = useState(!!salonProfile.depositEnabled);
  const [depositBizumPhone, setDepositBizumPhone] = useState(salonProfile.depositBizumPhone ?? "");
  const [depositAmountEur, setDepositAmountEur] = useState(
    String(salonProfile.depositAmountEur || 10),
  );

  // Reparto de agenda — hora sugerida y colchón antes del cierre.
  const [smartSpreadEnabled, setSmartSpreadEnabled] = useState(!!salonProfile.smartSpread);
  const [lastSlotBufferMin, setLastSlotBufferMin] = useState(
    String(salonProfile.lastSlotBufferMin || 90),
  );

  // Keep the form in sync if the profile changes from elsewhere (e.g. reset).
  useEffect(() => {
    setNoShowEnabled((salonProfile.noShowFeeEur ?? 0) > 0);
    setNoShowFeeEur(String(salonProfile.noShowFeeEur || 7));
    setNoShowNoticeHours(String(salonProfile.noShowNoticeHours ?? 2));
    setSmartSpreadEnabled(!!salonProfile.smartSpread);
    setLastSlotBufferMin(String(salonProfile.lastSlotBufferMin || 90));
    setDepositEnabled(!!salonProfile.depositEnabled);
    setDepositBizumPhone(salonProfile.depositBizumPhone ?? "");
    setDepositAmountEur(String(salonProfile.depositAmountEur || 10));
  }, [salonProfile]);

  function handleSave() {
    const parsedFee = Number(noShowFeeEur.replace(",", "."));
    if (noShowEnabled && (!Number.isFinite(parsedFee) || parsedFee <= 0 || parsedFee > 50)) {
      toast.error("La penalización tiene que estar entre 0 y 50 €");
      return;
    }
    const parsedNotice = Number(noShowNoticeHours);
    if (noShowEnabled && (!Number.isFinite(parsedNotice) || parsedNotice < 1 || parsedNotice > 48)) {
      toast.error("El aviso mínimo tiene que estar entre 1 y 48 horas");
      return;
    }
    const parsedDeposit = Number(depositAmountEur.replace(",", "."));
    if (depositEnabled && (!Number.isFinite(parsedDeposit) || parsedDeposit <= 0 || parsedDeposit > 200)) {
      toast.error("La señal tiene que estar entre 0 y 200 €");
      return;
    }
    if (depositEnabled && depositBizumPhone.replace(/\D/g, "").length < 9) {
      toast.error("Escribe el número de Bizum al que te tienen que pagar la señal");
      return;
    }

    const parsedBuffer = Number(lastSlotBufferMin);
    if (
      smartSpreadEnabled &&
      (!Number.isFinite(parsedBuffer) || parsedBuffer < 0 || parsedBuffer > 240)
    ) {
      toast.error("Los minutos antes del cierre tienen que estar entre 0 y 240");
      return;
    }

    updateSalonProfile({
      noShowFeeEur: noShowEnabled ? Math.min(50, Math.max(0, parsedFee)) : 0,
      noShowNoticeHours: Math.min(48, Math.max(1, Math.round(parsedNotice) || 2)),
      smartSpread: smartSpreadEnabled,
      lastSlotBufferMin: smartSpreadEnabled ? Math.min(240, Math.max(0, Math.round(parsedBuffer))) : 0,
      depositEnabled,
      depositBizumPhone: depositBizumPhone.trim(),
      depositAmountEur: depositEnabled ? Math.min(200, Math.max(1, parsedDeposit)) : 0,
    });
    toast.success("Cambios guardados");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Ajustes" description="Las políticas de tu salón: plantones, señal y reparto de agenda." />

      <Link
        to="/app/web"
        className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/50"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Mi web</p>
          <p className="mt-2 text-sm">
            El nombre, la foto, la presentación, el teléfono, la dirección, el horario, los
            servicios y precios, el equipo y las preguntas frecuentes se cambian en{" "}
            <strong>Mi web</strong>, viendo el resultado mientras escribes.
          </p>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Plantones
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Cobra una penalización a quien cancela tarde o no viene, antes de que pueda volver a
              reservar. Tú decides en cada caso si la aplicas o la perdonas.
            </p>
          </div>
          <Switch checked={noShowEnabled} onCheckedChange={setNoShowEnabled} />
        </div>
        {noShowEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Penalización (€)"
              value={noShowFeeEur}
              onChange={setNoShowFeeEur}
              hint="De 0 a 50 €."
            />
            <Field
              label="Aviso mínimo (h)"
              value={noShowNoticeHours}
              onChange={setNoShowNoticeHours}
              hint="Cancelar con menos margen cuenta como plantón. De 1 a 48 horas."
            />
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      {/* Fianza por Bizum — lo pidió María (PeluChic) para clientas nuevas.
          Se configura aquí y solo aquí: nada depende de tocar la URL. */}
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Señal por Bizum
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Añade un botón en cada solicitud pendiente que abre tu WhatsApp con el mensaje ya
              escrito para pedir la señal. El Bizum llega a tu banco y lo marcas tú a mano:{" "}
              <strong>siShow no cobra ni comprueba ningún pago.</strong>
            </p>
          </div>
          <Switch checked={depositEnabled} onCheckedChange={setDepositEnabled} />
        </div>
        {depositEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Número de Bizum"
              value={depositBizumPhone}
              onChange={setDepositBizumPhone}
              hint="El que aparecerá escrito en el mensaje."
            />
            <Field
              label="Importe de la señal (€)"
              value={depositAmountEur}
              onChange={setDepositAmountEur}
              hint="De 1 a 200 €."
            />
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Reparto de agenda
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Sugiere una hora más tranquila cuando alguien elige una franja con espera (12:00–14:00
              o las últimas horas del día). Nunca le impide elegir la suya.
            </p>
          </div>
          <Switch checked={smartSpreadEnabled} onCheckedChange={setSmartSpreadEnabled} />
        </div>
        {smartSpreadEnabled && (
          <Field
            label="No ofrecer los últimos (min)"
            value={lastSlotBufferMin}
            onChange={setLastSlotBufferMin}
            hint="Minutos antes del cierre que dejan de ofertarse. De 0 a 240."
          />
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Política de cancelación
        </p>
        <p className="mt-2 text-sm">
          Cancelación gratuita hasta 24h antes. El depósito no es reembolsable pasado ese plazo. Las
          no-shows pierden el depósito.
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Regla de depósito</p>
        <p className="mt-2 text-sm">
          Los servicios de más de <strong>90 minutos</strong> requieren un{" "}
          <strong>20% de depósito</strong>.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
