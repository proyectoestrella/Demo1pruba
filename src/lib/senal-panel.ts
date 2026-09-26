import { PLANTILLA_SENAL_POR_DEFECTO } from "./senal";

/**
 * La plantilla que de verdad se usa: vacía quiere decir «la de siempre»
 * (Ajustes › Señal no guarda la de por defecto). Los avisos de marcadores y
 * la vista previa tienen que mirar esta, no la caja vacía.
 */
export function plantillaSenalEfectiva(guardada: string | undefined | null): string {
  return guardada?.trim() ? guardada : PLANTILLA_SENAL_POR_DEFECTO;
}
