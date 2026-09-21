/**
 * Pedido A Fáb. — productos de lista del proveedor fábrica + métricas por sucursal.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, skipForPagina, totalPaginasFromTotal } from "@/lib/pagination";
import {
  calcularPromVtaDiariaDesdeTotal,
  periodosUltimosDosMesesCompletos,
} from "@/lib/pedidoAFabricaPromVta";
import {
  buildMapStockPorDeposito,
} from "@/services/prodTiendaStock.service";
import { bultoProdTiendaValido } from "@/services/tiendaBultos.service";
import { buildMapCantAPedirAFabricaPorProveedor } from "@/services/pedidosEnvio.service";
import type { ReposicionFormaPedidoFabrica } from "@/lib/validations/reposicion";

export type SucursalPedidoAFabrica = {
  id: string;
  codigo: string;
  nombre: string;
  /** `sucursales.id_deposito`. `null` = sin depósito (no entra en STOCK / UN. ACT.). */
  idDeposito: number | null;
};

export type DatosSucursalProductoPedidoAFabrica = {
  /** `stock_real` de `prod_tienda_stock` del depósito (`id_deposito`); `null` sin vínculo o sin depósito. */
  stockActual: number | null;
  /**
   * Promedio diario de venta (1 decimal): suma `est_por_prod` de los 2 meses previos / 48
   * (24 días × 2). `null` sin vínculo tienda.
   */
  promVta: number | null;
};

export type ProductoPedidoAFabricaItem = {
  codExt: string;
  /**
   * Vinculado (`prod_precios_provee.cod_tienda` → `prod_tienda`): `descripcion_tienda`.
   * Sin vínculo: `descripcion_proveedor`.
   */
  descripcion: string;
  /** `prod_precios_provee.cod_tienda` si hay fila en `prod_tienda`; si no, `null`. */
  codTienda: string | null;
  /**
   * Vinculado: unidades de `prod_tienda.bulto` (`null` = sin configurar).
   * Sin vínculo: siempre `null` (celda vacía).
   */
  bulto: number | null;
  /** Clave = `sucursal.id`. */
  porSucursal: Record<string, DatosSucursalProductoPedidoAFabrica>;
};

export type FiltrosProductosPedidoAFabrica = {
  marca?: string;
  rubro?: string;
  subRubro?: string;
  q?: string;
  pagina?: number;
  /** `si` = hay `prod_tienda`; `no` = sin vínculo; omitido = todos. */
  prodVinculado?: "si" | "no";
  /** `si` = CANT. PED. persistida > 0; `no` = sin cantidad o 0; omitido = todos. */
  pedido?: "si" | "no";
};

export type ProductosPedidoAFabricaResult = {
  sucursales: SucursalPedidoAFabrica[];
  productos: ProductoPedidoAFabricaItem[];
  total: number;
  totalPaginas: number;
  /** Opciones dinámicas (prod_tienda vía vínculo del proveedor). */
  marcas: string[];
  rubros: string[];
  subRubros: string[];
  /** Cantidades `A FÁBRICA` persistidas en `prod_ped_merc` (`cod_ext` → cant). */
  cantAPedirByCodExt: Record<string, number>;
  /** Forma pedir de filas A FÁBRICA (`POR_BULTO` | `UNIDADES_FIJAS`). */
  formaPedirByCodExt: Record<string, ReposicionFormaPedidoFabrica>;
};

const VACIO: ProductosPedidoAFabricaResult = {
  sucursales: [],
  productos: [],
  total: 0,
  totalPaginas: 0,
  marcas: [],
  rubros: [],
  subRubros: [],
  cantAPedirByCodExt: {},
  formaPedirByCodExt: {},
};

type CampoFiltroTienda = "marca" | "rubro" | "subRubro";

/** Sucursales con `genera_est = true` (PROM. VTA. / modal). STOCK usa las que tienen `id_deposito`. */
export async function listarSucursalesParaPedidoAFabrica(): Promise<
  SucursalPedidoAFabrica[]
> {
  const rows = await prisma.sucursal.findMany({
    where: { generaEst: true },
    select: { id: true, codigo: true, nombre: true, idDeposito: true },
    orderBy: { nombre: "asc" },
  });
  return rows;
}

function emptyPorSucursal(
  sucursales: SucursalPedidoAFabrica[]
): Record<string, DatosSucursalProductoPedidoAFabrica> {
  const out: Record<string, DatosSucursalProductoPedidoAFabrica> = {};
  for (const s of sucursales) {
    out[s.id] = { stockActual: null, promVta: null };
  }
  return out;
}

