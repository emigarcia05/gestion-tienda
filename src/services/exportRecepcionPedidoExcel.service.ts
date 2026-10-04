import { z } from "zod";
import { IvaProveedor, Prisma } from "@prisma/client";
import type { ServiceResult } from "@/types";
import { prisma } from "@/lib/prisma";
import { incrementarUltimoComprobanteFacturaAfip } from "@/lib/prodPedUltComprobanteIncrement";
import { getDuxIdEmpresaCompras } from "@/lib/duxComprasV2Api";
import { getIdDepositoPorSucursalCodigo } from "@/services/prodTiendaStock.service";

/** Prefijo de log uniforme. Loggear en el catch evita que los errores queden
 *  opacos detrás de "An error occurred in the Server Components render…". */
const LOG_TAG = "[exportRecepcionPedidoExcel]";

function logServiceError(scope: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${LOG_TAG}[${scope}]`, msg);
}

export const fechaFacturaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida. Formato esperado: YYYY-MM-DD");

/**
 * Valor permitido en la columna "TIPO COMPROBANTE" del Excel de recepción.
 * Se resuelve a partir de `proveedor.iva` (ver `resolverTipoComprobantePorIva`).
 */
export type TipoComprobanteRecepcion = "FACTURA" | "Comprobante_Compra";

/**
 * Marker de error semántico que devuelve el servicio cuando `proveedor.iva = PREGUNTA`
 * y no se proporcionó una decisión explícita. La UI debe abrir el modal
 * "¿La compra genera comprobante fiscal?" y reintentar con `decisionFiscal`.
 */
export const ERROR_REQUIERE_DECISION_FISCAL = "REQUIERE_DECISION_FISCAL" as const;

/**
 * Aplica la regla de negocio `proveedor.iva → tipoComprobante`:
 * - SIEMPRE  → "FACTURA" (columna Excel en mayúsculas; DUX usa `tipo_comp` FACTURA)
 * - NUNCA    → "Comprobante_Compra"
 * - PREGUNTA → depende de `decisionFiscal` (SI/NO del modal de confirmación):
 *   - true  → "FACTURA"
 *   - false → "Comprobante_Compra"
 *   - null/undefined → `null` (la UI debe pedir la decisión antes de exportar).
 */
export function resolverTipoComprobantePorIva(
  iva: IvaProveedor,
  decisionFiscal: boolean | null | undefined
): TipoComprobanteRecepcion | null {
  if (iva === IvaProveedor.SIEMPRE) return "FACTURA";
  if (iva === IvaProveedor.NUNCA) return "Comprobante_Compra";
  if (decisionFiscal === true) return "FACTURA";
  if (decisionFiscal === false) return "Comprobante_Compra";
  return null;
}

export interface RecepcionCompraProductoPreparado {
  codItem: string;
  ctd: number;
  precioUnitario: number;
}

/** Datos compartidos entre Excel de recepción y POST DUX v2/compras. */
export interface RecepcionCompraDatosPreparados {
  tipoComprobante: TipoComprobanteRecepcion;
  nroComprobante: string;
  idProveedorDux: number;
  fechaIso: string;
  fechaImputacionContableIso: string;
  idDeposito: number;
  idEmpresa: number;
  idSucursal: number;
  productos: RecepcionCompraProductoPreparado[];
  prefijoProveedor: string;
}

export interface PrepararRecepcionCompraDatosParams {
  pedidoHistoriaId: string;
  fechaFacturaIso: string;
  totalPedidoIngreso?: number;
  decisionFiscal?: boolean;
}

/** Divisor IVA 21 %: total con IVA → neto antes de repartir precios. */
export const IVA_COMPRA_DIVISOR_NETO = 1.21;

/** Decimales en `precio_unitario` / columna Excel PRECIO (reparto diferencial). */
export const PRECIO_UNITARIO_RECEPCION_DECIMALES = 4;

const PRECIO_UNITARIO_RECEPCION_FACTOR = 10 ** PRECIO_UNITARIO_RECEPCION_DECIMALES;

/**
 * Total con IVA incluido (TOTAL PEDIDO) → neto sin IVA (÷ 1,21).
 * Misma precisión que el reparto de precios ({@link PRECIO_UNITARIO_RECEPCION_DECIMALES} decimales).
 */
export function totalBrutoConIva21ANetoParaRecepcion(totalBruto: number): number {
  const unidades = Math.round(totalBruto * PRECIO_UNITARIO_RECEPCION_FACTOR);
  const netoUnidades = Math.round(unidades / IVA_COMPRA_DIVISOR_NETO);
  return netoUnidades / PRECIO_UNITARIO_RECEPCION_FACTOR;
}

const AJUSTE_MAXIMO_PRECIO_UNITARIO = 0.1; // +/- 0,10 respecto al precio base
const AJUSTE_MAXIMO_PRECIO_UNITARIO_UNITS = Math.round(
  AJUSTE_MAXIMO_PRECIO_UNITARIO * PRECIO_UNITARIO_RECEPCION_FACTOR
);
const TOLERANCIA_TOTAL_EXPORTACION = 0.1; // diferencia máxima permitida contra total ingresado

/** Correlativo **Comprobante_Compra** (sólo dígitos) en `prod_ped_ult_comp`. */
const PROD_PED_ULT_COMP_ID_COMPROBANTE_COMPRA = 1;
/** Correlativo **FACTURA** (formato AFIP `L-#####-########`) en `prod_ped_ult_comp`. */
const PROD_PED_ULT_COMP_ID_FACTURA = 2;

/**
 * Reserva el siguiente **COMPROBANTE** según el tipo de Excel (`Comprobante_Compra` vs `FACTURA`).
 * - Comprobante_Compra: `UPDATE … bigint+1 … RETURNING` (atómico).
 * - FACTURA: transacción con `SELECT … FOR UPDATE` + incremento en TS + `UPDATE`.
 */
async function reservarSiguienteComprobanteRecepcion(
  tipoExcel: TipoComprobanteRecepcion
): Promise<ServiceResult<string>> {
  if (tipoExcel === "Comprobante_Compra") {
    try {
      const rows = await prisma.$queryRaw<Array<{ ult_comprobante: string }>>(
        Prisma.sql`
          UPDATE "prod_ped_ult_comp"
          SET "ult_comprobante" = ((btrim("ult_comprobante"))::bigint + 1)::text
          WHERE "id" = ${PROD_PED_ULT_COMP_ID_COMPROBANTE_COMPRA}
          RETURNING "ult_comprobante" AS ult_comprobante
        `
      );
      const v = rows[0]?.ult_comprobante?.trim();
      if (!v) {
        return {
          success: false,
          error:
            "No se pudo obtener el correlativo Comprobante_Compra (falta fila id=1 en prod_ped_ult_comp; ejecutá migraciones).",
        };
      }
      return { success: true, data: v };
    } catch (e) {
      logServiceError("reservarSiguienteComprobanteRecepcion[Comprobante_Compra]", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (/invalid input syntax for type bigint/i.test(msg)) {
        return {
          success: false,
          error:
            "El correlativo Comprobante_Compra en prod_ped_ult_comp debe ser sólo dígitos; corregilo en base de datos.",
        };
      }
      return { success: false, error: "No se pudo asignar el correlativo de comprobante." };
    }
  }

  try {
    const next = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ ult_comprobante: string }>>(
        Prisma.sql`
          SELECT "ult_comprobante" FROM "prod_ped_ult_comp"
          WHERE "id" = ${PROD_PED_ULT_COMP_ID_FACTURA}
          FOR UPDATE
        `
      );
      const cur = locked[0]?.ult_comprobante?.trim();
      if (!cur) {
        throw new Error(
          "Falta fila id=2 (FACTURA) en prod_ped_ult_comp; ejecutá migraciones."
        );
      }
      const nuevo = incrementarUltimoComprobanteFacturaAfip(cur);
      await tx.prodPedUltComp.update({
        where: { id: PROD_PED_ULT_COMP_ID_FACTURA },
        data: { ultComprobante: nuevo },
      });
      return nuevo;
    });
    return { success: true, data: next };
  } catch (e) {
    logServiceError("reservarSiguienteComprobanteRecepcion[FACTURA]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/no soportada|se esperaba/i.test(msg)) {
      return { success: false, error: msg };
    }
    return { success: false, error: "No se pudo asignar el correlativo de factura." };
  }
}

