import type { Appointment, Client } from "./mock/types";

export interface DatosBusqueda {
  clientes: Client[];
  citas: Appointment[];
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-ES");
const digitos = (texto: string) => texto.replace(/\D/g, "");

interface Entrada {
  cliente: Client;
  nombre: string;
  palabrasNombre: string[];
  telefono: string;
  campos: string[];
  ultima: number;
}

/**
 * Móvil (22-oct): con ~1.300 clientas, normalizar todas las fichas y sus citas
 * en CADA tecla costaba >100 ms por pulsación con la CPU a x4. Lo que no
 * depende del texto buscado se prepara una vez por lista de clientas y de
 * citas (las listas de la store son inmutables: si cambian, son otras).
 */
const indices = new WeakMap<Client[], WeakMap<Appointment[], Entrada[]>>();

function indiceDe(datos: DatosBusqueda): Entrada[] {
  let porCitas = indices.get(datos.clientes);
  if (!porCitas) {
    porCitas = new WeakMap();
    indices.set(datos.clientes, porCitas);
  }
  const hecho = porCitas.get(datos.citas);
  if (hecho) return hecho;
  const citasPorCliente = new Map<string, Appointment[]>();
  for (const cita of datos.citas) {
    const propias = citasPorCliente.get(cita.clientId);
    if (propias) propias.push(cita);
    else citasPorCliente.set(cita.clientId, [cita]);
  }
  const entradas = datos.clientes.map((cliente) => {
    const nombre = normalizar(cliente.name);
    const completadas = (citasPorCliente.get(cliente.id) ?? []).filter((c) => c.status === "completed");
    return {
      cliente,
      nombre,
      palabrasNombre: nombre.split(/\s+/),
      telefono: digitos(cliente.phone),
      campos: [cliente.email ?? "", cliente.notes ?? "", ...completadas.flatMap((c) => [c.colorFormula ?? "", c.technicalNotes ?? ""])].map(normalizar),
      ultima: Math.max(0, ...completadas.map((c) => +new Date(c.start))),
    };
  });
  porCitas.set(datos.citas, entradas);
  return entradas;
}

/** Un término puede estar en cualquier campo; el nombre tiene prioridad. */
export function buscarClientas(texto: string, datos: DatosBusqueda): Client[] {
  const telefonoBuscado = digitos(texto);
  const soloTelefono = telefonoBuscado.length >= 4 && /^[+\d\s().-]+$/.test(texto.trim());
  const terminos = normalizar(texto).trim().split(/\s+/).filter(Boolean);
  const resultados: { cliente: Client; puntos: number; ultima: number }[] = [];
  for (const { cliente, nombre, palabrasNombre, telefono, campos, ultima } of indiceDe(datos)) {
    let puntos = 0;
    if (soloTelefono && telefonoBuscado && !telefono.includes(telefonoBuscado)) continue;
    let descartada = false;
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
      descartada = true;
      break;
    }
    if (!descartada) resultados.push({ cliente, puntos, ultima });
  }
  return resultados
    .sort((a, b) => b.puntos - a.puntos || b.ultima - a.ultima || a.cliente.name.localeCompare(b.cliente.name, "es"))
    .map((r) => r.cliente);
}
