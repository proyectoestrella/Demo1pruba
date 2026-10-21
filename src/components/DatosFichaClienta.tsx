import { useEffect, useState } from "react";
import { EtiquetaFicha } from "@/components/FichaCompleta";
import { Input } from "@/components/ui/input";
import { useSalonStore } from "@/lib/store";
import type { Client } from "@/lib/mock/types";

type Campo = "name" | "phone" | "email" | "birthday";

const CAMPOS: Array<{ campo: Campo; etiqueta: string; type: string; autoComplete: string }> = [
  { campo: "name", etiqueta: "Nombre", type: "text", autoComplete: "off" },
  { campo: "phone", etiqueta: "Teléfono", type: "tel", autoComplete: "off" },
  { campo: "email", etiqueta: "Correo", type: "email", autoComplete: "off" },
  { campo: "birthday", etiqueta: "Cumpleaños", type: "date", autoComplete: "off" },
];

/**
 * Datos de contacto de la ficha, editables a mano. Cada campo se guarda al
 * salir de él y queda en el historial de cambios con su «Deshacer».
 */
export function DatosFichaClienta({ client }: { client: Client }) {
  const updateClient = useSalonStore((s) => s.updateClient);
  const [borrador, setBorrador] = useState<Record<Campo, string>>({ name: "", phone: "", email: "", birthday: "" });
  useEffect(() => {
    setBorrador({ name: client.name ?? "", phone: client.phone ?? "", email: client.email ?? "", birthday: client.birthday ?? "" });
  }, [client.id, client.name, client.phone, client.email, client.birthday]);

  function guardar(campo: Campo) {
    const nuevo = borrador[campo].trim();
    if (nuevo === (client[campo] ?? "")) return;
    // El nombre no puede quedar vacío: se vuelve a lo que había.
    if (campo === "name" && !nuevo) {
      setBorrador((b) => ({ ...b, name: client.name }));
      return;
    }
    updateClient(client.id, { [campo]: nuevo || undefined } as Partial<Client>);
  }

  return (
    <section className="mt-3 rounded-2xl bg-card px-4 pb-4 pt-1" data-testid="datos-ficha">
      <EtiquetaFicha>Datos de la clienta</EtiquetaFicha>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CAMPOS.map(({ campo, etiqueta, type, autoComplete }) => (
          <label key={campo} className="block text-xs font-medium text-muted-foreground">
            {etiqueta}
            <Input
              type={type}
              autoComplete={autoComplete}
              value={borrador[campo]}
              onChange={(e) => setBorrador((b) => ({ ...b, [campo]: e.target.value }))}
              onBlur={() => guardar(campo)}
              className="mt-1 bg-background text-sm text-foreground"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
