/**
 * Resolución de proveedor para pedido REPOSICIÓN por `cod_tienda` (vínculos manuales en
 * `prod_precios_provee.cod_tienda`) y menor costo comparable según Posición IVA.
 *
 * Desde 2026-05-28 se eliminó el fallback legacy por `cod_ext` (cuando el sync DUX
 * todavía poblaba `prod_precios_tienda.cod_ext`). La única fuente de verdad es el vínculo
 * manual desde **Vínculos Con Proveedores**.
 */

import { IvaProveedor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ordenarMiembrosPedidoUrgentePorMenorCostoComparable,
  type MiembroPrecioComparablePedidoUrgente,
} from "@/lib/precioComparacionPedidoUrgenteReposicion";
import { sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido } from "@/services/finBalPosicionIvaSaldoAcumuladoPedido.service";
import type { LpRowPick } from "@/services/pedidosEnvio.service";

export type LpRowReposicionResuelto = LpRowPick & {
  codExt: string;
  pxCompraFinalSinIva: number | null;
  ivaProveedor: IvaProveedor;
};

const selectListaPrecioReposicion = {
  codExt: true,
  idProveedor: true,
  codProdProveedor: true,
  descripcionProveedor: true,
  codTiendaVinculo: true,
  pxCompraFinalSinIva: true,
  proveedor: { select: { prefijo: true, nombre: true, iva: true } },
} as const;

type FilaLpReposicion = {
  codExt: string;
  idProveedor: string;
  codProdProveedor: string | null;
  descripcionProveedor: string;
  codTiendaVinculo: string | null;
  pxCompraFinalSinIva: unknown;
  proveedor: { prefijo: string | null; nombre: string | null; iva: IvaProveedor };
};

function filaLpToResuelto(f: FilaLpReposicion): LpRowReposicionResuelto {
  const px =
    f.pxCompraFinalSinIva != null && Number.isFinite(Number(f.pxCompraFinalSinIva))
      ? Number(f.pxCompraFinalSinIva)
      : null;
  return {
    codExt: f.codExt,
    idProveedor: f.idProveedor,
    codProdProveedor: f.codProdProveedor,
    descripcionProveedor: f.descripcionProveedor,
    codTiendaVinculo: f.codTiendaVinculo,
    proveedor: { prefijo: f.proveedor.prefijo, nombre: f.proveedor.nombre },
    pxCompraFinalSinIva: px,
    ivaProveedor: f.proveedor.iva,
  };
}

export function proveedorEtiquetaPedidoDesdeRow(p: {
  prefijo: string | null;
  nombre: string | null;
}): string {
  const pref = (p.prefijo ?? "").trim();
  const nom = (p.nombre ?? "").trim();
  return pref.length > 0 ? `[${pref}] ${nom}`.trim().toUpperCase() : nom.toUpperCase();
}

/** Agrupa filas habilitadas por `cod_tienda` de vínculo. */
export function mapaListaPrecioPorCodTiendaVinculo(
  filas: LpRowReposicionResuelto[]
): Map<string, LpRowReposicionResuelto[]> {
  const map = new Map<string, LpRowReposicionResuelto[]>();
  for (const f of filas) {
    const ct = (f.codTiendaVinculo ?? "").trim();
    if (!ct) continue;
    const arr = map.get(ct) ?? [];
    arr.push(f);
    map.set(ct, arr);
  }
  return map;
}

export async function cargarListaPrecioReposicionPorCodTiendas(
  codTiendas: string[]
): Promise<Map<string, LpRowReposicionResuelto[]>> {
  const keys = [...new Set(codTiendas.map((c) => c.trim()).filter(Boolean))];
  if (keys.length === 0) return new Map();

  const filas = await prisma.listaPrecioProveedor.findMany({
    where: {
      codTiendaVinculo: { in: keys },
      habilitado: true,
      proveedor: { esFabrica: false },
    },
    select: selectListaPrecioReposicion,
    orderBy: [{ codTiendaVinculo: "asc" }, { idProveedor: "asc" }],
  });

  return mapaListaPrecioPorCodTiendaVinculo(filas.map(filaLpToResuelto));
}

/**
 * Elige la fila de lista proveedor para un `cod_tienda`: requiere al menos un vínculo
 * manual habilitado en `prod_precios_provee.cod_tienda`; entre todos los vínculos, gana
 * el menor costo comparable según Posición IVA. Sin vínculos manuales, devuelve `null`.
 */
export function elegirListaPrecioProveedorReposicion(params: {
  codTienda: string;
  lpPorCodTienda: Map<string, LpRowReposicionResuelto[]>;
  ivaSaldoAcumulado: number;
}): LpRowReposicionResuelto | null {
  const ct = params.codTienda.trim();
  const vinculados = params.lpPorCodTienda.get(ct) ?? [];
  if (vinculados.length === 0) return null;

  const miembros: (MiembroPrecioComparablePedidoUrgente & LpRowReposicionResuelto)[] =
    vinculados.map((v) => ({
      ...v,
      pxCompraFinalSinIva: v.pxCompraFinalSinIva,
      ivaProveedor: v.ivaProveedor ?? IvaProveedor.PREGUNTA,
      prefijo: v.proveedor.prefijo ?? "",
      codExt: v.codExt,
    }));
  const ordenados = ordenarMiembrosPedidoUrgentePorMenorCostoComparable(
    miembros,
    params.ivaSaldoAcumulado
  );
  return ordenados[0] ?? null;
}

/** Fila de lista proveedor habilitada para un `cod_tienda` y proveedor concreto (sin comparar precios). */
export function resolverListaPrecioReposicionParaProveedor(params: {
  codTienda: string;
  proveedorId: string;
  lpPorCodTienda: Map<string, LpRowReposicionResuelto[]>;
}): LpRowReposicionResuelto | null {
  const ct = params.codTienda.trim();
  const pid = params.proveedorId.trim();
  if (!ct || !pid) return null;
  const vinculados = params.lpPorCodTienda.get(ct) ?? [];
  return vinculados.find((v) => v.idProveedor === pid) ?? null;
}

export async function sumarIvaSaldoParaReposicion(): Promise<number> {
  return sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido();
}

export type ProveedorFiltroReposicion = {
  id: string;
  nombre: string;
  prefijo: string;
};

/**
 * Catálogo del filtro PROVEEDOR en Reposición: mercadería, no fábrica,
 * con al menos un vínculo habilitado a `prod_tienda`.
 */
export async function listarProveedoresFiltroReposicion(): Promise<
  ProveedorFiltroReposicion[]
> {
  const rows = await prisma.proveedor.findMany({
    where: {
      proveedorMercaderia: true,
      esFabrica: false,
      listaPrecios: {
        some: {
          habilitado: true,
          codTiendaVinculo: { not: null },
        },
      },
    },
    select: { id: true, nombre: true, prefijo: true },
    orderBy: [{ prefijo: "asc" }, { nombre: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    prefijo: p.prefijo ?? "",
  }));
}

/** Verifica que exista al menos una línea de lista proveedor habilitada vinculada al `cod_tienda`. */
export async function existeListaPrecioParaReposicionCodTienda(
  codTienda: string
): Promise<boolean> {
  const ct = codTienda.trim();
  if (!ct) return false;

  const vinculo = await prisma.listaPrecioProveedor.findFirst({
    where: {
      codTiendaVinculo: ct,
      habilitado: true,
      proveedor: { esFabrica: false },
    },
    select: { codExt: true },
  });
  return vinculo != null;
}
