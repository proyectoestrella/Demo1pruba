import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { apuntarseListaEsperaPublica } from "@/lib/api/salons.functions";
import { validarTelefono } from "@/lib/telefono";
import { mensajeErrorEspera } from "@/lib/lista-espera-publica";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * «¿No encuentras hueco? Avísame»: la clienta se apunta sola a la lista de
 * espera del salón desde la reserva. El salón la ve en su panel (Lista de
 * espera) y le avisa con un clic cuando se libera algo; esto no envía nada
 * por su cuenta. Solo se ofrece en salones reales (en una demo no se guarda).
 */
export function ApuntarseEsperaWeb({
  salonSlug,
  salonName,
  serviceId,
  employeeId,
  rangoSugerido,
}: {
  salonSlug: string;
  salonName: string;
  serviceId: string;
  employeeId: string;
  /** Texto con el día que estaba mirando, p. ej. «sábado 24 de octubre». */
  rangoSugerido: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rango, setRango] = useState(rangoSugerido);
  const [privacidad, setPrivacidad] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const tel = validarTelefono(telefono, "ES");
  const valido = nombre.trim().length >= 2 && tel.ok && privacidad;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = (await apuntarseListaEsperaPublica({
        data: {
          slug: salonSlug,
          clientName: nombre.trim(),
          phone: telefono,
          serviceId,
          preferredEmployeeId: employeeId,
          preferredRange: rango.trim(),
          privacyNoticeAccepted: privacidad,
        },
      })) as { synced: boolean; reason?: string };
      if (!r.synced) {
        setError(mensajeErrorEspera(r.reason));
        return;
      }
      setHecho(true);
    } catch {
      setError(mensajeErrorEspera());
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <p role="status" className="mt-5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm" data-testid="espera-hecha">
        Apuntada. Si se libera un hueco, {salonName} se pondrá en contacto contigo.
      </p>
    );
  }

  if (!abierto) {
    return (
      <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <p className="font-medium">¿No encuentras el hueco que buscas?</p>
        <button type="button" onClick={() => setAbierto(true)} className="mt-1 text-primary underline underline-offset-2">
          Avísame si se libera uno
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4 text-sm" data-testid="espera-form">
      <p className="font-medium">Te avisamos si se libera un hueco</p>
      <div className="space-y-1.5">
        <Label htmlFor="espera-nombre">Tu nombre</Label>
        <Input id="espera-nombre" className="h-11 text-[15px]" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="espera-tel">Tu teléfono</Label>
        <Input id="espera-tel" className="h-11 text-[15px]" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="espera-rango">Cuándo te vendría bien</Label>
        <Input id="espera-rango" className="h-11 text-[15px]" value={rango} onChange={(e) => setRango(e.target.value)} placeholder="Tardes entre semana, sábado por la mañana…" maxLength={100} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {salonName} usará tu nombre y teléfono solo para avisarte de un hueco.{" "}
        <Link to="/s/$salonSlug/privacidad" params={{ salonSlug }} search={(prev) => prev} className="font-medium text-primary underline-offset-2 hover:underline">
          Más información
        </Link>
      </p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-muted-foreground">
        <Checkbox className="size-6 [&_svg]:size-5" aria-label="He leído la información sobre el tratamiento de mis datos" checked={privacidad} onCheckedChange={(v) => setPrivacidad(v === true)} />
        <span>He leído la información sobre el tratamiento de mis datos.</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!valido || enviando}>{enviando ? "Apuntando…" : "Apuntarme"}</Button>
        <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
