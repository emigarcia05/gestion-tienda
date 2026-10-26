/**
 * Costos Variables del Balance mensual que salen de libros automáticos (no de Gastos):
 * Cx Merc. Vend., Cx Fin Cobros, Balance IVA y Balance IIBB.
 */

/** Tipo de gasto bajo el que se suman (debe contener `VARIABLE`: ver `partCostosVariablesFijos`). */
export const TIPO_GASTO_LIBROS_BALANCE = "GASTO VARIABLE";

export const LIBROS_BALANCE_MENSUAL = {
  cxMercaderia: { gasto: "CX MERCADERÍA", rubro: "MERCADERÍA", fuente: "CX MERC. VEND." },
  cxFinanciero: { gasto: "CX FIN. COBRO", rubro: "MERCADERÍA", fuente: "CX FIN COBROS" },
  iva: { gasto: "IVA", rubro: "IMPUESTOS", fuente: "BALANCE IVA" },
  iibb: { gasto: "IIBB", rubro: "IMPUESTOS", fuente: "BALANCE IIBB" },
} as const;

export type LibroBalanceMensual = keyof typeof LIBROS_BALANCE_MENSUAL;

/** Sucursal ficticia de los movimientos sin sucursal (compras, ajustes): se reparte en partes iguales. */
export const SUCURSAL_REPARTO_LIBROS = "SIN SUCURSAL (REPARTO)";

function normalizarNombreGasto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/** Gastos del catálogo que antes se cargaban a mano y ahora reemplaza un libro (comparación sin tildes). */
const GASTOS_CATALOGO_REEMPLAZADOS = new Set(
  ["IVA", "IIBB", "MERCADERÍA", "COSTOS FIN. COBRO"].map(normalizarNombreGasto)
);

/** `true` si el gasto de catálogo (tipo variable) ya no se carga ni suma al Balance mensual. */
export function esGastoReemplazadoPorLibro(tipoGastoNombre: string, gastoNombre: string): boolean {
  return (
    normalizarNombreGasto(tipoGastoNombre).includes("VARIABLE") &&
    GASTOS_CATALOGO_REEMPLAZADOS.has(normalizarNombreGasto(gastoNombre))
  );
}

export const MENSAJE_GASTO_REEMPLAZADO_POR_LIBRO =
  "Este gasto ya no se carga a mano: el Balance mensual lo toma de su libro (Cx Merc. Vend., Cx Fin Cobros, Balance IVA o Balance IIBB).";
