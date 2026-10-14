/** Iniciales breves para el marcador de carga cuando el salón no tiene logo. */
export function inicialesDelSalon(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const iniciales = palabras
    .slice(0, 2)
    .map((palabra) => Array.from(palabra)[0]?.toLocaleUpperCase("es-ES") ?? "")
    .join("");
  return iniciales || "S";
}

/** La cortinilla es exclusiva de los enlaces autocontenidos de demostración. */
export function debeMostrarPantallaCargaDemo(conEnlaceDemo: boolean): boolean {
  return conEnlaceDemo;
}

/** Sin fotografía propia no hay nada que esperar: se cierra al montar. */
export function debeEsperarPortadaDemo(tienePortada: boolean): boolean {
  return tienePortada;
}
