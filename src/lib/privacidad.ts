/** Contacto que se muestra para ejercer derechos. El correo específico manda sobre el teléfono público. */
export function contactoDerechosPrivacidad(profile: { correoPrivacidad?: string; phone?: string }): string {
  return profile.correoPrivacidad?.trim() || profile.phone?.trim() || "el salón";
}
