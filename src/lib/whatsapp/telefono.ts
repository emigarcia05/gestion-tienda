/** Deja el teléfono como E.164 con +. Meta manda el `from` sin +. */
export function telefonoWhatsappCanonico(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Clave de un chat. El móvil argentino `+549261…` y el tipeado `+54261…` son el mismo.
 */
export function claveChatWhatsapp(raw: string): string | null {
  const canonico = telefonoWhatsappCanonico(raw);
  if (!canonico) return null;
  const digits = canonico.slice(1);
  if (digits.startsWith("549") && digits.length > 4) return `+54${digits.slice(3)}`;
  return canonico;
}

/**
 * El mismo móvil argentino se guarda de dos formas: el que se tipea (`+54261…`)
 * y el que manda Meta (`+549261…`).
 */
export function telefonosEquivalentesWhatsapp(canonico: string): string[] {
  const digits = canonico.replace(/\D/g, "");
  const variantes = new Set<string>([`+${digits}`]);
  if (digits.startsWith("549") && digits.length > 4) {
    variantes.add(`+54${digits.slice(3)}`);
  } else if (digits.startsWith("54")) {
    variantes.add(`+549${digits.slice(2)}`);
  }
  return [...variantes];
}
