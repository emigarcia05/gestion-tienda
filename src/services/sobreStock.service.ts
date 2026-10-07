import { prisma } from "@/lib/prisma";
import type { ItemPedidoEnvioRowParaEnviar, SucursalPedidoEnvio } from "@/services/pedidosEnvio.service";
import {
  cargarListaPrecioReposicionPorCodTiendas,
  elegirListaPrecioProveedorReposicion,
  sumarIvaSaldoParaReposicion,
} from "@/services/pedidosReposicionProveedor.service";
import {
  buildMapStockPorDeposito,
  buildMapStockeable,
  getIdDepositoPorSucursalCodigo,
  getStockeableFromMap,
} from "@/services/prodTiendaStock.service";

export type OrigenDeteccionSobrestock = "LOCAL" | "OTRA_SUCURSAL";

export interface SobreStockReposicionItem {
  idItemPedidoEnvio: string;
  codExt: string;
  codTienda: string | null;
  descripcionProveedor: string;
  descripcionTienda: string | null;
  /** Stock en la sucursal `sucursalCodigoSobrestock` (desde `prod_propios`). */
  stockSucursal: number;
  /** Tope de reposición en esa sucursal; `null` si no hay configuración (> 0) en la fila analizada. */
  topeReposicion: number | null;
  sobreStock: number;
  /** Cantidad a pedir en la sucursal que genera el pedido (fila `prod_ped_merc`). */
  cantPedir: number;
  /** Sucursal donde se midió el excedente (en este flujo siempre la otra tienda). */
  sucursalCodigoSobrestock: SucursalPedidoEnvio;
  /** En el flujo actual de generar pedido: siempre `OTRA_SUCURSAL`. */
  origenDeteccion: OrigenDeteccionSobrestock;
}

export interface SobreStockReposicionResult {
  items: SobreStockReposicionItem[];
  tieneSobreStock: boolean;
}

function normCodTienda(c: string): string {
  return (c ?? "").trim();
}

function otraSucursalPedido(s: SucursalPedidoEnvio): SucursalPedidoEnvio {
  return s === "maipu" ? "guaymallen" : "maipu";
}

function evaluarSobrestockEnValores(
  stockSucursal: number,
  reposicionCantConf: number | null | undefined
): { sobreStock: number; topeReposicion: number | null } | null {
  const topeRaw = reposicionCantConf;
  const topeReposicionNum =
    topeRaw != null && Number.isFinite(Number(topeRaw)) ? Number(topeRaw) : 0;
  if (!Number.isFinite(stockSucursal)) return null;

  const tieneConfigReposicion = topeReposicionNum > 0;

  if (tieneConfigReposicion) {
    if (stockSucursal <= topeReposicionNum) return null;
    return {
      sobreStock: stockSucursal - topeReposicionNum,
      topeReposicion: topeReposicionNum,
    };
  }
  if (stockSucursal <= 0) return null;
  return { sobreStock: stockSucursal, topeReposicion: null };
}

/**
 * Para cada línea del pedido a generar que tenga **`cod_tienda`**, resuelve el producto en
 * `prod_propios` por ese código y evalúa si en la **otra sucursal** hay sobrestock
 * (mismas reglas de tope REPOSICIÓN que en reposición).
 *
 * No evalúa la sucursal que genera el pedido; no incluye líneas sin `cod_tienda`.
 */
