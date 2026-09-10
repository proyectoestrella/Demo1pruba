import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
          hint="El rótulo bajo el nombre: «Barbería clásica», «Peluquería y estética»…"
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
