import { IvaProveedor } from "@prisma/client";

export type ModoComparacionCostoIva = "SIN_IVA" | "CON_IVA";

/** >0 → sin IVA; ≤0 → con IVA (según política del proveedor). */
export function modoComparacionCostoDesdeSaldo(saldo: number): ModoComparacionCostoIva {
  return saldo > 0 ? "SIN_IVA" : "CON_IVA";
}

/**
 * Precio final con IVA a partir del costo lista sin IVA y la política `Proveedor.iva`.
 * `SIEMPRE` → ×1,21; `NUNCA` y `PREGUNTA` → ×1 (PREGUNTA se trata como NUNCA).
 * Para **ranking** entre proveedores (p. ej. otras pantallas) usá `pxComparablePedidoUrgenteReposicion` (incorpora balance IVA).
 */
export function pxFinalCompraConIvaProveedor(pxSinIva: number, ivaProveedor: IvaProveedor): number {
  if (!Number.isFinite(pxSinIva)) return Number.NaN;
  const factor = ivaProveedor === IvaProveedor.SIEMPRE ? 1.21 : 1;
  return pxSinIva * factor;
}

/**
 * Precio comparable para ranking de proveedores cuando se compara **mismo ítem de tienda** entre listas:
 * regla según saldo acumulado de Balance IVA (`sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido`).
 * - **IVA SALDO > 0**: comparable = **`px_compra_final_sin_iva`**.
 * - **IVA SALDO ≤ 0**: comparable = **precio final con IVA** (`pxFinalCompraConIvaProveedor`: `SIEMPRE` × 1,21; `NUNCA` / `PREGUNTA` × 1).
 */
export function pxComparablePedidoUrgenteReposicion(
  pxSinIva: number,
  ivaProveedor: IvaProveedor,
  sumaIvaSaldoAcumulado: number
): number {
  if (!Number.isFinite(pxSinIva)) return Number.NaN;
  if (sumaIvaSaldoAcumulado > 0) {
    return pxSinIva;
  }
  return pxFinalCompraConIvaProveedor(pxSinIva, ivaProveedor);
}

/** Mínimo tipo para ordenar filas de proveedor en Pedido Urgente (mismo `cod_tienda`). */
export type MiembroPrecioComparablePedidoUrgente = {
  pxCompraFinalSinIva: number | null;
  ivaProveedor: IvaProveedor;
  prefijo?: string;
  codExt: string;
};

function valorComparablePedidoUrgenteOrInf(
  m: MiembroPrecioComparablePedidoUrgente,
  sumaIvaSaldoAcumulado: number
): number {
  const px = m.pxCompraFinalSinIva;
  if (px == null || !Number.isFinite(px)) return Number.POSITIVE_INFINITY;
  const c = pxComparablePedidoUrgenteReposicion(px, m.ivaProveedor, sumaIvaSaldoAcumulado);
  return Number.isFinite(c) ? c : Number.POSITIVE_INFINITY;
}

/** Orden ascendente por precio comparable; empates por prefijo y `cod_ext`. */
export function ordenarMiembrosPedidoUrgentePorMenorCostoComparable<T extends MiembroPrecioComparablePedidoUrgente>(
  miembros: T[],
  sumaIvaSaldoAcumulado: number
): T[] {
  return [...miembros].sort((a, b) => {
    const va = valorComparablePedidoUrgenteOrInf(a, sumaIvaSaldoAcumulado);
    const vb = valorComparablePedidoUrgenteOrInf(b, sumaIvaSaldoAcumulado);
    if (va !== vb) return va - vb;
    const pa = (a.prefijo ?? "").trim().localeCompare((b.prefijo ?? "").trim(), "es");
    if (pa !== 0) return pa;
    return a.codExt.localeCompare(b.codExt);
  });
}
