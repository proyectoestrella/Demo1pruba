import { useState } from "react";
import { Camera, Pencil } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { useMiEmployeeId, usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { conAvatar, type AvatarElegido } from "@/lib/avatar";
import { AvatarClienta, AvatarProfesional, type AvatarSize } from "@/components/Avatar";
import { SelectorAvatar } from "@/components/SelectorAvatar";
import { GestorFotoPersona } from "@/components/GestorFotoPersona";
import { useFotosDisponibles } from "@/hooks/use-foto-persona";

/**
 * El avatar de una clienta o de una profesional, con un lápiz para cambiarlo
 * si el rol puede. Se guarda en el JSON del perfil del salón
 * (`avataresClientas` / `avataresEquipo`): no hace falta columna nueva.
 */
export function EditarAvatar({ tipo, id, nombre, size = "2xl", foto }: {
  tipo: "clienta" | "profesional";
  id: string;
  nombre: string;
  size?: AvatarSize;
  foto?: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState(false);
  const fotosDisponibles = useFotosDisponibles();
  const miEmployeeId = useMiEmployeeId();
  const permisos = usePermisos();
  const campo = tipo === "clienta" ? "avataresClientas" : "avataresEquipo";
  const actual = useSalonStore((s) => s.salonProfile[campo]?.[id]);
  const mapa = useSalonStore((s) => s.salonProfile[campo]);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const puedeEditar = puede(permisos, tipo === "clienta" ? "clienta.editar" : "equipo.editar");

  // La foto la cambia quien edita la ficha; una profesional también la suya.
  const puedeFoto = fotosDisponibles && (puedeEditar || (tipo === "profesional" && !!miEmployeeId && miEmployeeId === id));

  function elegir(avatar: AvatarElegido | null) {
    updateSalonProfile({ [campo]: conAvatar(mapa, id, avatar) });
  }

  return (
    <div className="relative shrink-0">
      {tipo === "clienta" ? <AvatarClienta id={id} nombre={nombre} foto={foto} size={size} /> : <AvatarProfesional id={id} nombre={nombre} foto={foto} size={size} />}
      {puedeFoto && (
        <>
          <button
            type="button"
            onClick={() => setFotoAbierta(true)}
            aria-label={`Cambiar la foto de ${nombre}`}
            title="Foto"
            data-testid="abrir-foto"
            className="absolute -bottom-1 -left-1 grid size-8 cursor-pointer place-items-center rounded-full border border-input bg-card text-cafe-medio shadow-[var(--sombra-tarjeta)] before:absolute before:-inset-1.5 before:content-[''] hover:bg-nata focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Camera className="size-3.5" strokeWidth={1.8} />
          </button>
          <GestorFotoPersona abierto={fotoAbierta} onOpenChange={setFotoAbierta} tipo={tipo === "clienta" ? "clienta" : "equipo"} id={id} nombre={nombre} elegido={actual} />
        </>
      )}
      {puedeEditar && (
        <>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label={`Cambiar el avatar de ${nombre}`}
            title="Cambiar avatar"
            className="before:absolute before:-inset-1.5 before:content-[''] absolute -right-1 -bottom-1 grid size-8 cursor-pointer place-items-center rounded-full border border-input bg-card text-cafe-medio shadow-[var(--sombra-tarjeta)] hover:bg-nata focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Pencil className="size-3.5" strokeWidth={1.8} />
          </button>
          <SelectorAvatar abierto={abierto} onOpenChange={setAbierto} nombre={nombre} id={id} actual={actual} onElegir={elegir} />
        </>
      )}
    </div>
  );
}
