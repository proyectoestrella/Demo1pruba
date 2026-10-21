import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSalonStore } from "@/lib/store";

type InvitacionInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function InstalarPanel() {
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InvitacionInstalar | null>(null);
  const [instalando, setInstalando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const nav = navigator as Navigator & { standalone?: boolean };
    const sync = () => setVisible(!media.matches && !nav.standalone);
    const capturar = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InvitacionInstalar);
    };
    const instalada = () => {
      setVisible(false);
      setPrompt(null);
    };
    setIos(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    sync();
    // Solo red: permite instalación en navegadores que exigen un worker.
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/panel-sw.js", { scope: "/" }).catch(() => {});
    media.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", capturar);
    window.addEventListener("appinstalled", instalada);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", instalada);
    };
  }, []);
  if (!visible) return null;
  return (
    <details className="mx-4 mb-24 rounded-xl border border-border bg-card p-3 text-sm md:mb-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
        Instalar {salonName} en este dispositivo
      </summary>
      <div className="mt-3 space-y-3">
        {ios ? (
          <p>
            En iPhone o iPad: abre este panel en Safari, pulsa Compartir › Añadir a pantalla de
            inicio. Después entra desde el nuevo icono con el código del correo.
          </p>
        ) : (
          <>
            <p>
              Android y Chrome: pulsa Instalar. En ordenador con Chrome o Edge, también puedes usar
              el icono de instalación de la barra de direcciones o el menú del navegador.
            </p>
            {prompt ? (
              <Button
                disabled={instalando}
                onClick={async () => {
                  setInstalando(true);
                  setMensaje("");
                  try {
                    await prompt.prompt();
                    const eleccion = await prompt.userChoice;
                    setPrompt(null);
                    if (eleccion.outcome !== "accepted") {
                      setMensaje("No se ha instalado. Puedes volver a intentarlo desde el menú del navegador.");
                    }
                  } catch {
                    setMensaje("No se ha podido abrir la instalación. Usa el menú del navegador.");
                  } finally {
                    setInstalando(false);
                  }
                }}
              >
                {instalando ? "Abriendo instalación…" : "Instalar"}
              </Button>
            ) : (
              <p>
                Si no aparece el botón, abre el menú del navegador › Instalar aplicación o Añadir a
                pantalla de inicio.
              </p>
            )}
            {mensaje && <p role="status">{mensaje}</p>}
          </>
        )}
      </div>
    </details>
  );
}
