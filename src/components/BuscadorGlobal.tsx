import { useEffect, useRef, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { buscarClientas } from "@/lib/buscar-clientas";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import { useEquipo } from "@/lib/use-equipo";
import type { Client } from "@/lib/mock/types";
import { ClientHistorySheet } from "./ClientHistorySheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function BuscadorGlobal({ variante = "icono" }: {
  /** "icono": botón redondo. "campo": la píldora ancha de la cabecera «Arena», con el atajo `/` a la vista. */
  variante?: "icono" | "campo";
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [clienta, setClienta] = useState<Client | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const clientes = useSalonStore((s) => s.clients);
  const citas = useSalonStore((s) => s.appointments);
  const servicios = useSalonStore((s) => s.services);
  const equipo = useEquipo();

  useEffect(() => {
    function atajo(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const escribiendo = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.key === "/" && !escribiendo && !event.altKey && !event.ctrlKey && !event.metaKey) ||
          ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", atajo);
    return () => document.removeEventListener("keydown", atajo);
  }, []);
  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);

  // Lote 16: solo se busca con el buscador abierto (antes normalizaba las ~600
  // clientas y sus citas en CADA pintado de la cabecera, en cada pantalla).
  const resultados = useMemo(
    () => (open ? buscarClientas(texto, { clientes, citas }).slice(0, 12) : []),
    [open, texto, clientes, citas],
  );
  return <>
    {variante === "campo" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar clientas"
        title="Buscar clientas · / o Ctrl+K"
        className="flex h-[42px] w-full min-w-0 items-center gap-2 rounded-full border border-input bg-card px-3.5 text-left text-sm text-muted-foreground hover:bg-nata"
      >
        <Search className="size-[18px] shrink-0" strokeWidth={1.6} />
        <span className="min-w-0 flex-1 truncate">Buscar clienta por nombre o teléfono</span>
        <kbd className="hidden rounded-md border border-border px-1.5 text-[11px] font-medium md:inline">/</kbd>
      </button>
    ) : (
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Buscar clientas" title="Buscar clientas · / o Ctrl+K">
        <Search className="size-4" />
      </Button>
    )}
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setTexto(""); }}>
      <DialogContent className="top-[12%] max-h-[80dvh] w-[calc(100vw-1.5rem)] max-w-xl translate-y-0 overflow-hidden p-0 sm:top-[15%]">
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 text-left">
          <DialogTitle>Buscar clientas</DialogTitle>
          <DialogDescription>Busca por nombre, teléfono, correo, observaciones o color.</DialogDescription>
        </DialogHeader>
        <div className="px-4"><Input ref={input} type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un nombre o una fórmula…" className="h-12 text-base" aria-label="Buscar clientas" /></div>
        <div className="max-h-[55dvh] overflow-y-auto overscroll-contain px-2 pb-3">
          {resultados.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No hay clientas que coincidan.</p> : resultados.map((c) => {
            const ficha = fichaDeClienta(c.id, { citas, clientes, servicios, equipo, ahora: new Date() });
            return <button key={c.id} type="button" className="flex min-h-16 w-full flex-col justify-center rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setOpen(false); setClienta(c); }}>
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.phone} · Última visita: {ficha.resumen.ultimaVisita ? new Date(ficha.resumen.ultimaVisita).toLocaleDateString("es-ES") : "—"}</span>
              {ficha.resumen.ultimoColor && <span className="line-clamp-1 text-xs text-primary">Color: {ficha.resumen.ultimoColor.formula}</span>}
            </button>;
          })}
        </div>
      </DialogContent>
    </Dialog>
    <ClientHistorySheet client={clienta} open={!!clienta} onOpenChange={(value) => !value && setClienta(null)} />
  </>;
}
