import { useRef } from "react";

/**
 * Devuelve el foco a lo que lo tenía antes de abrir una ventana de Radix que
 * no tiene `Trigger` (se abre por estado) o que es no modal: sin esto, al
 * cerrarla el foco cae en <body> y quien navega con teclado pierde el sitio.
 * Se pasa tal cual a `DialogPrimitive.Content` / `SheetContent`.
 *
 * Quién tenía el foco se apunta durante el render en que `open` pasa a true:
 * antes de que un `autoFocus` de dentro de la ventana se lo lleve.
 */
export function useFocoDeVuelta(open: boolean) {
  const antes = useRef<HTMLElement | null>(null);
  const estaba = useRef(false);
  if (open && !estaba.current && typeof document !== "undefined") {
    const a = document.activeElement;
    antes.current = a instanceof HTMLElement && a !== document.body ? a : null;
  }
  estaba.current = open;
  return {
    onCloseAutoFocus: (e: Event) => {
      const a = antes.current;
      if (a && a.isConnected) {
        e.preventDefault();
        a.focus({ preventScroll: true });
      }
    },
  };
}

/**
 * Lo mismo para los `Content` de shadcn (Dialog, Sheet, AlertDialog) que no
 * saben si están abiertos: `ApuntarFoco` va DENTRO del Content (solo se
 * pinta al abrir) y apunta quién tenía el foco en su primer render; el
 * `onCloseAutoFocus` devuelto lo devuelve allí. Si la ventana tiene Trigger,
 * es ese mismo botón: no cambia nada.
 */
export function devolverFocoA(antes: { current: HTMLElement | null }, propio?: (e: Event) => void) {
  return (e: Event) => {
    propio?.(e);
    if (e.defaultPrevented) return;
    const a = antes.current;
    if (a && a.isConnected) {
      e.preventDefault();
      a.focus({ preventScroll: true });
    }
  };
}
