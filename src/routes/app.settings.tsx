import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DAY_LABELS_ES, DEFAULT_OPENING_HOURS, normalizeDay } from "@/lib/opening-hours";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);

  const [name, setName] = useState(salonProfile.name);
  const [tagline, setTagline] = useState(salonProfile.tagline);
  const [about, setAbout] = useState(salonProfile.about);
  const [address, setAddress] = useState(salonProfile.address);
  const [phone, setPhone] = useState(salonProfile.phone);
  const [instagram, setInstagram] = useState(salonProfile.instagram);
  const [rating, setRating] = useState(String(salonProfile.rating));
  const [reviewCount, setReviewCount] = useState(String(salonProfile.reviewCount));
  const [specialties, setSpecialties] = useState(salonProfile.specialties.join(", "));
  const [heroImage, setHeroImage] = useState(salonProfile.heroImage ?? "");
  const [openingHours, setOpeningHours] = useState<string[]>(
    salonProfile.openingHours?.length === 7 ? salonProfile.openingHours : DEFAULT_OPENING_HOURS,
  );

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
    setName(salonProfile.name);
    setTagline(salonProfile.tagline);
    setAbout(salonProfile.about);
    setAddress(salonProfile.address);
    setPhone(salonProfile.phone);
    setInstagram(salonProfile.instagram);
    setRating(String(salonProfile.rating));
    setReviewCount(String(salonProfile.reviewCount));
    setSpecialties(salonProfile.specialties.join(", "));
    setHeroImage(salonProfile.heroImage ?? "");
    setOpeningHours(
      salonProfile.openingHours?.length === 7 ? salonProfile.openingHours : DEFAULT_OPENING_HOURS,
    );
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
    const parsedRating = Number(rating.replace(",", "."));
    const parsedCount = Number(reviewCount.replace(/[^\d]/g, ""));

    // Una nota fuera de escala se ve a la legua en el hero: mejor avisar que
    // guardar algo que deje la demo en evidencia delante del cliente.
    if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) {
      toast.error("La nota tiene que estar entre 0 y 5");
      return;
    }

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
      name,
      tagline,
      about,
      address,
      phone,
      instagram,
      rating: parsedRating,
      reviewCount: Number.isFinite(parsedCount) ? parsedCount : 0,
      specialties: specialties
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
      heroImage: heroImage.trim(),
      openingHours: openingHours.map(normalizeDay),
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
      <PageHeader title="Ajustes" description="Perfil del salón y políticas." />

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <Field label="Nombre del salón" value={name} onChange={setName} />
        <Field
          label="Tipo de negocio"
          value={tagline}
          onChange={setTagline}
          hint="El rótulo bajo el nombre, p. ej. «Peluquería y estética» o «Salón unisex»."
        />
        <Field
          label="Dirección"
          value={address}
          onChange={setAddress}
          hint="Mueve también el mapa de «Cómo llegar»."
        />
        <Field label="Teléfono" value={phone} onChange={setPhone} />
        <Field label="Instagram" value={instagram} onChange={setInstagram} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nota" value={rating} onChange={setRating} hint="De 0 a 5." />
          <Field label="Nº de reseñas" value={reviewCount} onChange={setReviewCount} />
        </div>

        <Field
          label="Especialidades"
          value={specialties}
          onChange={setSpecialties}
          hint="Separadas por comas. Van rotando tras «Especialistas en»."
        />

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Horario</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {DAY_LABELS_ES.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
                <Input
                  value={openingHours[i] ?? ""}
                  onChange={(e) =>
                    setOpeningHours((h) => {
                      const next = [...h];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                  placeholder="10:00–14:00, 16:00–20:00 · o Cerrado"
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Sale en la píldora «Abierto · cierra a las…», en «Cómo llegar» y en el pie de la web.
          </p>
        </div>

        <Field
          label="Foto de portada (URL)"
          value={heroImage}
          onChange={setHeroImage}
          hint="Vacío usa la foto de ejemplo. Debe acabar en .jpg, .png o .webp."
        />

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Presentación
          </Label>
          <Textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={3}
            className="resize-y"
          />
          <p className="text-xs text-muted-foreground">
            El párrafo bajo el titular del hero y en el pie de página.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

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
