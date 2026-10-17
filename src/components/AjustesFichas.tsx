import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fijarModoFicha, useModoFicha, type TipoFicha } from "@/lib/ficha-preferencia";

const FILAS: { tipo: TipoFicha; titulo: string; ayuda: string }[] = [
  { tipo: "clienta", titulo: "Abrir la ficha de clienta en el centro", ayuda: "Si lo apagas, se abre anclada a la derecha, como antes." },
  { tipo: "cita", titulo: "Abrir la ficha de cita en el centro", ayuda: "Si lo apagas, se abre anclada a la derecha. También lo cambias con el icono de anclar de la propia ficha." },
];

/**
 * Cómo se abren las fichas en pantallas grandes. Se recuerda en este
 * navegador (no en el salón): cada persona lo deja como le gusta. En móvil
 * y tableta siempre se abren a pantalla completa o centradas.
 */
export function AjustesFichas() {
  return (
    <div className="grid gap-4">
      {FILAS.map((f) => (
        <FilaFicha key={f.tipo} {...f} />
      ))}
    </div>
  );
}

function FilaFicha({ tipo, titulo, ayuda }: (typeof FILAS)[number]) {
  const modo = useModoFicha(tipo);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={`ficha-centrada-${tipo}`} className="text-[14px] font-bold">{titulo}</Label>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{ayuda}</p>
      </div>
      <Switch id={`ficha-centrada-${tipo}`} aria-label={titulo} checked={modo === "centrada"} onCheckedChange={(v) => fijarModoFicha(tipo, v ? "centrada" : "lateral")} />
    </div>
  );
}
