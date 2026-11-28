import { prisma } from "@/lib/prisma";
import type { Prisma, TerminacionProdLista } from "@prisma/client";
import { esRubroTintometrico } from "@/lib/codColorTintometrico";
import { getProveedoresMercaderia } from "@/services/proveedor.service";
import type { DescPromoEspecialFactura } from "@/lib/descPromo";
import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import { listarDescPromosEspecialesPorCodigos } from "@/services/descPromo.service";
import { mapPxVentaDeLista } from "@/services/prodTiendaPrecios.service";
import {
  buildMapSaldoStockItemsSucursales,
  claveSaldoStock,
} from "@/services/stockMovimientos.service";
import type { ServiceResult } from "@/types";

export interface ProductoFacturaStockSucursal {
  codigo: string;
  nombre: string;
  stock: number;
}

export interface ProductoFacturaBusquedaItem {
  codTienda: string;
  descripcion: string;
  /** Precio lista **1 - GENERAL**; `0` si no hay fila. */
  pxLista: number;
  /**
   * Stock de la sucursal del usuario (si se informó `sucursalCodigo`);
   * si no, suma de stocks de todas las sucursales.
   */
  stock: number;
  /** Detalle por sucursal (cada sucursal es depósito). */
  stockPorSucursal: ProductoFacturaStockSucursal[];
  /**
   * Rubro TINTOMETRICO: al elegirlo se piden MARCA COD. + COD. COLOR y px.
   * `idMarca` = marca del producto (solo preselección; el código puede ser de otra marca).
   * `null` = producto común.
   */
  tintometrico: { idMarca: string | null } | null;
  /** FK `prod_lista.id_marca` para excepciones de `desc_promo_reglas`. */
  idMarca: string | null;
  /** FK `prod_lista.id_rubro` para resolver `desc_promo_reglas`. */
  idRubro: string | null;
  /** FK `prod_lista.id_sub_rubro`. */
  idSubRubro: string | null;
  /** `prod_lista.precio_editable`: en el remito el PX. LISTA se tipea. */
  precioEditable: boolean;
  /** Promos de alcance ITEMS (DESC. ESPECIAL) de este código. */
  descEspeciales: DescPromoEspecialFactura[];
  /**
   * Equivalente de mejor prioridad de venta (misma color, presentación y terminación).
   * `null` si este ítem ya es el mejor o no hay equivalente.
   */
  prioridadOfrecer: ProductoFacturaPrioridadOferta | null;
}

/** Ítem a ofrecer en lugar del buscado. No anida otra sugerencia. */
export interface ProductoFacturaPrioridadOferta {
  codTienda: string;
  descripcion: string;
  pxLista: number;
  stock: number;
  stockPorSucursal: ProductoFacturaStockSucursal[];
  tintometrico: { idMarca: string | null } | null;
  idMarca: string | null;
  idRubro: string | null;
  idSubRubro: string | null;
  precioEditable: boolean;
  descEspeciales: DescPromoEspecialFactura[];
}

type FilaEquivalencia = {
  idColor: string | null;
  idPresentacion: string | null;
  terminacion: TerminacionProdLista | null;
};

type FilaPrioridadFactura = {
  subcategoriaId: string;
  familiaId: string;
  orden: number;
};

type CandidatoPrioridadFactura = {
  codTienda: string;
  descripcion: string;
  familiaId: string;
  idMarca: string | null;
  idRubro: string | null;
  idSubRubro: string | null;
  precioEditable: boolean;
  rubroNombre: string | null;
};

function claveEquivalenciaFactura(fila: FilaEquivalencia): string {
  return `${fila.idColor ?? ""}\0${fila.idPresentacion ?? ""}\0${fila.terminacion ?? ""}`;
}

function filtroEquivalenciaFactura(
  familiaId: string,
  fila: FilaEquivalencia
): Prisma.ProdPropioWhereInput {
  return {
    familiaId,
    idColor: fila.idColor,
    idPresentacion: fila.idPresentacion,
    terminacion: fila.terminacion,
    habilitado: true,
  };
}

/**
 * Para cada ítem buscado, el producto habilitado de mejor prioridad de venta
 * con el mismo color, presentación y terminación (vacío coincide con vacío).
 */