/**
 * PROM. VTA. diario por (`cod_tienda`, `sucursal_id`):
 * suma de ventas de los 2 meses calendario previos / 48, 1 decimal.
 */
async function buildMapPromVtaDiaria(
  codTiendas: string[],
  sucursalIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codTiendas.length === 0 || sucursalIds.length === 0) return map;

  const { anterior, reciente } = periodosUltimosDosMesesCompletos();
  const rows = await prisma.estPorProd.findMany({
    where: {
      codTienda: { in: codTiendas },
      sucursalId: { in: sucursalIds },
      OR: [
        { anio: anterior.anio, mes: anterior.mes },
        { anio: reciente.anio, mes: reciente.mes },
      ],
    },
    select: { codTienda: true, sucursalId: true, vtasEnUn: true },
  });

  const sumas = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.codTienda}\0${r.sucursalId}`;
    sumas.set(key, (sumas.get(key) ?? 0) + Number(r.vtasEnUn));
  }
  for (const [key, total] of sumas) {
    map.set(key, calcularPromVtaDiariaDesdeTotal(total));
  }
  return map;
}

/** Búsqueda por descripción tienda (vínculo) o descripción proveedor. */
function filtroTextoDescripcion(
  q: string
): Prisma.ListaPrecioProveedorWhereInput | undefined {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;
  return {
    AND: tokens.map((token) => ({
      OR: [
        {
          descripcionProveedor: {
            contains: token,
            mode: "insensitive" as const,
          },
        },
        {
          prodTienda: {
            is: {
              descripcionTienda: {
                contains: token,
                mode: "insensitive" as const,
              },
            },
          },
        },
      ],
    })),
  };
}

function buildWhereLista(
  proveedorId: string,
  filtros: FiltrosProductosPedidoAFabrica,
  exclude?: CampoFiltroTienda,
  /** `cod_ext` con CANT. PED. persistida > 0 (solo si hay filtro **PEDIDO**). */
  pedidoCodExts?: string[]
): Prisma.ListaPrecioProveedorWhereInput {
  const parts: Prisma.ListaPrecioProveedorWhereInput[] = [
    { idProveedor: proveedorId, habilitado: true },
  ];

  const tiendaAnd: Prisma.ProdTiendaWhereInput[] = [];
  const marca = filtros.marca?.trim() ?? "";
  const rubro = filtros.rubro?.trim() ?? "";
  const subRubro = filtros.subRubro?.trim() ?? "";
  if (exclude !== "marca" && marca) tiendaAnd.push({ marca });
  if (exclude !== "rubro" && rubro) tiendaAnd.push({ rubro });
  if (exclude !== "subRubro" && subRubro) tiendaAnd.push({ subRubro });
  if (tiendaAnd.length > 0) {
    parts.push({ prodTienda: { is: { AND: tiendaAnd } } });
  }

  const texto = filtroTextoDescripcion(filtros.q ?? "");
  if (texto) parts.push(texto);

  if (filtros.prodVinculado === "si") {
    parts.push({ prodTienda: { isNot: null } });
  } else if (filtros.prodVinculado === "no") {
    parts.push({ prodTienda: { is: null } });
  }

  if (filtros.pedido === "si") {
    parts.push({ codExt: { in: pedidoCodExts ?? [] } });
  } else if (filtros.pedido === "no") {
    parts.push({ codExt: { notIn: pedidoCodExts ?? [] } });
  }

  return parts.length === 1 ? parts[0]! : { AND: parts };
}

async function opcionesCampoTienda(
  whereLista: Prisma.ListaPrecioProveedorWhereInput,
  campo: CampoFiltroTienda
): Promise<string[]> {
  const rows = await prisma.listaPrecioProveedor.findMany({
    where: {
      AND: [
        whereLista,
        { codTiendaVinculo: { not: null } },
        { prodTienda: { is: { [campo]: { not: null } } } },
      ],
    },
    select: {
      prodTienda: { select: { marca: true, rubro: true, subRubro: true } },
    },
  });
  const set = new Set<string>();
  for (const r of rows) {
    const v = r.prodTienda?.[campo]?.trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Lista productos de `prod_precios_provee` del proveedor, solo si `es_fabrica = true`.
 * Vínculo con tienda: `prod_precios_provee.cod_tienda` → `prod_tienda.cod_tienda`.
 * Descripción: vinculada → `descripcion_tienda`; si no → `descripcion_proveedor`.
 * BULTO: vinculado → `prod_tienda.bulto`; si no → vacío.
 * Solo filas `habilitado = true`. Filtros opcionales: marca / rubro / sub_rubro (tienda) + q + **PROD. VINCULADO** + **PEDIDO** (CANT. PED. persistida > 0).
 * Por cada sucursal `genera_est`: **PROM. VTA.** STOCK / UN. ACT. solo si `id_deposito` ≠ null
 * (`prod_tienda_stock.stock_real` de ese depósito).
 */
export async function listarProductosPorProveedorFabrica(
  proveedorId: string,
  filtros: FiltrosProductosPedidoAFabrica = {}
): Promise<ProductosPedidoAFabricaResult> {
  const proveedor = await prisma.proveedor.findFirst({
    where: { id: proveedorId, esFabrica: true },
    select: { id: true },
  });
  if (!proveedor) return VACIO;

  const pagina = filtros.pagina ?? 1;
  const sucursales = await listarSucursalesParaPedidoAFabrica();
  const estadoPedidoPromise = buildMapCantAPedirAFabricaPorProveedor(proveedorId);

  let pedidoCodExts: string[] | undefined;
  if (filtros.pedido === "si" || filtros.pedido === "no") {
    const estado = await estadoPedidoPromise;
    pedidoCodExts = Object.keys(estado.cantAPedirByCodExt);
  }

  const whereItems = buildWhereLista(
    proveedorId,
    filtros,
    undefined,
    pedidoCodExts
  );
  const whereMarcas = buildWhereLista(proveedorId, filtros, "marca", pedidoCodExts);
  const whereRubros = buildWhereLista(proveedorId, filtros, "rubro", pedidoCodExts);
  const whereSubRubros = buildWhereLista(
    proveedorId,
    filtros,
    "subRubro",
    pedidoCodExts
  );

  const [total, filas, marcas, rubros, subRubros, estadoPedido] =
    await Promise.all([
    prisma.listaPrecioProveedor.count({ where: whereItems }),
    prisma.listaPrecioProveedor.findMany({
      where: whereItems,
      select: {
        codExt: true,
        descripcionProveedor: true,
        codTiendaVinculo: true,
        prodTienda: {
          select: {
            descripcionTienda: true,
            bulto: true,
          },
        },
      },
      orderBy: { descripcionProveedor: "asc" },
      skip: skipForPagina(pagina),
      take: PAGE_SIZE,
    }),
    opcionesCampoTienda(whereMarcas, "marca"),
    opcionesCampoTienda(whereRubros, "rubro"),
    opcionesCampoTienda(whereSubRubros, "subRubro"),
    estadoPedidoPromise,
  ]);

  const codTiendas = [
    ...new Set(
      filas
        .map((f) => f.codTiendaVinculo?.trim())
        .filter((c): c is string => Boolean(c))
    ),
  ];

  const stockMapsByDeposito = new Map<number, Map<string, number>>();
  const idsDeposito = [
    ...new Set(
      sucursales
        .map((s) => s.idDeposito)
        .filter((id): id is number => id != null)
    ),
  ];
  await Promise.all(
    idsDeposito.map(async (idDeposito) => {
      const map = await buildMapStockPorDeposito(codTiendas, idDeposito);
      stockMapsByDeposito.set(idDeposito, map);
    })
  );

  const promMap = await buildMapPromVtaDiaria(
    codTiendas,
    sucursales.map((s) => s.id)
  );

  const productos: ProductoPedidoAFabricaItem[] = filas.map((f) => {
    const vinculado = f.prodTienda != null;
    const codTienda = vinculado
      ? (f.codTiendaVinculo?.trim() || null)
      : null;
    const descripcion = vinculado
      ? (f.prodTienda?.descripcionTienda?.trim() ?? "")
      : f.descripcionProveedor;
    const bulto = vinculado ? bultoProdTiendaValido(f.prodTienda?.bulto) : null;
    const porSucursal = emptyPorSucursal(sucursales);
    if (codTienda) {
      for (const s of sucursales) {
        const stockActual =
          s.idDeposito != null
            ? (stockMapsByDeposito.get(s.idDeposito)?.get(codTienda) ?? 0)
            : null;
        const key = `${codTienda}\0${s.id}`;
        const promVta = promMap.has(key) ? (promMap.get(key) as number) : 0;
        porSucursal[s.id] = { stockActual, promVta };
      }
    }
    return {
      codExt: f.codExt,
      descripcion,
      codTienda,
      bulto,
      porSucursal,
    };
  });

  return {
    sucursales,
    productos,
    total,
    totalPaginas: totalPaginasFromTotal(total),
    marcas,
    rubros,
    subRubros,
    cantAPedirByCodExt: estadoPedido.cantAPedirByCodExt,
    formaPedirByCodExt: estadoPedido.formaPedirByCodExt,
  };
}
