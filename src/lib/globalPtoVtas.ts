/** Catálogo `ptos_vtas` (ex `global_pto_vtas`) + sucursales (`global_pto_vta_sucursales`). */

export type GlobalPtoVtaSucursalOption = {
  id: string;
  nombre: string;
};

/** Fila de `condicion_iva_cod_arca` (código oficial ARCA). */
export type PtoVentasCodArcaItem = {
  codigo: number;
  descripcion: string;
  activo: boolean;
};

export type GlobalPtoVtaItem = {
  id: string;
  /** CHAR(5) con ceros a la izquierda (ej. `00002`). */
  ptoVenta: string;
  nombreTitular: string;
  cuit: string | null;
  iiBb: string | null;
  iiBbMultilateral: boolean;
  /** Código ARCA (`condicion_iva_cod_arca.codigo`). */
  condicionIva: number | null;
  condicionIvaDescripcion: string | null;
  domicilioComercial: string | null;
  /** `YYYY-MM-DD` o null. */
  inicioActividades: string | null;
  sucursales: GlobalPtoVtaSucursalOption[];
};

export function etiquetaCondicionIvaArca(descripcion: string): string {
  return descripcion.trim().toLocaleUpperCase("es-AR");
}

export function etiquetaConvMultilateral(multilateral: boolean): "SI" | "NO" {
  return multilateral ? "SI" : "NO";
}

export function etiquetaSucursalesPtoVta(item: GlobalPtoVtaItem): string {
  return item.sucursales.map((s) => s.nombre).join(", ");
}

/** Opciones del Select: activas + el código ya persistido si quedó inactivo. */
export function opcionesCondicionIvaArca(
  catalogo: readonly PtoVentasCodArcaItem[],
  codigoActual: number | null
): PtoVentasCodArcaItem[] {
  const vistos = new Set<number>();
  const out: PtoVentasCodArcaItem[] = [];
  for (const item of catalogo) {
    if (!item.activo && item.codigo !== codigoActual) continue;
    if (vistos.has(item.codigo)) continue;
    vistos.add(item.codigo);
    out.push(item);
  }
  return out.sort((a, b) => a.codigo - b.codigo);
}

/** Normaliza a CHAR(5) con relleno de ceros (1…99999 → `00001`…`99999`). */
export function normalizarPtoVentaCodigo(raw: string | number): string | null {
  const digits = String(raw).trim().replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > 99_999) return null;
  return String(n).padStart(5, "0");
}

/** Para cruzar con `nro_pto_vta` DUX (entero). */
export function ptoVentaCodigoANumero(codigo: string): number {
  return Number.parseInt(codigo, 10);
}
