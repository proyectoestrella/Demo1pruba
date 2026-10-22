import { hashTexto, iniciales } from "./avatar";

const FONDOS = ["#E9DFD1", "#F4EBDD", "#E3D6C8"] as const;

function escaparXml(texto: string): string {
  return texto.replace(
    /[&<>"']/g,
    (caracter) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[caracter]!,
  );
}

/** Placeholder de iniciales ligero para APIs antiguas que todavía esperan una URL de imagen. */
export function avatarInicialesUri(nombre: string, semilla = nombre): string {
  const fondo = FONDOS[hashTexto(semilla) % FONDOS.length];
  const letras = escaparXml(iniciales(nombre) || "·");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-iniciales="1" viewBox="0 0 96 96" role="img" aria-label="${escaparXml(nombre)}"><circle cx="48" cy="48" r="48" fill="${fondo}"/><text x="48" y="54" text-anchor="middle" fill="#5B4636" font-family="system-ui,sans-serif" font-size="27" font-weight="700">${letras}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