function toPrecioUnits(value: number): number {
  return Math.round(value * PRECIO_UNITARIO_RECEPCION_FACTOR);
}

function fromPrecioUnits(units: number): number {
  return units / PRECIO_UNITARIO_RECEPCION_FACTOR;
}

function distribuirPreciosDiferenciales(params: {
  cantidades: number[];
  totalObjetivo: number;
}): { precios: number[]; totalCalculado: number; diferencia: number } {
  const { cantidades, totalObjetivo } = params;
  const sumaCantidades = cantidades.reduce((acc, c) => acc + c, 0);
  const totalObjetivoUnits = toPrecioUnits(totalObjetivo);
  const precioBaseUnits =
    sumaCantidades !== 0 ? Math.round(totalObjetivoUnits / sumaCantidades) : 0;

  const preciosUnits = cantidades.map(() => precioBaseUnits);
  const deltas = cantidades.map(() => 0);
  let diffUnits =
    totalObjetivoUnits -
    cantidades.reduce((acc, cant) => acc + cant * precioBaseUnits, 0);

  // Ajuste fino: pasos de 10^-4 por ítem respetando tope +/-0,10.
  const indicesPorCantidadDesc = cantidades
    .map((cant, idx) => ({ idx, cant }))
    .sort((a, b) => b.cant - a.cant)
    .map((x) => x.idx);
  const indicesPorCantidadAsc = [...indicesPorCantidadDesc].reverse();

  const aplicarPaso = (idx: number, paso: 1 | -1): boolean => {
    if (paso > 0 && deltas[idx] >= AJUSTE_MAXIMO_PRECIO_UNITARIO_UNITS) return false;
    if (paso < 0 && deltas[idx] <= -AJUSTE_MAXIMO_PRECIO_UNITARIO_UNITS) return false;
    deltas[idx] += paso;
    preciosUnits[idx] += paso;
    diffUnits -= cantidades[idx] * paso;
    return true;
  };

  const intentosMaximos = cantidades.length * AJUSTE_MAXIMO_PRECIO_UNITARIO_UNITS * 4;
  let intentos = 0;
  while (diffUnits !== 0 && intentos < intentosMaximos) {
    intentos += 1;
    const signo: 1 | -1 = diffUnits > 0 ? 1 : -1;
    const candidatos = signo > 0 ? indicesPorCantidadDesc : indicesPorCantidadAsc;
    let mejorIdx = -1;
    let mejorError = Number.POSITIVE_INFINITY;

    for (const idx of candidatos) {
      const deltaActual = deltas[idx];
      if (
        (signo > 0 && deltaActual >= AJUSTE_MAXIMO_PRECIO_UNITARIO_UNITS) ||
        (signo < 0 && deltaActual <= -AJUSTE_MAXIMO_PRECIO_UNITARIO_UNITS)
      ) {
        continue;
      }
      const nuevoDiff = diffUnits - cantidades[idx] * signo;
      const errorAbs = Math.abs(nuevoDiff);
      if (errorAbs < mejorError) {
        mejorError = errorAbs;
        mejorIdx = idx;
        if (errorAbs === 0) break;
      }
    }

    if (mejorIdx === -1) break;
    const aplicado = aplicarPaso(mejorIdx, signo);
    if (!aplicado) break;
  }

  const precios = preciosUnits.map((u) =>
    Number(fromPrecioUnits(u).toFixed(PRECIO_UNITARIO_RECEPCION_DECIMALES))
  );
  const totalCalculado = cantidades.reduce((acc, cant, idx) => acc + cant * precios[idx], 0);
  const diferencia = Number(
    (totalObjetivo - totalCalculado).toFixed(PRECIO_UNITARIO_RECEPCION_DECIMALES)
  );

  return {
    precios,
    totalCalculado: Number(totalCalculado.toFixed(PRECIO_UNITARIO_RECEPCION_DECIMALES)),
    diferencia,
  };
}

