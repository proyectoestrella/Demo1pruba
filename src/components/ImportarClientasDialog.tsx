import { useMemo, useState } from "react";
import { ImportarVentasTpv } from "@/components/ImportarVentasTpv";
import { usePermisos, useTienePlan } from "@/lib/accesos-panel";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { puede } from "@/lib/permisos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { conRegistroEnPausa, useSalonStore } from "@/lib/store";
import { usaTpv123 } from "@/lib/plan-basico";
import { claveNombre, completarDatosTpvCliente, detectarColumnas, leerTabla, normalizarTelefono, vistaPreviaClientas, type CampoCliente, type FilaClienta, type MapaColumnas, type TablaImportacion } from "@/lib/importar-clientas";
import type { Client } from "@/lib/mock/types";

const campos: { key: CampoCliente; label: string }[] = [
  { key: "nombre", label: "Nombre" }, { key: "apellidos", label: "Apellidos" },
  { key: "telefono", label: "Teléfono móvil" }, { key: "telefono2", label: "Otro teléfono (solo para detectar el móvil)" },
  { key: "email", label: "Correo" }, { key: "codigo", label: "Código TPV 123" },
  { key: "cumple", label: "Cumpleaños" }, { key: "direccion", label: "Dirección" },
  { key: "dni", label: "DNI/CIF (solo ficha)" }, { key: "alta", label: "Fecha de alta" }, { key: "ultimaVisita", label: "Última visita" },
];

function fichaExistente(fila: FilaClienta, clientes: Client[]): Client | undefined {
  if (fila.codigo) {
    const porCodigo = clientes.find((c) => c.tpvCode === fila.codigo);
    if (porCodigo) return porCodigo;
  }
  const telefono = normalizarTelefono(fila.telefono);
  if (telefono) {
    const porTelefono = clientes.find((c) => normalizarTelefono(c.phone) === telefono);
    if (porTelefono) return porTelefono;
  }
  return clientes.find((c) => claveNombre(c.name) === claveNombre(fila.nombre));
}