async function resolverPrioridadOfrecerPorCod(
  rows: Array<
    FilaEquivalencia & {
      codTienda: string;
      familiaId: string | null;
    }
  >
): Promise<Map<string, CandidatoPrioridadFactura>> {
  const vacio = new Map<string, CandidatoPrioridadFactura>();
  const conFamilia = rows.filter((row) => row.familiaId != null);
  if (conFamilia.length === 0) return vacio;

  const familiaIds = [...new Set(conFamilia.map((row) => row.familiaId as string))];
  const propias = await prisma.comparacionFamilia.findMany({
    where: { familiaId: { in: familiaIds } },
    select: { subcategoriaId: true, familiaId: true, orden: true },
  });
  if (propias.length === 0) return vacio;

  const subcategoriaIds = [...new Set(propias.map((fila) => fila.subcategoriaId))];
  const prioridades = await prisma.comparacionFamilia.findMany({
    where: { subcategoriaId: { in: subcategoriaIds } },
    select: { subcategoriaId: true, familiaId: true, orden: true },
  });
  const porSubcategoria = new Map<string, FilaPrioridadFactura[]>();
  for (const fila of prioridades) {
    const lista = porSubcategoria.get(fila.subcategoriaId) ?? [];
    lista.push(fila);
    porSubcategoria.set(fila.subcategoriaId, lista);
  }

  const mejorOrdenPorCod = new Map<string, Map<string, number>>();
  const or: Prisma.ProdPropioWhereInput[] = [];
  const orVistos = new Set<string>();

  for (const row of conFamilia) {
    const familiaId = row.familiaId as string;
    const mejores = new Map<string, number>();
    for (const filas of porSubcategoria.values()) {
      const propia = filas.find((fila) => fila.familiaId === familiaId);
      if (!propia) continue;
      for (const fila of filas) {
        if (fila.orden >= propia.orden || fila.familiaId === familiaId) continue;
        const previo = mejores.get(fila.familiaId);
        if (previo == null || fila.orden < previo) mejores.set(fila.familiaId, fila.orden);
      }
    }
    if (mejores.size === 0) continue;
    mejorOrdenPorCod.set(row.codTienda, mejores);
    for (const id of mejores.keys()) {
      const clave = `${id}\0${claveEquivalenciaFactura(row)}`;
      if (orVistos.has(clave)) continue;
      orVistos.add(clave);
      or.push(filtroEquivalenciaFactura(id, row));
    }
  }
  if (or.length === 0) return vacio;

  const candidatos = await prisma.prodPropio.findMany({
    where: {
      AND: [
        { OR: or },
        { descripcionTienda: { not: null } },
        { descripcionTienda: { not: "" } },
      ],
    },
    select: {
      codTienda: true,
      descripcionTienda: true,
      familiaId: true,
      idColor: true,
      idPresentacion: true,
      terminacion: true,
      idMarca: true,
      idRubro: true,
      idSubRubro: true,
      precioEditable: true,
      rubroRelation: { select: { nombre: true } },
    },
    orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
  });

  const porFamiliaClave = new Map<string, CandidatoPrioridadFactura[]>();
  for (const candidato of candidatos) {
    if (!candidato.familiaId) continue;
    const descripcion = (candidato.descripcionTienda ?? "").trim();
    if (!descripcion) continue;
    const armado: CandidatoPrioridadFactura = {
      codTienda: candidato.codTienda,
      descripcion,
      familiaId: candidato.familiaId,
      idMarca: candidato.idMarca,
      idRubro: candidato.idRubro,
      idSubRubro: candidato.idSubRubro,
      precioEditable: candidato.precioEditable,
      rubroNombre: candidato.rubroRelation?.nombre ?? null,
    };
    const clave = `${candidato.familiaId}\0${claveEquivalenciaFactura(candidato)}`;
    const lista = porFamiliaClave.get(clave) ?? [];
    lista.push(armado);
    porFamiliaClave.set(clave, lista);
  }

  const elegidos = new Map<string, CandidatoPrioridadFactura>();
  for (const row of conFamilia) {
    const mejores = mejorOrdenPorCod.get(row.codTienda);
    if (!mejores) continue;
    const claveEq = claveEquivalenciaFactura(row);
    let elegido: { orden: number; candidato: CandidatoPrioridadFactura } | null = null;
    for (const [familiaId, orden] of mejores) {
      const lista = porFamiliaClave.get(`${familiaId}\0${claveEq}`) ?? [];
      const candidato = lista.find((item) => item.codTienda !== row.codTienda);
      if (!candidato) continue;
      if (
        elegido == null ||
        orden < elegido.orden ||
        (orden === elegido.orden && candidato.descripcion < elegido.candidato.descripcion)
      ) {
        elegido = { orden, candidato };
      }
    }
    if (elegido) elegidos.set(row.codTienda, elegido.candidato);
  }
  return elegidos;
}

