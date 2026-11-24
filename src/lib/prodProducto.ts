const TERMINACIONES = ["BRILLANTE", "SATINADO", "MATE"];

/** Quita del nombre el tamaño, el color y la terminación. Lo que queda identifica al producto. */
export function nombreDeProducto(input: {
  descripcion: string;
  presentacion: string | null;
  color: string | null;
  terminacion: string | null;
}): string {
  let nombre = input.descripcion.toLocaleUpperCase("es-AR").replace(/\s+/g, " ").trim();
  for (const quitar of [input.presentacion, input.color, input.terminacion, ...TERMINACIONES]) {
    const fragmento = (quitar ?? "").trim().toLocaleUpperCase("es-AR");
    if (fragmento.length < 2) continue;
    const literal = fragmento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    nombre = nombre.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${literal}(?![\\p{L}\\p{N}])`, "gu"),
      " "
    );
  }
  nombre = nombre.replace(/\s+/g, " ").trim();
  if (nombre.length < 4) {
    nombre = input.descripcion.toLocaleUpperCase("es-AR").replace(/\s+/g, " ").trim();
  }
  return nombre.slice(0, 300);
}

/** Clave de la hoja del fabricante: una por producto, no por SKU. */
export function claveFichaDeProducto(idProducto: string): string {
  return `PROD ${idProducto}`.slice(0, 300);
}

/** Clave de la hoja cuando los SKU comparten `prod_lista.cod_flia_item`. */
export function claveFichaDeFlia(codFliaItem: string): string {
  return `FLIA ${codFliaItem}`.slice(0, 300);
}

const COD_FLIA_ITEM_DIGITOS = 3;

/** `6` → `006`. Más de tres dígitos se conserva. */
export function textoCodFliaItem(numero: number): string {
  return String(numero).padStart(COD_FLIA_ITEM_DIGITOS, "0");
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