export async function getSobreStockOtraSucursalParaPedidoEnviar(params: {
  proveedorId: string;
  sucursal: SucursalPedidoEnvio;
  filas: ItemPedidoEnvioRowParaEnviar[];
}): Promise<SobreStockReposicionResult> {
  const proveedorPedido = params.proveedorId.trim();
  const filasConTienda = params.filas.filter(
    (f) => (f.codTienda ?? "").trim() !== ""
  );
  if (filasConTienda.length === 0) {
    return { items: [], tieneSobreStock: false };
  }

  const otraCodigo = otraSucursalPedido(params.sucursal);
  const otraSucursalRow = await prisma.sucursal.findUnique({
    where: { codigo: otraCodigo },
    select: { id: true },
  });

  if (!otraSucursalRow) {
    return { items: [], tieneSobreStock: false };
  }

  const codTiendas = [
    ...new Set(filasConTienda.map((f) => f.codTienda!.trim())),
  ];

  const tiendas = await prisma.prodPropio.findMany({
    where: { codTienda: { in: codTiendas } },
    select: {
      codTienda: true,
      descripcionTienda: true,
    },
  });

  const tiendaPorCodTienda = new Map<string, (typeof tiendas)[number]>();
  for (const t of tiendas) {
    const ct = (t.codTienda ?? "").trim();
    if (ct && !tiendaPorCodTienda.has(ct)) tiendaPorCodTienda.set(ct, t);
  }

  const [ivaSaldoReposicion, lpPorCodTiendaOtra, stockOtraMap, stockeableMap] =
    await Promise.all([
    sumarIvaSaldoParaReposicion(),
    cargarListaPrecioReposicionPorCodTiendas(codTiendas),
    buildMapStockPorDeposito(codTiendas, getIdDepositoPorSucursalCodigo(otraCodigo)),
    buildMapStockeable(codTiendas),
  ]);
  const otherMerc2 = await prisma.prodPedMerc2.findMany({
    where: {
      sucursalId: otraSucursalRow.id,
      tipoDePedido: "REPOSICION",
      reposicionCodTienda: { in: codTiendas },
    },
    select: {
      reposicionCodTienda: true,
      reposicionCantConf: true,
    },
  });

  const otherListByCodTienda = new Map<
    string,
    { idProveedor: string; reposicionCantConf: number | null }[]
  >();

  function appendOtra(codTienda: string, prov: string, conf: number | null) {
    const k = (codTienda ?? "").trim();
    if (!k) return;
    const list = otherListByCodTienda.get(k) ?? [];
    const p = prov.trim();
    if (!list.some((x) => x.idProveedor === p)) {
      list.push({ idProveedor: p, reposicionCantConf: conf });
      otherListByCodTienda.set(k, list);
    }
  }

  for (const r of otherMerc2) {
    const codT = (r.reposicionCodTienda ?? "").trim();
    if (!codT) continue;
    const tienda = tiendaPorCodTienda.get(codT);
    if (!tienda) continue;
    const provRow = elegirListaPrecioProveedorReposicion({
      codTienda: codT,
      lpPorCodTienda: lpPorCodTiendaOtra,
      ivaSaldoAcumulado: ivaSaldoReposicion,
    });
    if (!provRow) continue;
    appendOtra(codT, provRow.idProveedor, r.reposicionCantConf);
  }

  function resolverTopeOtraSucursal(
    codTienda: string,
    reposicionCantPedido: number | null | undefined
  ): number | null | undefined {
    const k = (codTienda ?? "").trim();
    const list = otherListByCodTienda.get(k);
    if (list && list.length > 0) {
      const mismoProv = list.find((x) => x.idProveedor === proveedorPedido);
      if (mismoProv) return mismoProv.reposicionCantConf;
      const conTope = list.find((x) => Number(x.reposicionCantConf ?? 0) > 0);
      if (conTope) return conTope.reposicionCantConf;
      return list[0]!.reposicionCantConf;
    }
    return reposicionCantPedido;
  }

  const items: SobreStockReposicionItem[] = [];

  for (const fila of filasConTienda) {
    const codTienda = fila.codTienda!.trim();
    const tienda = tiendaPorCodTienda.get(codTienda);
    if (!tienda) continue;
    if (!getStockeableFromMap(stockeableMap, codTienda)) continue;

    const cx = normCodTienda(codTienda);

    const topePedidoRow =
      fila.tipoPedido === "REPOSICION" ? fila.reposicionCantConf : null;
    const listOtra = otherListByCodTienda.get(codTienda);
    const debeEvaluarOtra =
      (listOtra?.length ?? 0) > 0 || Number(topePedidoRow ?? 0) > 0;

    if (!debeEvaluarOtra) continue;

    const stockOtra = stockOtraMap.get(codTienda) ?? 0;
    const topeParaOtra = resolverTopeOtraSucursal(codTienda, topePedidoRow);
    const ext = evaluarSobrestockEnValores(stockOtra, topeParaOtra);
    if (!ext) continue;

    items.push({
      idItemPedidoEnvio: fila.id,
      codExt: cx,
      codTienda: fila.codTienda?.trim() ?? null,
      descripcionProveedor: (fila.descripcionProveedor ?? "").trim(),
      descripcionTienda: fila.descripcionTienda ?? null,
      cantPedir: Number(fila.cantPedir ?? 0),
      stockSucursal: stockOtra,
      topeReposicion: ext.topeReposicion,
      sobreStock: ext.sobreStock,
      sucursalCodigoSobrestock: otraCodigo,
      origenDeteccion: "OTRA_SUCURSAL",
    });
  }

  return { items, tieneSobreStock: items.length > 0 };
}
