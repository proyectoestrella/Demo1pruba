import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);

  const [name, setName] = useState(salonProfile.name);
  const [address, setAddress] = useState(salonProfile.address);
  const [phone, setPhone] = useState(salonProfile.phone);
  const [instagram, setInstagram] = useState(salonProfile.instagram);

  // Keep the form in sync if the profile changes from elsewhere (e.g. reset).
  useEffect(() => {
    setName(salonProfile.name);
    setAddress(salonProfile.address);
    setPhone(salonProfile.phone);
    setInstagram(salonProfile.instagram);
  }, [salonProfile]);

  function handleSave() {
    updateSalonProfile({ name, address, phone, instagram });
    toast.success("Cambios guardados");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Ajustes" description="Perfil del salón y políticas." />

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <Field label="Nombre del salón" value={name} onChange={setName} />
        <Field label="Dirección" value={address} onChange={setAddress} />
        <Field label="Teléfono" value={phone} onChange={setPhone} />
        <Field label="Instagram" value={instagram} onChange={setInstagram} />
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Política de cancelación</p>
        <p className="mt-2 text-sm">
          Cancelación gratuita hasta 24h antes. El depósito no es reembolsable pasado ese plazo. Las
          no-shows pierden el depósito.
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Regla de depósito</p>
        <p className="mt-2 text-sm">
          Los servicios de más de <strong>90 minutos</strong> requieren un <strong>20% de depósito</strong>.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
