import { useEffect, useState } from "react";
import { toast } from "sonner";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Domingos y festivos en la reserva web: con la opción activa, esos días se
 * pueden pulsar en el calendario pero en vez de horas la clienta lee un aviso
 * de costes especiales con el correo del salón. Se guarda en el perfil.
 */
export function AjustesFestivos() {
  const perfil = useSalonStore((s) => s.salonProfile);
  const [correo, setCorreo] = useState(perfil.correoDomingosFestivos ?? "");
  useEffect(() => setCorreo(perfil.correoDomingosFestivos ?? ""), [perfil.correoDomingosFestivos]);
  const activo = perfil.avisoDomingosFestivos === true;

  function guardarCorreo() {
    const limpio = correo.trim();
    if (limpio && !/^\S+@\S+\.\S+$/.test(limpio))
      return toast.error("Escribe un correo válido o deja el campo vacío.");
    guardarPerfil({ correoDomingosFestivos: limpio || undefined });
    toast.success(limpio ? "Correo del aviso guardado" : "Se usará el correo de privacidad del salón");
  }

  return (
    <div className="space-y-3 border-t border-lino pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-extrabold">Domingos y festivos en la web</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Las clientas pueden pulsar esos días, pero en vez de horas ven: «Es domingo o festivo:
            tiene costes especiales. Escríbenos a tu correo para pedir precio y hora.» Festivos de
            Madrid capital.
          </p>
        </div>
        <Switch
          aria-label="Aviso en domingos y festivos"
          checked={activo}
          onCheckedChange={(v) => guardarPerfil({ avisoDomingosFestivos: v ? true : undefined })}
        />
      </div>
      {activo && (
        <div className="space-y-1.5">
          <Label htmlFor="correo-festivos">Correo del aviso</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="correo-festivos"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder={perfil.correoPrivacidad || "reservas@tusalon.es"}
              className="max-w-md"
            />
            <Button onClick={guardarCorreo} className="w-fit">
              Guardar correo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Vacío: se usa el correo de privacidad ({perfil.correoPrivacidad || "sin configurar"}).
          </p>
        </div>
      )}
    </div>
  );
}
