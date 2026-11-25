/** Clave de la hoja cuando los SKU comparten una fila de `prod_familias`. El id no cambia si se renombra. */
export function claveFichaDeFlia(familiaId: string): string {
  return `FLIA ${familiaId}`.slice(0, 300);
}

/** Sin familia, la hoja queda en ese SKU. */
export function claveFichaDeSku(codTienda: string): string {
  return `ITEM ${codTienda}`.slice(0, 300);
}