function armarPrioridadOferta(
  candidato: CandidatoPrioridadFactura,
  pxPorCod: Map<string, number>,
  saldos: Map<string, number>,
  especialesPorCod: Map<string, DescPromoEspecialFactura[]>,
  sucursales: { id: string; codigo: string; nombre: string }[],
  sucursalCodigo: string | null
): ProductoFacturaPrioridadOferta {
  const stockPorSucursal = sucursales.map((s) => ({
    codigo: s.codigo,
    nombre: s.nombre,
    stock: saldos.get(claveSaldoStock(candidato.codTienda, s.id)) ?? 0,
  }));
  const stockUsuario =
    sucursalCodigo != null
      ? stockPorSucursal.find((x) => x.codigo === sucursalCodigo)?.stock
      : undefined;
  const stock = stockUsuario ?? stockPorSucursal.reduce((acc, x) => acc + x.stock, 0);
  return {
    codTienda: candidato.codTienda,
    descripcion: candidato.descripcion,
    pxLista: pxPorCod.get(candidato.codTienda) ?? 0,
    stock,
    stockPorSucursal,
    tintometrico: esRubroTintometrico(candidato.rubroNombre)
      ? { idMarca: candidato.idMarca }
      : null,
    idMarca: candidato.idMarca,
    idRubro: candidato.idRubro,
    idSubRubro: candidato.idSubRubro,
    precioEditable: candidato.precioEditable,
    descEspeciales: especialesPorCod.get(candidato.codTienda) ?? [],
  };
}

function normalizeTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Busca en `prod_lista` por descripción: cada token debe aparecer (`contains`, insensitive).
 * Máx. `take` (Factura typeahead: 10). Incluye PX **1 - GENERAL** + stock por sucursal.
 */
