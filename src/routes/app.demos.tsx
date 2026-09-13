import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
} from "lucide-react";
import { useSalonStore, type SavedDemo } from "@/lib/store";
import {
  blankDemoProfile,
  demoUrl,
  parseGoogleMapsPaste,
  slugify,
  type DemoProfile,
} from "@/lib/demo-profile";
import { inferTipo, lookupGoogleMaps, type MapsLookup } from "@/lib/api/maps.functions";
import { DAY_LABELS_ES, DEFAULT_OPENING_HOURS, normalizeDay } from "@/lib/opening-hours";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/demos")({ component: Demos });

/** Formulario en edición: todo texto, se convierte a números al guardar. */
interface DraftDemo {
  id?: string;
  name: string;
  tagline: string;
  about: string;
  address: string;
  phone: string;
  instagram: string;
  rating: string;
  reviewCount: string;
  specialties: string;
  heroImage: string;
  openingHours: string[];
  photoCount: number;
  galleryPhotos: string[];
}

function draftFrom(demo: DemoProfile & { id?: string }): DraftDemo {
  return {
    id: demo.id,
    name: demo.name,
    tagline: demo.tagline,
    about: demo.about,
    address: demo.address,
    phone: demo.phone,
    instagram: demo.instagram,
    rating: String(demo.rating),
    reviewCount: String(demo.reviewCount),
    specialties: demo.specialties.join(", "),
    heroImage: demo.heroImage ?? "",
    openingHours:
      demo.openingHours?.length === 7 ? [...demo.openingHours] : [...DEFAULT_OPENING_HOURS],
    photoCount: demo.photoCount ?? 0,
    galleryPhotos: demo.galleryPhotos ?? [],
  };
}