export async function prepararRecepcionCompraDatos(
  params: PrepararRecepcionCompraDatosParams
): Promise<ServiceResult<RecepcionCompraDatosPreparados>> {
  const { pedidoHistoriaId, fechaFacturaIso, totalPedidoIngreso, decisionFiscal } = params;

  const fechaParsed = fechaFacturaIsoSchema.safeParse(fechaFacturaIso);
  if (!fechaParsed.success) {
    return { success: false, error: "Fecha de factura inválida." };
  }

  try {
    const pedido = await prisma.pedidoHistoria.findUnique({
      where: { id: pedidoHistoriaId },
      select: {
        total: true,
        proveedor: { select: { idProveedorDux: true, prefijo: true, iva: true } },
        sucursal: {
          select: {
            codigo: true,
            idDux: true,
          },
        },
        items: { select: { codTienda: true, cantRecibida: true } },
      },
    });

    if (!pedido) return { success: false, error: "Pedido no encontrado." };

    if (!pedido.proveedor || !pedido.sucursal) {
      logServiceError(
        "prepararRecepcionCompraDatos",
        `relaciones incompletas: proveedor=${!!pedido.proveedor} sucursal=${!!pedido.sucursal} pedidoId=${pedidoHistoriaId}`
      );
      return {
        success: false,
        error: "El pedido tiene datos incompletos (proveedor/sucursal).",
      };
    }

    const idProveedorRaw = (pedido.proveedor.idProveedorDux ?? "").trim();
    const idProveedorDux = Number(idProveedorRaw);
    if (!idProveedorRaw || !Number.isFinite(idProveedorDux) || idProveedorDux <= 0) {
      return {
        success: false,
        error: "El proveedor no tiene un ID DUX válido para registrar la compra.",
      };
    }

    const idSucursalRaw = (pedido.sucursal.idDux ?? "").trim();
    const idSucursal = Number(idSucursalRaw);
    if (!idSucursalRaw || !Number.isFinite(idSucursal) || idSucursal <= 0) {
      return {
        success: false,
        error: "La sucursal no tiene un ID DUX válido para registrar la compra.",
      };
    }

    const tipoComprobante = resolverTipoComprobantePorIva(
      pedido.proveedor.iva,
      decisionFiscal
    );
    if (tipoComprobante === null) {
      return { success: false, error: ERROR_REQUIERE_DECISION_FISCAL };
    }

    const itemsRecibidos = pedido.items
      .map((it) => ({
        codTienda: it.codTienda,
        cantRecibida: Number(it.cantRecibida ?? 0),
      }))
      .filter((it) => Number.isFinite(it.cantRecibida) && it.cantRecibida !== 0);

    if (itemsRecibidos.length === 0) {
      return {
        success: false,
        error: "El pedido no tiene ítems con cantidad recibida distinta de cero.",
      };
    }

    const fechaIso = fechaParsed.data;
    const fechaImputacionContableIso = fechaParsed.data;

    const totalPersistido = pedido.total == null ? null : Number(pedido.total);
    const totalParaPrecio =
      totalPedidoIngreso != null && Number.isFinite(totalPedidoIngreso) && totalPedidoIngreso !== 0
        ? totalPedidoIngreso
        : totalPersistido != null && Number.isFinite(totalPersistido) && totalPersistido !== 0
          ? totalPersistido
          : null;

    if (totalParaPrecio == null) {
      return {
        success: false,
        error:
          "Falta un total válido para calcular precios (ingresá TOTAL PEDIDO o registrá la recepción con total).",
      };
    }

    const cantidades = itemsRecibidos.map((it) => it.cantRecibida);
    const sumaCantidades = cantidades.reduce((acc, c) => acc + c, 0);
    if (sumaCantidades === 0) {
      return {
        success: false,
        error: "La suma de cantidades recibidas no puede ser cero.",
      };
    }
    const totalNetoDistribucion = totalBrutoConIva21ANetoParaRecepcion(totalParaPrecio);
    const { precios, diferencia } = distribuirPreciosDiferenciales({
      cantidades,
      totalObjetivo: totalNetoDistribucion,
    });
    if (Math.abs(diferencia) > TOLERANCIA_TOTAL_EXPORTACION) {
      return {
        success: false,
        error:
          "No se pudo ajustar el total dentro de la tolerancia permitida (0,10).",
      };
    }

    const compRes = await reservarSiguienteComprobanteRecepcion(tipoComprobante);
    if (!compRes.success) return compRes;

    const idDeposito = getIdDepositoPorSucursalCodigo(pedido.sucursal.codigo);
    const idEmpresa = getDuxIdEmpresaCompras();

    return {
      success: true,
      data: {
        tipoComprobante,
        nroComprobante: compRes.data,
        idProveedorDux,
        fechaIso,
        fechaImputacionContableIso,
        idDeposito,
        idEmpresa,
        idSucursal,
        productos: itemsRecibidos.map((it, index) => ({
          codItem: it.codTienda,
          ctd: it.cantRecibida,
          precioUnitario: precios[index],
        })),
        prefijoProveedor: (pedido.proveedor.prefijo ?? "").trim() || "SIN_PREFIJO",
      },
    };
  } catch (e) {
    logServiceError("prepararRecepcionCompraDatos", e);
    const msg = e instanceof Error ? e.message : "Error al preparar los datos de recepción.";
    return { success: false, error: msg };
  }
}