export async function buscarProductosParaFactura(params: {
  q: string;
  take?: number;
  /** Código sucursal del usuario (p. ej. guaymallen); define la columna Stock. */
  sucursalCodigo?: string | null;
  /** Igualdad con `prod_lista.rubro`. Vacío = sin filtro. */
  rubro?: string | null;
  /** Igualdad con `prod_lista.sub_rubro`. Vacío = sin filtro. */
  subRubro?: string | null;
  /** Igualdad con `prod_lista.marca`. Vacío = sin filtro. */
  marca?: string | null;
  /**
   * Tope de filas. Typeahead: 10 (default). Búsqueda avanzada: 100.
   */
  takeMax?: number;
}): Promise<ServiceResult<{ items: ProductoFacturaBusquedaItem[] }>> {
  const tokens = normalizeTokens(params.q);
  const rubro = params.rubro?.trim() || null;
  const subRubro = params.subRubro?.trim() || null;
  const marca = params.marca?.trim() || null;
  if (tokens.length === 0 && !rubro && !subRubro && !marca) {
    return { success: true, data: { items: [] } };
  }

  const takeMax = Math.min(100, Math.max(1, Math.floor(Number(params.takeMax) || 10)));
  const take = Math.min(takeMax, Math.max(1, Math.floor(Number(params.take) || takeMax)));
  const sucursalCodigo = params.sucursalCodigo?.trim().toLowerCase() || null;

  try {
    const [listas, sucursales] = await Promise.all([
      prisma.prodPropioListaPrecioNombre.findMany({
        select: { idLista: true, nombreLista: true },
      }),
      prisma.sucursal.findMany({
        select: { id: true, codigo: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
    ]);
    const idListaGeneral = encontrarIdListaGeneralPxListas(listas);

    const and: Prisma.ProdPropioWhereInput[] = [
      { habilitado: true },
      { descripcionTienda: { not: null } },
      { descripcionTienda: { not: "" } },
    ];
    if (tokens.length > 0) {
      and.push({
        AND: tokens.map((t) => ({
          descripcionTienda: { contains: t, mode: "insensitive" as const },
        })),
      });
    }
    if (rubro) and.push({ rubroRelation: { nombre: { equals: rubro, mode: "insensitive" } } });
    if (subRubro) and.push({ subRubroRelation: { nombre: { equals: subRubro, mode: "insensitive" } } });
    if (marca) and.push({ marcaRelation: { nombre: { equals: marca, mode: "insensitive" } } });

    const where: Prisma.ProdPropioWhereInput = { AND: and };

    const rows = await prisma.prodPropio.findMany({
      where,
      select: {
        codTienda: true,
        descripcionTienda: true,
        familiaId: true,
        idColor: true,
        idPresentacion: true,
        terminacion: true,
        idRubro: true,
        idSubRubro: true,
        rubroRelation: { select: { nombre: true } },
        idMarca: true,
        precioEditable: true,
      },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      take,
    });

    const prioridadPorCod = await resolverPrioridadOfrecerPorCod(rows);
    const codigos = [
      ...new Set([
        ...rows.map((r) => r.codTienda),
        ...[...prioridadPorCod.values()].map((candidato) => candidato.codTienda),
      ]),
    ];
    const pxPorCod =
      codigos.length > 0 && idListaGeneral != null
        ? await mapPxVentaDeLista(codigos, idListaGeneral)
        : new Map<string, number>();

    const [saldos, especialesPorCod] = await Promise.all([
      buildMapSaldoStockItemsSucursales(
        codigos,
        sucursales.map((s) => s.id)
      ),
      listarDescPromosEspecialesPorCodigos(codigos),
    ]);

    const items: ProductoFacturaBusquedaItem[] = rows.map((r) => {
      const stockPorSucursal: ProductoFacturaStockSucursal[] =
        sucursales.map((s) => ({
          codigo: s.codigo,
          nombre: s.nombre,
          stock: saldos.get(claveSaldoStock(r.codTienda, s.id)) ?? 0,
        }));

      const stockUsuario =
        sucursalCodigo != null
          ? stockPorSucursal.find((x) => x.codigo === sucursalCodigo)?.stock
          : undefined;
      const stock =
        stockUsuario ??
        stockPorSucursal.reduce((acc, x) => acc + x.stock, 0);

      const candidato = prioridadPorCod.get(r.codTienda) ?? null;
      const prioridadOfrecer = candidato
        ? armarPrioridadOferta(
            candidato,
            pxPorCod,
            saldos,
            especialesPorCod,
            sucursales,
            sucursalCodigo
          )
        : null;

      return {
        codTienda: r.codTienda,
        descripcion: (r.descripcionTienda ?? "").trim(),
        pxLista: pxPorCod.get(r.codTienda) ?? 0,
        stock,
        stockPorSucursal,
        tintometrico: esRubroTintometrico(r.rubroRelation?.nombre)
          ? { idMarca: r.idMarca }
          : null,
        idMarca: r.idMarca,
        idRubro: r.idRubro,
        idSubRubro: r.idSubRubro,
        precioEditable: r.precioEditable,
        descEspeciales: especialesPorCod.get(r.codTienda) ?? [],
        prioridadOfrecer,
      };
    });

    return { success: true, data: { items } };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al buscar productos para factura.";
    console.error("[facturacion][buscarProductosParaFactura]", e);
    return { success: false, error: msg };
  }
}

/** Un ítem de `prod_lista` por código exacto (Px Sugeridos carga el 1503). */
export async function obtenerProductoFacturaPorCodTienda(
  codTienda: string
): Promise<ServiceResult<ProductoFacturaBusquedaItem>> {
  const cod = codTienda.trim();
  if (!cod) return { success: false, error: "Falta el código de tienda." };

  try {
    const [listas, sucursales, row] = await Promise.all([
      prisma.prodPropioListaPrecioNombre.findMany({
        select: { idLista: true, nombreLista: true },
      }),
      prisma.sucursal.findMany({
        select: { id: true, codigo: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.prodPropio.findUnique({
        where: { codTienda: cod },
        select: {
          codTienda: true,
          descripcionTienda: true,
          idRubro: true,
          idSubRubro: true,
          rubroRelation: { select: { nombre: true } },
          idMarca: true,
          precioEditable: true,
        },
      }),
    ]);
    const descripcion = (row?.descripcionTienda ?? "").trim();
    if (!row || !descripcion) {
      return { success: false, error: `No se encontró el producto ${cod}.` };
    }

    const idListaGeneral = encontrarIdListaGeneralPxListas(listas);
    const pxPorCod =
      idListaGeneral == null ? new Map<string, number>() : await mapPxVentaDeLista([cod], idListaGeneral);
    const pxLista = pxPorCod.get(cod) ?? 0;

    const [saldos, especialesPorCod] = await Promise.all([
      buildMapSaldoStockItemsSucursales(
        [cod],
        sucursales.map((s) => s.id)
      ),
      listarDescPromosEspecialesPorCodigos([cod]),
    ]);
    const stockPorSucursal: ProductoFacturaStockSucursal[] = sucursales.map((s) => ({
      codigo: s.codigo,
      nombre: s.nombre,
      stock: saldos.get(claveSaldoStock(cod, s.id)) ?? 0,
    }));

    return {
      success: true,
      data: {
        codTienda: row.codTienda,
        descripcion,
        pxLista,
        stock: stockPorSucursal.reduce((acc, x) => acc + x.stock, 0),
        stockPorSucursal,
        tintometrico: esRubroTintometrico(row.rubroRelation?.nombre)
          ? { idMarca: row.idMarca }
          : null,
        idMarca: row.idMarca,
        idRubro: row.idRubro,
        idSubRubro: row.idSubRubro,
        precioEditable: row.precioEditable,
        descEspeciales: especialesPorCod.get(cod) ?? [],
        prioridadOfrecer: null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar el producto.";
    console.error("[facturacion][obtenerProductoFacturaPorCodTienda]", e);
    return { success: false, error: msg };
  }
}

export interface CatalogoPxSugeridosFactura {
  proveedores: { id: string; nombre: string; prefijo: string }[];
  marcas: { id: string; nombre: string }[];
}

/** Proveedores de mercadería y marcas para el modal Px Sugeridos de Crear. */
export async function listarCatalogoPxSugeridosFactura(): Promise<
  ServiceResult<CatalogoPxSugeridosFactura>
> {
  try {
    const [proveedores, marcas] = await Promise.all([
      getProveedoresMercaderia(),
      prisma.marca.findMany({
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true },
      }),
    ]);
    return {
      success: true,
      data: {
        proveedores: proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          prefijo: p.prefijo,
        })),
        marcas,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo abrir Px Sugeridos.";
    console.error("[facturacion][listarCatalogoPxSugeridosFactura]", e);
    return { success: false, error: msg };
  }
}

/** Stock por sucursal de los ítems ya cargados en el remito de Crear. */
export async function listarStockSucursalesItemsFactura(
  codTiendas: readonly string[]
): Promise<
  ServiceResult<{ items: { codTienda: string; stockPorSucursal: ProductoFacturaStockSucursal[] }[] }>
> {
  const codigos = [...new Set(codTiendas.map((c) => c.trim()).filter(Boolean))];
  if (codigos.length === 0) return { success: true, data: { items: [] } };

  try {
    const sucursales = await prisma.sucursal.findMany({
      select: { id: true, codigo: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    const saldos = await buildMapSaldoStockItemsSucursales(
      codigos,
      sucursales.map((s) => s.id)
    );
    const items = codigos.map((codTienda) => ({
      codTienda,
      stockPorSucursal: sucursales.map((s) => ({
        codigo: s.codigo,
        nombre: s.nombre,
        stock: saldos.get(claveSaldoStock(codTienda, s.id)) ?? 0,
      })),
    }));
    return { success: true, data: { items } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al consultar el stock por sucursal.";
    console.error("[facturacion][listarStockSucursalesItemsFactura]", e);
    return { success: false, error: msg };
  }
}

/** Marca / rubro / sub-rubro actuales de `prod_lista` para aplicar promos al duplicar o NC. */
export async function rubrosPorCodigosTienda(
  codigos: readonly string[]
): Promise<
  Map<
    string,
    {
      idMarca: string | null;
      idRubro: string | null;
      idSubRubro: string | null;
      precioEditable: boolean;
    }
  >
> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  const out = new Map<
    string,
    {
      idMarca: string | null;
      idRubro: string | null;
      idSubRubro: string | null;
      precioEditable: boolean;
    }
  >();
  if (unicos.length === 0) return out;
  const rows = await prisma.prodPropio.findMany({
    where: { codTienda: { in: unicos } },
    select: { codTienda: true, idMarca: true, idRubro: true, idSubRubro: true, precioEditable: true },
  });
  for (const r of rows) {
    out.set(r.codTienda, {
      idMarca: r.idMarca,
      idRubro: r.idRubro,
      idSubRubro: r.idSubRubro,
      precioEditable: r.precioEditable,
    });
  }
  return out;
}