export function ImportarClientasDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const origen = useSalonStore((s) => s.salonProfile.clientImportOrigin);
  const esTpv123 = usaTpv123({ clientImportOrigin: origen });
  const clientes = useSalonStore((s) => s.clients);
  const addClient = useSalonStore((s) => s.addClient);
  const updateClient = useSalonStore((s) => s.updateClient);
  const [tabla, setTabla] = useState<TablaImportacion | null>(null);
  const [mapa, setMapa] = useState<MapaColumnas>({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resumen, setResumen] = useState("");
  // Solo quien puede importar dinero puede usar la importación mensual. Si
  // no está incluida se ve su ejemplo aquí mismo, sin abrir el importador.
  const tieneImportacionMensual = useTienePlan("importacion-mensual");
  const puedeImportarDinero = puede(usePermisos(), "dinero.importar");
  const puedeVentas = puedeImportarDinero && tieneImportacionMensual;
  const [pestana, setPestana] = useState<"clientas" | "ventas">("clientas");
  const previa = useMemo(() => tabla && mapa.nombre !== undefined ? vistaPreviaClientas(tabla, clientes, mapa) : null, [tabla, clientes, mapa]);
  const fichasACompletar = useMemo(() => previa?.filas.filter((fila) => {
    if (fila.estado !== "duplicada") return false;
    const existente = fichaExistente(fila, clientes);
    return !!existente && Object.keys(completarDatosTpvCliente(existente, fila)).length > 0;
  }).length ?? 0, [previa, clientes]);

  async function cargar(file: File | undefined) {
    if (!file) return;
    setOcupado(true); setError(""); setResumen("");
    try {
      const data = await leerTabla(file);
      if (!data.cabeceras.length) throw new Error("El archivo no tiene cabeceras.");
      setTabla(data);
      setMapa(detectarColumnas(data.cabeceras));
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido leer el archivo."); }
    finally { setOcupado(false); }
  }

  function importar() {
    if (!previa || !tabla || mapa.nombre === undefined) return;
    const nuevas: Client[] = [];
    let completadas = 0;
    // Una importación masiva no llena el historial ni saca un aviso por cada ficha.
    conRegistroEnPausa(() => {
    for (const fila of previa.filas.filter((f) => f.estado === "nueva")) {
      nuevas.push(addClient({
        name: fila.nombre, phone: fila.telefono, email: fila.email, tpvCode: fila.codigo,
        birthday: fila.birthday, address: fila.address, taxId: fila.taxId,
        tpvAltaDate: fila.tpvAltaDate, tpvLastVisit: fila.tpvLastVisit,
      }));
    }
    for (const fila of previa.filas.filter((f) => f.estado === "duplicada")) {
      const existente = fichaExistente(fila, clientes);
      if (!existente) continue;
      const faltantes = completarDatosTpvCliente(existente, fila);
      if (Object.keys(faltantes).length) {
        updateClient(existente.id, faltantes);
        completadas++;
      }
    }
    });
    setResumen(`Importadas ${nuevas.length} clientas${completadas ? ` y completadas ${completadas} fichas que ya existían` : ""}. ${previa.duplicadas} duplicadas y ${previa.errores} filas con errores.`);
    setTabla(null); setMapa({});
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>{esTpv123 ? "Importar desde TPV 123" : "Importar clientas"}</DialogTitle>
        <DialogDescription>Trae la lista de clientas. La vista previa valida filas y duplicados antes de guardar; no se sube ningún archivo.</DialogDescription>
      </DialogHeader>
      {puedeVentas && (
        <div role="tablist" aria-label="Qué importar" className="inline-flex gap-0.5 rounded-full border border-border bg-nata p-1">
          {([["clientas", "Clientas"], ["ventas", "Ventas de TPV 123"]] as const).map(([id, t]) => (
            <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
              className={pestana === id ? "rounded-full bg-card px-3.5 py-1.5 text-[13px] font-bold shadow-sm" : "rounded-full px-3.5 py-1.5 text-[13px] font-bold text-cafe-medio"}>
              {t}
            </button>
          ))}
        </div>
      )}
      {pestana === "ventas" && puedeVentas ? <ImportarVentasTpv /> : <div className="space-y-4 text-sm">
        <label className="block space-y-1 font-medium">Fichero de clientas (.csv, .xls o .xlsx)
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void cargar(e.target.files?.[0])}
            className="block w-full min-w-0 rounded border border-border p-2 text-sm font-normal" />
        </label>
        <p className="rounded-lg bg-nata p-3 text-xs text-cafe-medio">Se guardan nombre, apellidos, móvil y correo{esTpv123 ? ", código TPV 123, cumpleaños, dirección, DNI/CIF, fecha de alta y última visita" : ""}. El DNI/CIF solo se ve dentro de la ficha y sirve para futuras facturas. Se ignoran las demás columnas; el archivo se procesa en este navegador.</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {tabla && <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {campos.map((campo) => <label key={campo.key} className="space-y-1 text-xs">
              <span>{campo.label}</span>
              <select aria-label={campo.label} value={mapa[campo.key] ?? ""} onChange={(e) => setMapa((m) => ({ ...m, [campo.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                className="w-full min-w-0 rounded border border-border bg-background p-2 text-sm">
                <option value="">Sin columna</option>
                {tabla.cabeceras.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
              </select>
            </label>)}
          </div>
          {mapa.nombre === undefined ? <p role="alert">Elige qué columna contiene el nombre para ver la vista previa.</p> : previa && <>
            <p className="font-medium">Vista previa de simulación: {previa.nuevas} nuevas · {previa.duplicadas} duplicadas · {previa.errores} con errores. Nada se guarda hasta pulsar «Importar».</p>
            {fichasACompletar > 0 && <p className="text-xs text-muted-foreground">Además, se completarán {fichasACompletar} {fichasACompletar === 1 ? "ficha que ya existe" : "fichas que ya existen"}, sin cambiar los datos que ya tienen.</p>}
            <p className="text-xs text-muted-foreground">Con datos TPV: {previa.conCumpleanos} cumpleaños · {previa.conDireccion} direcciones · {previa.conDniCif} DNI/CIF · {previa.conFechaAlta} fechas de alta · {previa.conUltimaVisita} últimas visitas.</p>
            {previa.avisosFecha > 0 && <p role="status" className="text-xs text-melocoton-tinta">{previa.avisosFecha} {previa.avisosFecha === 1 ? "fecha no se ha podido leer" : "fechas no se han podido leer"}; esas casillas se dejarán vacías.</p>}
            {previa.avisosDniCif > 0 && <p role="status" className="text-xs text-melocoton-tinta">{previa.avisosDniCif} {previa.avisosDniCif === 1 ? "DNI/CIF tiene" : "DNI/CIF tienen"} un formato poco habitual; se guardará tal como viene.</p>}
            {previa.duplicadas > 0 && <p className="break-words text-muted-foreground">Duplicadas: {previa.filas.filter((f) => f.estado === "duplicada").map((f) => f.nombre).join(", ")}</p>}
            <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-border p-2">
              {previa.filas.slice(0, 10).map((f) => <p key={f.fila} className="break-words">{f.fila}. {f.nombre || "Sin nombre"} · {f.telefono || "sin teléfono"} · {f.estado === "nueva" ? "Nueva" : f.estado === "duplicada" ? "Duplicada" : `Error: ${f.motivo}`}{f.avisos?.length ? ` · ${f.avisos.join("; ")}` : ""}</p>)}
            </div>
            <Button onClick={importar} disabled={ocupado || (!previa.nuevas && !fichasACompletar)} className="w-full sm:w-auto">{previa.nuevas ? `Importar ${previa.nuevas} clientas` : `Completar ${fichasACompletar} ${fichasACompletar === 1 ? "ficha" : "fichas"}`}</Button>
          </>}
        </>}
        {resumen && <p role="status" className="rounded bg-primary/10 p-3">{resumen}</p>}
        <details className="rounded border border-border p-3 text-muted-foreground">
          <summary className="cursor-pointer font-medium">{esTpv123 ? "Cómo sacar los Excel de TPV 123" : "Consejo para preparar el archivo"}</summary>
          <div className="mt-2 space-y-2">
            <p><strong>Clientas:</strong> Listados › Listados generales › Clientes › flecha verde.</p>
          </div>
        </details>
      </div>}
      {!puedeVentas && esTpv123 && puedeImportarDinero && <LlegaConPlan funcion="importacion-mensual" compacta />}
    </DialogContent>
  </Dialog>;
}
