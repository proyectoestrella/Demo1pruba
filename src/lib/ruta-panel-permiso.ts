import type { PaginaId } from "./permisos";

/** La página protegida de una URL del panel, sin importar el chrome del menú. */
export function paginaDeRutaPanel(path: string): PaginaId | null {
  const rutas: Array<[RegExp, PaginaId]> = [
    [/^\/app\/?$/, "hoy"],
    [/^\/app\/demos/, "demos"],
    [/^\/app\/calendar/, "calendario"],
    [/^\/app\/appointments/, "citas"],
    [/^\/app\/waitlist/, "lista-espera"],
    [/^\/app\/clients/, "clientas"],
    [/^\/app\/hoja/, "hoja"],
    [/^\/app\/employees/, "equipo"],
    [/^\/app\/services/, "servicios"],
    [/^\/app\/web/, "mi-pagina"],
    [/^\/app\/settings/, "ajustes"],
    [/^\/app\/insights/, "analitica"],
    [/^\/app\/marketing/, "marketing"],
    [/^\/app\/caja/, "caja"],
  ];
  return rutas.find(([re]) => re.test(path))?.[1] ?? null;
}
