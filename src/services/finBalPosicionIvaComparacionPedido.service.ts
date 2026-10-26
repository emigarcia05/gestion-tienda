/**
 * Configuración del saldo IVA usado al comparar proveedores en pedidos (urgente / reposición).
 * Calculado = saldo acumulado de Balance IVA (`bal_iva`); el valor configurado lo reemplaza.
 */

import { prisma } from "@/lib/prisma";
import {
  modoComparacionCostoDesdeSaldo,
  type ModoComparacionCostoIva,
} from "@/lib/precioComparacionPedidoUrgenteReposicion";
import { calcularSaldoAcumuladoBalIva } from "@/services/balIva.service";

export { modoComparacionCostoDesdeSaldo, type ModoComparacionCostoIva };

export const COMPARACION_PEDIDO_IVA_ID = "comparacion_pedido";

export interface EstadoIvaComparacionPedido {
  usarValorConfigurado: boolean;
  saldoPesosConfigurado: number;
  saldoAcumuladoCalculado: number;
  /** Valor que usa `pxComparablePedidoUrgenteReposicion` (>0 sin IVA; ≤0 con IVA). */
  saldoEfectivoComparacion: number;
  updatedAt: Date | null;
}

async function ensureConfigRow() {
  const existing = await prisma.finBalPosicionIvaComparacionPedido.findUnique({
    where: { id: COMPARACION_PEDIDO_IVA_ID },
  });
  if (existing) return existing;

  return prisma.finBalPosicionIvaComparacionPedido.create({
    data: {
      id: COMPARACION_PEDIDO_IVA_ID,
      usarValorConfigurado: false,
      saldoPesos: 0,
    },
  });
}

function mapEstado(
  row: { usarValorConfigurado: boolean; saldoPesos: unknown; updatedAt: Date },
  saldoAcumuladoCalculado: number
): EstadoIvaComparacionPedido {
  const saldoPesosConfigurado = Math.round(Number(row.saldoPesos));
  const saldoEfectivoComparacion = row.usarValorConfigurado
    ? saldoPesosConfigurado
    : saldoAcumuladoCalculado;
  return {
    usarValorConfigurado: row.usarValorConfigurado,
    saldoPesosConfigurado,
    saldoAcumuladoCalculado,
    saldoEfectivoComparacion,
    updatedAt: row.updatedAt,
  };
}

export async function getEstadoIvaComparacionPedido(): Promise<EstadoIvaComparacionPedido> {
  const [row, saldoAcumuladoCalculado] = await Promise.all([
    ensureConfigRow(),
    calcularSaldoAcumuladoBalIva(),
  ]);
  return mapEstado(row, saldoAcumuladoCalculado);
}

export async function guardarIvaComparacionPedido(params: {
  usarValorConfigurado: boolean;
  saldoPesos: number;
}): Promise<EstadoIvaComparacionPedido> {
  const saldoPesos = Math.round(params.saldoPesos);
  const row = await prisma.finBalPosicionIvaComparacionPedido.upsert({
    where: { id: COMPARACION_PEDIDO_IVA_ID },
    create: {
      id: COMPARACION_PEDIDO_IVA_ID,
      usarValorConfigurado: params.usarValorConfigurado,
      saldoPesos,
    },
    update: {
      usarValorConfigurado: params.usarValorConfigurado,
      saldoPesos,
    },
  });
  const saldoAcumuladoCalculado = await calcularSaldoAcumuladoBalIva();
  return mapEstado(row, saldoAcumuladoCalculado);
}

/** Saldo efectivo para ranking de proveedores en pedidos. */
export async function obtenerSaldoIvaParaComparacionProveedoresPedido(): Promise<number> {
  const { saldoEfectivoComparacion } = await getEstadoIvaComparacionPedido();
  return saldoEfectivoComparacion;
}

/** Alias histórico usado en pedidos y revision token. */
export async function sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido(): Promise<number> {
  return obtenerSaldoIvaParaComparacionProveedoresPedido();
}
