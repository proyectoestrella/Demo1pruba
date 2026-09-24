/** Una lectura en segundo plano se aplaza mientras una persona está editando. */
export function debeAplazarRefresco(visible: boolean, editando: boolean, sincronizando: boolean): boolean {
  return !visible || editando || sincronizando;
}

export function haceCuanto(actualizado: number, ahora: number): string {
  const segundos = Math.max(0, Math.floor((ahora - actualizado) / 1000));
  if (segundos < 60) return "hace menos de 1 min";
  const minutos = Math.floor(segundos / 60);
  return minutos < 60 ? `hace ${minutos} min` : `hace ${Math.floor(minutos / 60)} h`;
}