function Demos() {
  const savedDemos = useSalonStore((s) => s.savedDemos);
  const saveDemo = useSalonStore((s) => s.saveDemo);
  const deleteDemo = useSalonStore((s) => s.deleteDemo);
  const applyDemo = useSalonStore((s) => s.applyDemo);
  const resetSalonProfile = useSalonStore((s) => s.resetSalonProfile);
  const activeName = useSalonStore((s) => s.salonProfile.name);

  const [draft, setDraft] = useState<DraftDemo | null>(null);
  const [paste, setPaste] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [lote, setLote] = useState("");
  const [loteTipo, setLoteTipo] = useState("");
  const [loteProgreso, setLoteProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function field<K extends keyof DraftDemo>(key: K, value: DraftDemo[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleMapsLookup() {
    const url = mapsUrl.trim();
    if (!url) return;
    setBuscando(true);
    try {
      const r = await lookupGoogleMaps({ data: { url } });
      const traidos = (
        ["name", "address", "phone", "rating", "reviewCount", "heroImage", "openingHours"] as const
      ).filter((k) => r[k] !== undefined && r[k] !== "");

      if (traidos.length === 0) {
        toast.error(r.notice ?? "No he podido sacar nada de ese enlace");
        return;
      }

      setDraft((d) => {
        const base = d ?? draftFrom(blankDemoProfile());
        return {
          ...base,
          ...(r.name ? { name: r.name } : {}),
          ...(r.name && !base.tagline.trim() ? { tagline: inferTipo(r.name) } : {}),
          ...(r.address ? { address: r.address } : {}),
          ...(r.phone ? { phone: r.phone } : {}),
          ...(r.rating !== undefined ? { rating: String(r.rating) } : {}),
          ...(r.reviewCount !== undefined ? { reviewCount: String(r.reviewCount) } : {}),
          ...(r.heroImage ? { heroImage: r.heroImage } : {}),
          ...(r.openingHours ? { openingHours: r.openingHours } : {}),
          photoCount: r.photoCount ?? 0,
          galleryPhotos: r.galleryPhotos ?? [],
        };
      });
      setMapsUrl("");
      toast.success(`He traído ${traidos.length} campo${traidos.length === 1 ? "" : "s"}`, {
        description: r.notice,
      });
    } catch {
      toast.error("No he podido consultar ese enlace");
    } finally {
      setBuscando(false);
    }
  }

  /** Convierte lo que devuelve Google en una demo lista para guardar. */
  function demoFromLookup(r: MapsLookup, tipo: string): DemoProfile | null {
    if (!r.name) return null;
    return {
      ...blankDemoProfile(),
      name: r.name,
      tagline: tipo || inferTipo(r.name),
      address: r.address ?? "",
      phone: r.phone ?? "",
      rating: r.rating ?? blankDemoProfile().rating,
      reviewCount: r.reviewCount ?? 0,
      heroImage: r.heroImage ?? "",
      openingHours: r.openingHours ?? [...DEFAULT_OPENING_HOURS],
      photoCount: r.photoCount ?? 0,
      galleryPhotos: r.galleryPhotos ?? [],
    };
  }

  /**
   * Una demo por línea: enlace de Maps o "Nombre, Dirección". Pensado para
   * pegar la columna del rutero entera la noche antes y no en la puerta.
   * Va en serie y no en paralelo a propósito: son 50 llamadas a Google y la
   * cuota por minuto está capada.
   */
  async function handleLote() {
    const lineas = lote
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lineas.length === 0) return;
    setLoteProgreso({ hecho: 0, total: lineas.length });
    let creadas = 0;
    const fallidas: string[] = [];
    for (const [i, linea] of lineas.entries()) {
      try {
        const r = await lookupGoogleMaps({ data: { url: linea } });
        const demo = demoFromLookup(r, loteTipo.trim());
        if (demo) {
          saveDemo(demo);
          creadas++;
        } else {
          fallidas.push(linea.slice(0, 60));
        }
      } catch {
        fallidas.push(linea.slice(0, 60));
      }
      setLoteProgreso({ hecho: i + 1, total: lineas.length });
    }
    setLoteProgreso(null);
    setLote("");
    if (fallidas.length === 0) {
      toast.success(`${creadas} demos creadas`);
    } else {
      toast.warning(`${creadas} creadas · ${fallidas.length} sin resolver`, {
        description: fallidas.slice(0, 3).join(" · ") + (fallidas.length > 3 ? " …" : ""),
        duration: 12000,
      });
    }
  }

  function handleImport() {
    const parsed = parseGoogleMapsPaste(paste);
    const found = Object.keys(parsed).length;
    if (found === 0) {
      toast.error("No he reconocido nada en ese texto");
      return;
    }
    setDraft((d) => {
      const base = d ?? draftFrom(blankDemoProfile());
      return {
        ...base,
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.address !== undefined ? { address: parsed.address } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
        ...(parsed.instagram !== undefined ? { instagram: parsed.instagram } : {}),
        ...(parsed.rating !== undefined ? { rating: String(parsed.rating) } : {}),
        ...(parsed.reviewCount !== undefined ? { reviewCount: String(parsed.reviewCount) } : {}),
      };
    });
    setPaste("");
    toast.success(`He rellenado ${found} campo${found === 1 ? "" : "s"} — revísalos`);
  }

  function handleSave() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Ponle al menos el nombre del salón");
      return;
    }
    const rating = Number(draft.rating.replace(",", "."));
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      toast.error("La nota tiene que estar entre 0 y 5");
      return;
    }
    const count = Number(draft.reviewCount.replace(/[^\d]/g, ""));

    saveDemo(
      {
        name: draft.name.trim(),
        tagline: draft.tagline.trim(),
        about: draft.about.trim(),
        address: draft.address.trim(),
        phone: draft.phone.trim(),
        instagram: draft.instagram.trim(),
        rating,
        reviewCount: Number.isFinite(count) ? count : 0,
        specialties: draft.specialties
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean),
        heroImage: draft.heroImage.trim(),
        openingHours: draft.openingHours.map(normalizeDay),
        photoCount: draft.photoCount,
        galleryPhotos: draft.galleryPhotos,
      },
      draft.id,
    );
    toast.success(draft.id ? "Demo actualizada" : "Demo guardada");
    setDraft(null);
  }

  async function handleCopy(demo: SavedDemo) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = demoUrl(demo, origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(demo.id);
      setTimeout(() => setCopiedId((c) => (c === demo.id ? null : c)), 2000);
      toast.success("Enlace copiado");
    } catch {
      // Sin permiso de portapapeles (pasa en algunos navegadores móviles):
      // se enseña el enlace para poder copiarlo a mano en vez de fallar mudo.
      toast.error("No he podido copiarlo — está en la barra de direcciones", {
        description: url,
      });
    }
  }

  function handleActivate(demo: SavedDemo) {
    applyDemo(demo.id);
    toast.success(`Panel y web pública ahora son ${demo.name}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Demos"
        description="Salones preparados para enseñar en una visita. Actívalos en la tablet o manda el enlace."
      />

      {draft === null ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setDraft(draftFrom(blankDemoProfile()))}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva demo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetSalonProfile();
              toast.success("Panel y web pública vuelven al salón de ejemplo");
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar salón de ejemplo
          </Button>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Enlace de Google Maps
            </Label>
            <div className="flex gap-2">
              <Input
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleMapsLookup();
                  }
                }}
                placeholder="Pega aquí el enlace de «Compartir» de Maps"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                onClick={() => void handleMapsLookup()}
                disabled={!mapsUrl.trim() || buscando}
              >
                {buscando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Traer
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              En Maps: abre la ficha del salón → <strong>Compartir</strong> →{" "}
              <strong>Copiar vínculo</strong>. Y pégalo aquí.
            </p>
          </div>

          <div className="h-px bg-border/60" />

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              O pegar la ficha copiada
            </Label>
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={3}
              placeholder={
                "Peluquería Los Ángeles\n4,6(87)\nCalle Mayor 14, Alcalá de Henares\n918 12 34 56"
              }
              className="resize-y font-mono text-xs"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Copia la ficha del salón y pégala aquí: relleno lo que reconozca.
              </p>
              <Button variant="outline" size="sm" onClick={handleImport} disabled={!paste.trim()}>
                <Wand2 className="mr-2 h-4 w-4" />
                Rellenar
              </Button>
            </div>
          </div>

          <div className="h-px bg-border/60" />

          <DraftField
            label="Nombre del salón"
            value={draft.name}
            onChange={(v) => field("name", v)}
          />
          <DraftField
            label="Tipo de negocio"
            value={draft.tagline}
            onChange={(v) => field("tagline", v)}
            hint="«Barbería clásica», «Peluquería y estética»…"
          />
          <DraftField
            label="Dirección"
            value={draft.address}
            onChange={(v) => field("address", v)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DraftField label="Teléfono" value={draft.phone} onChange={(v) => field("phone", v)} />
            <DraftField
              label="Instagram"
              value={draft.instagram}
              onChange={(v) => field("instagram", v)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DraftField
              label="Nota"
              value={draft.rating}
              onChange={(v) => field("rating", v)}
              hint="De 0 a 5."
            />
            <DraftField
              label="Nº de reseñas"
              value={draft.reviewCount}
              onChange={(v) => field("reviewCount", v)}
            />
          </div>
          <DraftField
            label="Especialidades"
            value={draft.specialties}
            onChange={(v) => field("specialties", v)}
            hint="Separadas por comas. Rotan tras «Especialistas en»."
          />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Horario
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {DAY_LABELS_ES.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
                  <Input
                    value={draft.openingHours[i] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => {
                        if (!d) return d;
                        const next = [...d.openingHours];
                        next[i] = e.target.value;
                        return { ...d, openingHours: next };
                      })
                    }
                    placeholder="10:00–14:00, 16:00–20:00 · o Cerrado"
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Se rellena solo desde Google si la ficha lo publica. Formato: «10:00–13:30,
              17:00–20:00» o «Cerrado».
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Foto de portada (URL)
            </Label>
            <Input
              value={draft.heroImage}
              onChange={(e) => field("heroImage", e.target.value)}
              placeholder="https://…  ·  vacío = la foto de ejemplo"
            />
            {draft.heroImage.trim() ? (
              <div className="overflow-hidden rounded-lg border border-border/60">
                {/* La vista previa no es un adorno: una URL rota se descubre aquí
                    y no delante del peluquero. */}
                <img
                  src={draft.heroImage}
                  alt="Vista previa de la portada"
                  className="h-32 w-full bg-muted object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.insertAdjacentHTML(
                      "afterend",
                      '<p class="p-3 text-xs text-destructive">No se puede cargar esa imagen. Comprueba la dirección.</p>',
                    );
                  }}
                />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Botón derecho sobre una foto de su web o su Instagram → «Copiar dirección de la
              imagen». Tiene que acabar en .jpg, .png o .webp.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Presentación
            </Label>
            <Textarea
              value={draft.about}
              onChange={(e) => field("about", e.target.value)}
              rows={3}
              className="resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{draft.id ? "Guardar cambios" : "Guardar demo"}</Button>
          </div>
        </div>
      )}

      {draft === null && (
        <details className="rounded-xl border border-border/60 bg-card p-6">
          <summary className="cursor-pointer text-sm font-medium">
            Cargar el rutero en lote
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              una demo por línea: enlace de Maps o «Nombre, Dirección»
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            <Textarea
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              rows={6}
              placeholder={
                "https://www.google.com/maps/search/?api=1&query=Barber%20Hamza…\nVannity Peluquería, Calle Burguete 38, 28050 Madrid\n…"
              }
              className="resize-y font-mono text-xs"
              disabled={loteProgreso !== null}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Tipo de negocio para todas
                </Label>
                <Input
                  value={loteTipo}
                  onChange={(e) => setLoteTipo(e.target.value)}
                  placeholder="vacío = deducir del nombre"
                  className="w-56"
                />
              </div>
              <Button
                onClick={() => void handleLote()}
                disabled={!lote.trim() || loteProgreso !== null}
              >
                {loteProgreso ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {loteProgreso.hecho} / {loteProgreso.total}
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Crear demos
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Google da nombre, dirección, teléfono, nota, reseñas, horario y fotos. Especialidades
              y presentación se completan después: el aviso de cada demo dice cuáles faltan.
            </p>
          </div>
        </details>
      )}

      {savedDemos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay ninguna demo guardada. Prepara una por cada salón que vayas a visitar y
            tenlas listas para activarlas de un toque.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedDemos.map((demo) => {
            const isActive = demo.name === activeName;
            return (
              <div
                key={demo.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border/60 bg-card p-5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg">{demo.name}</p>
                    {isActive && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                        Activa
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[demo.tagline, demo.address].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {demo.rating} ★ · {demo.reviewCount} reseñas
                    {demo.photoCount ? ` · ${demo.photoCount} fotos de Google` : ""} · /s/
                    {slugify(demo.name)}
                  </p>
                  {missingBits(demo).length > 0 && (
                    <p className="text-xs text-amber-500/90">
                      Sin rellenar: {missingBits(demo).join(", ")}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(demo)}>
                    {copiedId === demo.id ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Enlace
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={demoUrl(
                        demo,
                        typeof window !== "undefined" ? window.location.origin : "",
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDraft(draftFrom(demo))}>
                    Editar
                  </Button>
                  <Button size="sm" onClick={() => handleActivate(demo)} disabled={isActive}>
                    Activar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label={`Borrar ${demo.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar «{demo.name}»?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se borra solo de esta lista. Los enlaces que ya hayas mandado siguen
                          funcionando, porque los datos viajan dentro del propio enlace.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            deleteDemo(demo.id);
                            toast.success("Demo borrada");
                          }}
                        >
                          Borrar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Cómo funciona</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Activar</strong> cambia el salón en esta tablet:
            panel y web pública pasan a ser ese negocio.
          </li>
          <li>
            <strong className="text-foreground">Enlace</strong> copia una dirección que lleva los
            datos dentro. Quien la abra verá ese salón aunque no tenga nada guardado — es la que
            mandas por WhatsApp.
          </li>
          <li>
            <strong className="text-foreground">Restaurar</strong> devuelve el panel al salón de
            ejemplo. No borra ninguna demo: siguen aquí para volver a activarlas.
          </li>
          <li>
            Esta página no aparece en el menú a propósito, para que no se vea mientras enseñas el
            producto. Se llega escribiendo <code className="text-foreground">/app/demos</code>.
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Campos que, vacíos, se notan en la demo. No bloquean guardar — a veces no da
 * tiempo a rellenarlo todo antes de entrar — pero conviene verlos de un vistazo.
 */
function missingBits(demo: SavedDemo): string[] {
  const missing: string[] = [];
  if (!demo.tagline.trim()) missing.push("tipo de negocio");
  if (!demo.about.trim()) missing.push("presentación");
  if (demo.specialties.length === 0) missing.push("especialidades");
  if (!demo.address.trim()) missing.push("dirección");
  return missing;
}

function DraftField({
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
