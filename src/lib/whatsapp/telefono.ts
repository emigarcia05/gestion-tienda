/** Deja el teléfono como E.164 con +. Meta manda el `from` sin +. */
export function telefonoWhatsappCanonico(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * BSUID de Meta (`US.1349…` o padre `US.ENT.1181…`). No es un teléfono ni un phone number ID.
 * La doc de identificadores lo manda en `from_user_id` cuando el `from` no viene.
 */
export function bsuidWhatsapp(raw: string): string | null {
  const limpio = raw.trim();
  if (limpio.length > 64) return null;
  if (!/^[A-Z]{2}(?:\.[A-Z]{2,8})?\.\d{8,32}$/.test(limpio)) return null;
  return limpio;
}

/**
 * Clave de un chat. El móvil argentino `+549261…` y el tipeado `+54261…` son el mismo.
 * Sin teléfono, la clave es el BSUID.
 */
export function claveChatWhatsapp(raw: string): string | null {
  const canonico = telefonoWhatsappCanonico(raw);
  if (canonico) {
    const digits = canonico.slice(1);
    if (digits.startsWith("549") && digits.length > 4) return `+54${digits.slice(3)}`;
    return canonico;
  }
  return bsuidWhatsapp(raw);
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

/** Teléfonos equivalentes, o el BSUID si el chat todavía no tiene número. */
export function clavesConversacionWhatsapp(raw: string): { telefonos: string[]; bsuid: string | null } | null {
  const telefono = telefonoWhatsappCanonico(raw);
  if (telefono) return { telefonos: telefonosEquivalentesWhatsapp(telefono), bsuid: null };
  const bsuid = bsuidWhatsapp(raw);
  if (bsuid) return { telefonos: [bsuid], bsuid };
  return null;
}
