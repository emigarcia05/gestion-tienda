/** N° de transferencia interna: `0001` (v1) o `0001-2` (rectificación). */
export function fmtNumeroTransferenciaInterna(numero: number, version: number): string {
  const base = String(numero).padStart(4, "0");
  return version <= 1 ? base : `${base}-${version}`;
}
