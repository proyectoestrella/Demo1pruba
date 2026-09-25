import { useState } from "react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { CONFIRMACION_POR_DEFECTO, MARCADORES, RECORDATORIO_POR_DEFECTO, rellenar } from "@/lib/plantillas-whatsapp";
import { Button } from "@/components/ui/button";

/**
 * Textos de WhatsApp de la dueña (9h): confirmación (sale al confirmar una
 * cita, en el aviso «Avisar por WhatsApp») y recordatorio (Hoja de mañana).
 * Con marcadores, vista previa con datos de ejemplo y vuelta al de siempre.
 */
export function AjustesMensajes() {
  const plantillas = useSalonStore((s) => s.salonProfile.plantillas);
  const salon = useSalonStore((s) => s.salonProfile.name);
  const direccion = useSalonStore((s) => s.salonProfile.address);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(10, 30, 0, 0);
  const ejemplo = { nombre: "Lucía", salon, startISO: manana.toISOString(), servicio: "Corte y peinado", profesional: "Sara", direccion };

  const guardar = (clave: "confirmacion" | "recordatorio", texto: string, porDefecto: string) => {
    const limpio = texto.trim();
    updateSalonProfile({ plantillas: { ...plantillas, [clave]: !limpio || limpio === porDefecto ? undefined : limpio } });
    toast.success(limpio && limpio !== porDefecto ? "Texto guardado" : "Vuelve el texto de siempre");
  };

  return (
    <>
      <Plantilla
        titulo="Confirmación"
        cuando="Sale al confirmar una cita, en el aviso «Avisar por WhatsApp»."
        inicial={plantillas?.confirmacion ?? CONFIRMACION_POR_DEFECTO}
        porDefecto={CONFIRMACION_POR_DEFECTO}
        ejemplo={ejemplo}
        onGuardar={(t) => guardar("confirmacion", t, CONFIRMACION_POR_DEFECTO)}
      />
      <Plantilla
        titulo="Recordatorio"
        cuando="Sale en «Enviar recordatorio» de la hoja de mañana. Si la señal sigue pendiente, se añade sola la frase para pagarla."
        inicial={plantillas?.recordatorio ?? RECORDATORIO_POR_DEFECTO}
        porDefecto={RECORDATORIO_POR_DEFECTO}
        ejemplo={ejemplo}
        onGuardar={(t) => guardar("recordatorio", t, RECORDATORIO_POR_DEFECTO)}
      />
    </>
  );
}

function Plantilla({
  titulo,
  cuando,
  inicial,
  porDefecto,
  ejemplo,
  onGuardar,
}: {
  titulo: string;
  cuando: string;
  inicial: string;
  porDefecto: string;
  ejemplo: Parameters<typeof rellenar>[1];
  onGuardar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const id = `plantilla-${titulo}`;
  return (
    <div className="space-y-3 border-t border-lino pt-5 first:border-t-0 first:pt-0">
      <div>
        <label htmlFor={id} className="text-[15px] font-extrabold">
          {titulo}
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">{cuando}</p>
      </div>
      <textarea id={id} value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className="w-full rounded-xl border border-input bg-blanco px-3 py-2 text-[14px] leading-relaxed" />
      <div className="flex flex-wrap gap-1.5" aria-label="Marcadores">
        {MARCADORES.map((m) => (
          <button
            key={m.clave}
            type="button"
            title={m.que}
            onClick={() => setTexto((t) => `${t}${t.endsWith(" ") || !t ? "" : " "}${m.clave}`)}
            className="h-7 rounded-full border border-salvia bg-salvia-suave px-2.5 text-[12.5px] font-bold text-hoja-tinta hover:bg-salvia-clara"
          >
            {m.clave}
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-nata p-3">
        <p className="mb-1.5 text-[12px] font-bold text-muted-foreground">Así le llega a Lucía</p>
        <p className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-salvia-clara px-3 py-2 text-[13px] leading-snug text-foreground">{rellenar(texto || porDefecto, ejemplo)}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {texto.trim() !== porDefecto && (
          <Button
            variant="ghost"
            onClick={() => {
              setTexto(porDefecto);
              onGuardar(porDefecto);
            }}
          >
            Volver al texto de siempre
          </Button>
        )}
        <Button onClick={() => onGuardar(texto)}>Guardar texto</Button>
      </div>
    </div>
  );
}
