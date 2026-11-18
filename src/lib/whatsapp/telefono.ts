/** Deja el teléfono como E.164 con +. Meta manda el `from` sin +. */
export function telefonoWhatsappCanonico(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
