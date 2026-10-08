import { useEffect, useState } from "react";
import { toast } from "sonner";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AjustesPrivacidad() {
  const perfil = useSalonStore((s) => s.salonProfile);
  const [correo, setCorreo] = useState(perfil.correoPrivacidad ?? "");
  useEffect(() => setCorreo(perfil.correoPrivacidad ?? ""), [perfil.correoPrivacidad]);

  function guardar() {
    const limpio = correo.trim();
    if (limpio && !/^\S+@\S+\.\S+$/.test(limpio)) return toast.error("Escribe un correo válido o deja el campo vacío.");
    guardarPerfil({ correoPrivacidad: limpio || undefined });
    toast.success(limpio ? "Correo de privacidad guardado" : "Se usará el teléfono del salón como contacto de privacidad");
  }

  return <div className="space-y-3 border-t border-lino pt-5">
    <div>
      <Label htmlFor="correo-privacidad" className="text-[15px] font-extrabold">Correo para derechos de privacidad</Label>
      <p className="mt-1 text-sm text-muted-foreground">Es el correo que verán las clientas para pedir acceso, corrección, eliminación o portabilidad de sus datos. Si lo dejas vacío, se mostrará el teléfono del salón.</p>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input id="correo-privacidad" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="privacidad@tusalon.es" className="max-w-md" />
      <Button onClick={guardar} className="w-fit">Guardar correo</Button>
    </div>
  </div>;
}
