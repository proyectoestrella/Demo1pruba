/** Contacto que se muestra para ejercer derechos. El correo específico manda sobre el teléfono público. */
export function contactoDerechosPrivacidad(profile: { correoPrivacidad?: string; phone?: string }): string {
  return profile.correoPrivacidad?.trim() || profile.phone?.trim() || "el salón";
}

/** Identificación del responsable para el encabezado de privacidad. */
export function responsablePrivacidad(profile: { name: string; nifResponsable?: string }): string {
  const nif = profile.nifResponsable?.trim();
  return nif ? `${profile.name} (NIF ${nif})` : profile.name;
}
