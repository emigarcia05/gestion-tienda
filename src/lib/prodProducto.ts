/** Clave de la hoja cuando los SKU comparten `prod_familias.familia_cod`. */
export function claveFichaDeFlia(codFamilia: string): string {
  return `FLIA ${codFamilia}`.slice(0, 300);
}

/** Sin familia, la hoja queda en ese SKU. */
export function claveFichaDeSku(codTienda: string): string {
  return `ITEM ${codTienda}`.slice(0, 300);
}

const COD_FAMILIA_DIGITOS = 3;

/** `6` → `006`. Más de tres dígitos se conserva. */
export function textoCodFliaItem(numero: number): string {
  return String(numero).padStart(COD_FAMILIA_DIGITOS, "0");
}

/** Vacío → null. Solo dígitos; se guarda con al menos tres posiciones (`5` y `005` son el mismo). */
export function normalizarCodFliaItem(valor: string): { ok: true; codigo: string | null } | { ok: false } {
  const digitos = valor.trim().replace(/\s+/g, "");
  if (digitos.length === 0) return { ok: true, codigo: null };
  if (!/^\d{1,6}$/.test(digitos)) return { ok: false };
  const numero = Number(digitos);
  if (!Number.isInteger(numero) || numero <= 0) return { ok: false };
  return { ok: true, codigo: textoCodFliaItem(numero) };
}
