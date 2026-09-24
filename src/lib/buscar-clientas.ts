import type { Appointment, Client } from "./mock/types";

export interface DatosBusqueda {
  clientes: Client[];
  citas: Appointment[];
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
const digitos = (texto: string) => texto.replace(/\D/g, "");

/** Un término puede estar en cualquier campo; el nombre tiene prioridad. */
export function buscarClientas(texto: string, datos: DatosBusqueda): Client[] {
  const telefonoBuscado = digitos(texto);
  const soloTelefono = telefonoBuscado.length >= 4 && /^[+\d\s().-]+$/.test(texto.trim());
  const terminos = normalizar(texto).trim().split(/\s+/).filter(Boolean);
  const citasPorCliente = new Map<string, Appointment[]>();
  for (const cita of datos.citas) {
    const propias = citasPorCliente.get(cita.clientId) ?? [];
    propias.push(cita);
    citasPorCliente.set(cita.clientId, propias);
  }
  return datos.clientes.map((cliente) => {
    const nombre = normalizar(cliente.name);
    const palabrasNombre = nombre.split(/\s+/);
    const telefono = digitos(cliente.phone);
    const campos = [cliente.email ?? "", cliente.notes ?? "", ...(citasPorCliente.get(cliente.id) ?? []).filter((c) => c.status === "completed")
      .flatMap((c) => [c.colorFormula ?? "", c.technicalNotes ?? ""])].map(normalizar);
    let puntos = 0;
    if (soloTelefono && telefonoBuscado && !telefono.includes(telefonoBuscado)) return null;
    for (const termino of soloTelefono && telefonoBuscado ? [] : terminos) {
      const numero = digitos(termino);
      if (numero.length > 0 && numero.length === termino.length && telefono.includes(numero)) { puntos += 15; continue; }
      if (palabrasNombre.some((p) => p === termino)) { puntos += 100; continue; }
      if (palabrasNombre.some((p) => p.startsWith(termino))) { puntos += 80; continue; }
      if (nombre.includes(termino)) { puntos += 60; continue; }
      // «marta» también encuentra «Martín»: tolerancia acotada al tallo
      // inicial para nombres de cinco letras o más.
      if (termino.length >= 5 && palabrasNombre.some((p) => p.startsWith(termino.slice(0, 4)))) { puntos += 40; continue; }
      if (campos.some((campo) => campo.includes(termino))) { puntos += 10; continue; }
      return null;
    }
    const ultima = Math.max(0, ...(citasPorCliente.get(cliente.id) ?? [])
      .filter((c) => c.status === "completed")
      .map((c) => +new Date(c.start)));
    return { cliente, puntos, ultima };
  }).filter((r): r is { cliente: Client; puntos: number; ultima: number } => r !== null)
    .sort((a, b) => b.puntos - a.puntos || b.ultima - a.ultima || a.cliente.name.localeCompare(b.cliente.name, "es"))
    .map((r) => r.cliente);
}
