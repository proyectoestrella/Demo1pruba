/**
 * «Cerrar sesión», y lo que de verdad hace.
 *
 * No es solo salir. El iPad del salón guarda dentro, en claro, las citas y las
 * fichas de los clientes —nombres, teléfonos, notas, deudas— para ir rápido y
 * aguantar un corte de internet. Hasta ahora no había forma de salir, así que
 * todo eso se quedaba ahí para siempre: un iPad prestado, vendido o robado lo
 * entregaba entero.
 *
 * Por eso el botón avisa antes de lo que va a pasar y por eso, al confirmar,
 * borra también ese almacén. Se dice en la pantalla con palabras normales.
 */
import { useState } from "react";
import { LogOut } from "lucide-react";

import { cerrarSesion } from "@/lib/sesion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BotonCerrarSesion({
  variante = "ancho",
}: {
  /** "ancho" para la barra lateral; "icono" para la cabecera estrecha. */
  variante?: "ancho" | "icono";
}) {
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  return (
    <>
      {variante === "icono" ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAbierto(true)}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      )}

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión en este dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán de este aparato los datos de tus clientes y tus citas. No se pierde nada:
              siguen guardados y vuelven a aparecer cuando entres otra vez con tu correo. Hazlo
              siempre que dejes de usar un móvil, un ordenador o una tablet que no sea tuya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saliendo}>Seguir dentro</AlertDialogCancel>
            <AlertDialogAction
              disabled={saliendo}
              onClick={(e) => {
                e.preventDefault();
                setSaliendo(true);
                void cerrarSesion();
              }}
            >
              {saliendo ? "Saliendo…" : "Cerrar sesión y borrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
