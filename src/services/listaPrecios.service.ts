/**
 * Servicio prod_precios_provee – Capa de datos (Neon / Prisma).
 * Upsert por código externo (cod_ext = [SUFIJO]-[codProdProv]).
 * Lectura paginada: `getListaPreciosConTiendaFiltrada` (SSOT de la grilla).
 */

import type { FilaListaPrecio } from "@/lib/parsearImport";
import { IvaProveedor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCodExt } from "@/lib/codigos";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  materializarDescuentosEnFila,
  materializarDescuentosEnFilas,
} from "@/services/descuentosListaPrecioReglas.service";
import { resolverCotizacionDolarParaItem } from "@/services/cotizacionUsd.service";
import {
  enriquecerFilasConDescuentosActivos,
  type DescuentoActivoListaPrecio,
} from "@/services/descuentosListaPrecioReglas.service";
import { listarRubrosOpcionesDesdeProdTienda } from "@/services/rubrosProdTienda.service";
import {
  esFiltroListaPreciosSinValor,
} from "@/lib/listaPreciosFiltros";
import type { Prisma } from "@prisma/client";
import { PAGE_SIZE } from "@/lib/pagination";
import { cantPedirReposicionMerc2 } from "@/services/pedidosEnvio.service";
import {
  buildMapStockeable,
  buildMapsStockSucursalesPrincipales,
  getStockeableFromMap,
  getStockSucursalPrincipal,
} from "@/services/prodTiendaStock.service";
import { bultoProdTiendaValido, buildMapBultosProdTienda } from "@/services/tiendaBultos.service";

const TIPO_URGENTE_MERC2 = "URGENTE";

export interface PrecioRexVinculoCliente {
  id: string;
  descripcion: string;
  pxListaProveedor: number;
}

export type { DescuentoActivoListaPrecio } from "@/services/descuentosListaPrecioReglas.service";

export interface FilaListaPrecioParaCliente {
  id: string;
  codExt: string;
  codProdProveedor: string;
  habilitado: boolean;
  /** Descripción efectiva para UI: primero tienda, fallback proveedor. */
  descripcion: string;
  descripcionProveedor: string;
  descripcionTienda: string | null;
  marca: string | null;
  rubro: string | null;
  pxListaProveedor: number;
  /** true = lista y promo en US$; false = pesos. */
  pxDolares: boolean;
  /** Precio venta sugerido; presente cuando se usa soloPxSugerido (p. ej. página Sugeridos). */
  pxVtaSugerido?: number | null;
  dtoProveedor: number;
  dtoMarca: number;
  dtoRubro: number;
  dtoCantidad: number;
  dtoFinanciero: number;
  cxTransporte: number;
  descEspecial: number;
  pxPromoFijo: number | null;
  pxCompraFinalSinIva: number | null;
  proveedor: { id: string; prefijo: string; nombre: string; codigoUnico: string } | null;
  idPrecioRex: string | null;
  precioRex: PrecioRexVinculoCliente | null;
  /** Descuentos/costos > 0 con regla ganadora (modo «Desc. en fila»). */
  descuentosActivos?: DescuentoActivoListaPrecio[];
}

const listaPrecioParaClienteInclude = {
  proveedor: true,
  prodTienda: { select: { descripcionTienda: true } },
  precioRex: { select: { id: true, descripcion: true, pxListaProveedor: true } },
} as const;

type ListaPrecioProveedorParaCliente = Prisma.ListaPrecioProveedorGetPayload<{
  include: typeof listaPrecioParaClienteInclude;
}>;

function mapListaPrecioProveedorParaCliente(f: ListaPrecioProveedorParaCliente): FilaListaPrecioParaCliente {
  const descTienda = f.prodTienda?.descripcionTienda?.trim() || null;
  return {
    id: f.codExt,
    codExt: f.codExt,
    codProdProveedor: f.codProdProveedor,
    habilitado: f.habilitado,
    descripcion: descTienda ?? f.descripcionProveedor,
    descripcionProveedor: f.descripcionProveedor,
    descripcionTienda: descTienda,
    marca: f.marca ?? null,
    rubro: f.rubro ?? null,
    pxListaProveedor: Number(f.pxListaProveedor),
    pxDolares: f.pxDolares,
    pxVtaSugerido: f.pxVtaSugerido != null ? Number(f.pxVtaSugerido) : null,
    dtoProveedor: Number(f.dtoProveedor),
    dtoMarca: Number(f.dtoMarca),
    dtoRubro: Number(f.dtoRubro),
    dtoCantidad: Number(f.dtoCantidad),
    dtoFinanciero: Number(f.dtoFinanciero),
    cxTransporte: Number(f.cxTransporte),
    descEspecial: Number(f.descEspecial),
    pxPromoFijo: f.pxPromoFijo != null && Number(f.pxPromoFijo) > 0 ? Number(f.pxPromoFijo) : null,
    pxCompraFinalSinIva: f.pxCompraFinalSinIva != null ? Number(f.pxCompraFinalSinIva) : null,
    proveedor: f.proveedor
      ? {
          id: f.proveedor.id,
          prefijo: f.proveedor.prefijo ?? "",
          nombre: f.proveedor.nombre,
          codigoUnico: f.proveedor.codigoUnico,
        }
      : null,
    idPrecioRex: f.idPrecioRex,
    precioRex: f.precioRex
      ? {
          id: f.precioRex.id,
          descripcion: f.precioRex.descripcion,
          pxListaProveedor: Number(f.precioRex.pxListaProveedor),
        }
      : null,
  };
}

export interface ListaPreciosFiltradoOpciones {
  /** Si true, solo devuelve ítems con px_vta_sugerido no nulo (p. ej. página Px Vta. Sugeridos). */
  soloPxSugerido?: boolean;
}

/**
 * Lista de precios filtrada por proveedor, marca, rubro y/o búsqueda (≥3 caracteres).
 * Usado para carga bajo demanda: no se traen datos hasta que el usuario aplica un filtro.
 * Si no hay filtro activo (ningún selector o búsqueda < 3 chars), devuelve [].
 * opciones.soloPxSugerido: solo ítems con px_vta_sugerido no nulo (p. ej. página Sugeridos).
 * Regla de filtros: ver docs/FILTROS_DINAMICOS.md (simétrico: opciones de cada filtro según los demás).
 */
export interface ListaPreciosFiltradaResult {
  filas: FilaListaPrecioParaCliente[];
  total: number;
  totalPaginas: number;
}

function whereCampoTextoSinDetalle(campo: "marca" | "rubro"): Prisma.ListaPrecioProveedorWhereInput {
  return {
    OR: [{ [campo]: null }, { [campo]: "" }],
  };
}

function aplicaFiltroMarcaRubro(
  andParts: Prisma.ListaPrecioProveedorWhereInput[],
  campo: "marca" | "rubro",
  valor: string | undefined
): void {
  const v = valor?.trim();
  if (!v) return;
  if (esFiltroListaPreciosSinValor(v)) {
    andParts.push(whereCampoTextoSinDetalle(campo));
    return;
  }
  andParts.push({ [campo]: v });
}

function filtroMarcaRubroActivo(valor: string | undefined): boolean {
  return !!valor?.trim();
}

export async function getListaPreciosConTiendaFiltrada(
  proveedorId: string | undefined,
  marcaNombre: string | undefined,
  rubroNombre: string | undefined,
  busqueda: string | undefined,
  habilitado: boolean | undefined,
  vinculado: boolean | undefined,
  opciones?: ListaPreciosFiltradoOpciones,
  pagina?: number,
  pageSize: number = PAGE_SIZE
): Promise<ListaPreciosFiltradaResult> {
  const prov = proveedorId?.trim() || undefined;
  const marca = marcaNombre?.trim() || undefined;
  const rubro = rubroNombre?.trim() || undefined;
  const q = busqueda?.trim() || "";
  const tieneFiltro =
    !!prov ||
    filtroMarcaRubroActivo(marca) ||
    filtroMarcaRubroActivo(rubro) ||
    habilitado !== undefined ||
    vinculado !== undefined ||
    q.length >= 3;
  if (!tieneFiltro) return { filas: [], total: 0, totalPaginas: 0 };

  const andParts: Prisma.ListaPrecioProveedorWhereInput[] = [];
  andParts.push({ proveedor: { proveedorMercaderia: true } });
  if (prov) andParts.push({ idProveedor: prov });
  aplicaFiltroMarcaRubro(andParts, "marca", marca);
  aplicaFiltroMarcaRubro(andParts, "rubro", rubro);
  if (habilitado !== undefined) andParts.push({ habilitado });
  if (vinculado === true) andParts.push({ idPrecioRex: { not: null } });
  if (vinculado === false) andParts.push({ idPrecioRex: null });
  if (opciones?.soloPxSugerido) andParts.push({ pxVtaSugerido: { not: null } });
  if (q.length >= 3) {
    const tokens = q.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      andParts.push({
        AND: tokens.map((token) => ({
          OR: [
            { descripcionProveedor: { contains: token, mode: "insensitive" as const } },
            { codExt: { contains: token, mode: "insensitive" as const } },
            { marca: { contains: token, mode: "insensitive" as const } },
            { rubro: { contains: token, mode: "insensitive" as const } },
            { prodTienda: { descripcionTienda: { contains: token, mode: "insensitive" as const } } },
          ],
        })),
      });
    }
  }
  const where: Prisma.ListaPrecioProveedorWhereInput = andParts.length ? { AND: andParts } : {};

  const skip = pagina != null ? (Math.max(1, pagina) - 1) * pageSize : 0;
  const take = pagina != null ? pageSize : undefined;

  const [filasRaw, total] = await Promise.all([
    prisma.listaPrecioProveedor.findMany({
      where,
      include: listaPrecioParaClienteInclude,
      orderBy: { codExt: "asc" },
      skip,
      take,
    }),
    prisma.listaPrecioProveedor.count({ where }),
  ]);

  let result: FilaListaPrecioParaCliente[] = filasRaw.map(mapListaPrecioProveedorParaCliente);

  if (q.length >= 3) {
    result = result.filter((f) =>
      matchByMultiTerm([f.descripcionProveedor, f.descripcionTienda, f.marca ?? "", f.rubro ?? ""], q)
    );
  }

  result = await enriquecerFilasConDescuentosActivos(result);

  const totalPaginas = pagina != null && total > 0 ? Math.ceil(total / pageSize) : 1;

  return { filas: result, total, totalPaginas };
}

/** Todos los ítems que coinciden con los filtros activos (sin paginación). */
export async function listarListaPreciosFiltradaParaExport(
  proveedorId: string | undefined,
  marcaNombre: string | undefined,
  rubroNombre: string | undefined,
  busqueda: string | undefined,
  habilitado: boolean | undefined,
  vinculado: boolean | undefined,
  opciones?: ListaPreciosFiltradoOpciones
): Promise<FilaListaPrecioParaCliente[]> {
  const { filas } = await getListaPreciosConTiendaFiltrada(
    proveedorId,
    marcaNombre,
    rubroNombre,
    busqueda,
    habilitado,
    vinculado,
    opciones,
    undefined
  );
  return filas;
}

/** Descripciones efectivas por `cod_ext` (consulta directa, sin paginación ni filtro por texto). */
export async function getDescripcionesListaPrecioPorCodExt(
  codigosExt: string[]
): Promise<{ codExt: string; descripcion: string }[]> {
  const unicos = [...new Set(codigosExt.map((c) => c.trim()).filter(Boolean))];
  if (unicos.length === 0) return [];

  const filasRaw = await prisma.listaPrecioProveedor.findMany({
    where: { codExt: { in: unicos } },
    include: listaPrecioParaClienteInclude,
  });

  const descripcionPorCod = new Map<string, string>();
  for (const fila of filasRaw) {
    const mapped = mapListaPrecioProveedorParaCliente(fila);
    descripcionPorCod.set(mapped.codExt, mapped.descripcion);
  }

  return unicos.map((codExt) => ({
    codExt,
    descripcion: descripcionPorCod.get(codExt) ?? codExt,
  }));
}

/** Proveedores con al menos un ítem que cumple (marca, rubro, busqueda, habilitado, vinculado). Para filtros dinámicos (ver FILTROS_DINAMICOS.md). */
export async function getProveedoresDisponiblesListaPrecios(
  marcaNombre: string | undefined,
  rubroNombre: string | undefined,
  busqueda: string | undefined,
  habilitado: boolean | undefined,
  vinculado: boolean | undefined,
  opciones?: ListaPreciosFiltradoOpciones
): Promise<{ id: string; nombre: string; prefijo: string }[]> {
  const { filas } = await getListaPreciosConTiendaFiltrada(
    undefined,
    marcaNombre,
    rubroNombre,
    busqueda,
    habilitado,
    vinculado,
    opciones
  );
  const seen = new Set<string>();
  const out: { id: string; nombre: string; prefijo: string }[] = [];
  for (const f of filas) {
    const p = f.proveedor;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, nombre: p.nombre, prefijo: p.prefijo });
  }
  return out;
}

/** Marcas con al menos un ítem que cumple (proveedorId, rubro, busqueda, habilitado, vinculado). Para filtros dinámicos (ver FILTROS_DINAMICOS.md). */
export async function getMarcasDisponiblesListaPrecios(
  proveedorId: string | undefined,
  rubroNombre: string | undefined,
  busqueda: string | undefined,
  habilitado: boolean | undefined,
  vinculado: boolean | undefined,
  opciones?: ListaPreciosFiltradoOpciones
): Promise<{ id: string; nombre: string }[]> {
  const { filas } = await getListaPreciosConTiendaFiltrada(
    proveedorId,
    undefined,
    rubroNombre,
    busqueda,
    habilitado,
    vinculado,
    opciones
  );
  const seen = new Set<string>();
  const out: { id: string; nombre: string }[] = [];
  for (const f of filas) {
    const m = (f.marca ?? "").trim();
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push({ id: m, nombre: m });
  }
  return out;
}

/** Rubros desde `prod_tienda.rubro` (catálogo de tienda). */
export async function getRubrosDisponiblesListaPrecios(
  _proveedorId: string | undefined,
  _marcaNombre: string | undefined,
  _busqueda: string | undefined,
  _habilitado: boolean | undefined,
  _vinculado: boolean | undefined,
  _opciones?: ListaPreciosFiltradoOpciones
): Promise<{ id: string; nombre: string }[]> {
  return listarRubrosOpcionesDesdeProdTienda();
}

/** Item mínimo para modal de vinculación: solo prefijo y descripción en tabla; datos completos para onSeleccionar. pxCompraFinalSinIva para selector de costo objetivo. */
export interface ProductoProveedorParaVincular {
  id: string;
  idProveedor: string;
  codExt: string;
  codProdProv: string;
  descripcionProveedor: string;
  rubro: string | null;
  marca: string | null;
  proveedor: { prefijo: string; nombre: string };
  /** Precio final de compra (para usar como costo objetivo al seleccionar desde lista). */
  pxCompraFinalSinIva: number | null;
  /** Si ya está vinculado a un ítem `prod_precios_tienda`, datos para mostrar bloqueo informativo. */
  tiendaVinculada: { codTienda: string; descripcion: string | null } | null;
}

const MAX_PRODUCTOS_VINCULAR = 500;

function tokensBusquedaProductosVincular(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

/** Cada término debe coincidir en al menos un campo (AND entre términos). */
function whereBusquedaProductosVincular(q: string): Prisma.ListaPrecioProveedorWhereInput {
  const tokens = tokensBusquedaProductosVincular(q);
  if (tokens.length === 0) return {};
  return {
    AND: tokens.map((token) => ({
      OR: [
        { descripcionProveedor: { contains: token, mode: "insensitive" as const } },
        { codExt: { contains: token, mode: "insensitive" as const } },
        { codProdProveedor: { contains: token, mode: "insensitive" as const } },
        { rubro: { contains: token, mode: "insensitive" as const } },
        { marca: { contains: token, mode: "insensitive" as const } },
        { proveedor: { nombre: { contains: token, mode: "insensitive" as const } } },
        { proveedor: { prefijo: { contains: token, mode: "insensitive" as const } } },
      ],
    })),
  };
}

/**
 * Lista ítems de prod_precios_provee para el modal "Vincular nuevo producto".
 * Filtros: proveedor (opcional), descripción/código/marca/rubro/proveedor (q, multi-término).
 */
export async function listarProductosProveedoresParaVincular(
  proveedorId?: string,
  q?: string
): Promise<ProductoProveedorParaVincular[]> {
  const andParts: Prisma.ListaPrecioProveedorWhereInput[] = [];
  if (proveedorId) andParts.push({ idProveedor: proveedorId });
  const qTrim = (q ?? "").trim();
  const textFilter = whereBusquedaProductosVincular(qTrim);
  if (qTrim) andParts.push(textFilter);
  const where: Prisma.ListaPrecioProveedorWhereInput = andParts.length ? { AND: andParts } : {};

  const rows = await prisma.listaPrecioProveedor.findMany({
    where,
    include: {
      proveedor: { select: { prefijo: true, nombre: true } },
      prodTienda: { select: { codTienda: true, descripcionTienda: true } },
    },
    orderBy: { codExt: "asc" },
    take: MAX_PRODUCTOS_VINCULAR,
  });

  const mapped = rows.map((r) => ({
    id: r.codExt,
    idProveedor: r.idProveedor,
    codExt: r.codExt,
    codProdProv: r.codProdProveedor,
    descripcionProveedor: r.descripcionProveedor,
    rubro: r.rubro ?? null,
    marca: r.marca ?? null,
    proveedor: { prefijo: r.proveedor.prefijo ?? "", nombre: r.proveedor.nombre },
    pxCompraFinalSinIva: r.pxCompraFinalSinIva != null ? Number(r.pxCompraFinalSinIva) : null,
    tiendaVinculada: r.prodTienda
      ? {
          codTienda: r.prodTienda.codTienda,
          descripcion: r.prodTienda.descripcionTienda,
        }
      : null,
  }));

  if (!qTrim) return mapped;

  return mapped.filter((r) =>
    matchByMultiTerm(
      [
        r.descripcionProveedor,
        r.codExt,
        r.codProdProv,
        r.rubro,
        r.marca,
        r.proveedor.prefijo,
        r.proveedor.nombre,
      ],
      qTrim
    )
  );
}

export interface UpsertListaPreciosResult {
  creados: number;
  actualizados: number;
  errores: string[];
}

export interface UpsertListaPreciosOptions {
  /** Llamado periódicamente con (procesados, total) para indicar avance (ej. sidebar). */
  onProgress?(processed: number, total: number): void;
}

/**
 * Upsert de filas en prod_precios_provee.
 * Clave lógica: cod_ext (único) = [SUFIJO]-[codProdProv].
 * Si existe, actualiza; si no, crea con descuentos y cx_transporte en 0 (defaults BD).
 * precioEnDolares: mapea al switch SÍ/NO del modal; se persiste en px_dolares. Si true, cotizacion_dolar = cotización global USD (BACKEND_GUIDELINES §3.2).
 * habilitado: mapea opción Habilitado SÍ/NO del modal importar; por defecto true.
 * marca: opcional en mapeo CSV; si no se asigna columna MARCA, no se modifica en update; si se asigna, persiste texto (vacío → null).
 */
export async function upsertListaPrecios(
  proveedorId: string,
  prefijo: string,
  filas: FilaListaPrecio[],
  precioEnDolares: boolean = false,
  habilitado: boolean = true,
  options?: UpsertListaPreciosOptions
): Promise<UpsertListaPreciosResult> {
  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];
  const cotizacionDolar = await resolverCotizacionDolarParaItem(precioEnDolares);
  const onProgress = options?.onProgress;
  const total = filas.length;
  const codExtsMaterializar: string[] = [];

  // Prefetch: evita el `findUnique()` por fila (N+1).
  // Solo usamos esto para el conteo (creados/actualizados); el estado final lo define el `upsert`.
  const uniqueCodProdProvs = [...new Set(filas.map((f) => f.codProdProv))];
  const existentesCodProdSet = new Set<string>();
  const CHUNK_PREFETCH = 500;
  for (let i = 0; i < uniqueCodProdProvs.length; i += CHUNK_PREFETCH) {
    const chunk = uniqueCodProdProvs.slice(i, i + CHUNK_PREFETCH);
    const existentes = await prisma.listaPrecioProveedor.findMany({
      where: {
        idProveedor: proveedorId,
        codProdProveedor: { in: chunk },
      },
      select: { codProdProveedor: true },
    });
    for (const row of existentes) existentesCodProdSet.add(row.codProdProveedor);
  }

  for (let i = 0; i < filas.length; i++) {
    if (onProgress && (i % 10 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }
    const fila = filas[i];
    const codExt = buildCodExt(prefijo, fila.codProdProv);

    try {
      const existia = existentesCodProdSet.has(fila.codProdProv);

      await prisma.listaPrecioProveedor.upsert({
        where: { idProveedor_codProdProveedor: { idProveedor: proveedorId, codProdProveedor: fila.codProdProv } },
        create: {
          idProveedor: proveedorId,
          codProdProveedor: fila.codProdProv,
          descripcionProveedor: fila.descripcion,
          codExt,
          pxListaProveedor: fila.precioLista,
          pxDolares: precioEnDolares,
          cotizacionDolar,
          pxVtaSugerido: fila.precioVentaSugerido || null,
          habilitado,
          ...(fila.marca !== undefined ? { marca: fila.marca } : {}),
        },
        update: {
          idProveedor: proveedorId,
          codProdProveedor: fila.codProdProv,
          descripcionProveedor: fila.descripcion,
          pxListaProveedor: fila.precioLista,
          pxDolares: precioEnDolares,
          cotizacionDolar,
          pxVtaSugerido: fila.precioVentaSugerido || null,
          habilitado,
          ...(fila.marca !== undefined ? { marca: fila.marca } : {}),
        },
      });

      if (existia) actualizados++;
      else creados++;
      // Para duplicados en el input: si lo creamos en esta corrida, luego debe contarse como "update".
      existentesCodProdSet.add(fila.codProdProv);
      codExtsMaterializar.push(codExt);
    } catch (e) {
      errores.push(`Fila ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (codExtsMaterializar.length > 0) {
    await materializarDescuentosEnFilas(codExtsMaterializar);
  }

  return { creados, actualizados, errores };
}

export interface CrearProductoListaPrecioServiceInput {
  idProveedor: string;
  codProdProveedor: string;
  descripcionProveedor: string;
  pxListaProveedor: number;
  marca?: string;
}

export type CrearProductoListaPrecioServiceResult =
  | { ok: true; codExt: string; creado: boolean }
  | { ok: false; error: string };

/**
 * Alta manual 1:1 en `prod_precios_provee` — misma clave y defaults que `upsertListaPrecios` (import CSV).
 */
export async function crearProductoListaPrecio(
  input: CrearProductoListaPrecioServiceInput
): Promise<CrearProductoListaPrecioServiceResult> {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: input.idProveedor },
    select: { id: true, prefijo: true, proveedorMercaderia: true },
  });

  if (!proveedor) {
    return { ok: false, error: "Proveedor no encontrado." };
  }
  if (!proveedor.proveedorMercaderia) {
    return { ok: false, error: "El proveedor no es de mercadería." };
  }
  const prefijo = proveedor.prefijo?.trim();
  if (!prefijo) {
    return { ok: false, error: "El proveedor no tiene prefijo configurado." };
  }

  const codProdProveedor = input.codProdProveedor.trim();
  const codExt = buildCodExt(prefijo, codProdProveedor);
  const marca = input.marca?.trim() || null;

  const existente = await prisma.listaPrecioProveedor.findUnique({
    where: {
      idProveedor_codProdProveedor: {
        idProveedor: input.idProveedor,
        codProdProveedor,
      },
    },
    select: { codExt: true },
  });

  try {
    await prisma.listaPrecioProveedor.upsert({
      where: {
        idProveedor_codProdProveedor: {
          idProveedor: input.idProveedor,
          codProdProveedor,
        },
      },
      create: {
        idProveedor: input.idProveedor,
        codProdProveedor,
        descripcionProveedor: input.descripcionProveedor.trim(),
        codExt,
        pxListaProveedor: input.pxListaProveedor,
        marca,
        habilitado: true,
        pxDolares: false,
        cotizacionDolar: 1,
      },
      update: {
        descripcionProveedor: input.descripcionProveedor.trim(),
        pxListaProveedor: input.pxListaProveedor,
        marca,
        habilitado: true,
      },
    });

    await materializarDescuentosEnFila(codExt);

    return { ok: true, codExt, creado: !existente };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo guardar el producto.";
    return { ok: false, error: message };
  }
}

/** Elimina un ítem de `prod_precios_provee` por `cod_ext`. Cascadas: dto extra / margen manual. */
export async function eliminarListaPrecioProveedor(
  codExt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.listaPrecioProveedor.delete({ where: { codExt } });
    return { ok: true };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2025") {
      return { ok: false, error: "El producto ya no existe en la lista." };
    }
    if (code === "P2003" || code === "P2014") {
      return {
        ok: false,
        error:
          "No se puede eliminar: el producto tiene datos vinculados que impiden el borrado.",
      };
    }
    const message = e instanceof Error ? e.message : "No se pudo eliminar el producto.";
    return { ok: false, error: message };
  }
}

export interface ActualizacionMasivaListaPrecios {
  marca?: string | null;
  rubro?: string | null;
  pxListaProveedor?: number;
  habilitado?: boolean;
  pxPromoFijo?: number | null;
}

/**
 * Actualiza campos editables manualmente en prod_precios_provee.
 * Los dto_* y cx_transporte solo los escribe el motor de reglas (`descuentosListaPrecioReglas.service`).
 * Si cambia marca o rubro, re-materializa descuentos en las filas afectadas.
 */
export async function actualizarListaPreciosMasivo(
  ids: string[],
  data: ActualizacionMasivaListaPrecios
): Promise<{ actualizados: number; error?: string }> {
  if (ids.length === 0) return { actualizados: 0 };

  const updatePayload: {
    marca?: string | null;
    rubro?: string | null;
    pxListaProveedor?: number;
    habilitado?: boolean;
    pxPromoFijo?: number | null;
  } = {};
  if (data.marca !== undefined) updatePayload.marca = data.marca;
  if (data.rubro !== undefined) updatePayload.rubro = data.rubro;
  if (data.pxListaProveedor !== undefined && data.pxListaProveedor >= 0)
    updatePayload.pxListaProveedor = data.pxListaProveedor;
  if (data.habilitado !== undefined) updatePayload.habilitado = data.habilitado;
  if (data.pxPromoFijo !== undefined) updatePayload.pxPromoFijo = data.pxPromoFijo;

  if (Object.keys(updatePayload).length === 0) return { actualizados: 0 };

  const setClauses: string[] = [];
  const params: (number | string | string[] | boolean | null)[] = [];
  if (updatePayload.marca !== undefined) {
    setClauses.push(`marca = $${params.length + 1}`);
    params.push(updatePayload.marca ?? null);
  }
  if (updatePayload.rubro !== undefined) {
    setClauses.push(`rubro = $${params.length + 1}`);
    params.push(updatePayload.rubro ?? null);
  }
  if (updatePayload.pxListaProveedor !== undefined) {
    setClauses.push(`px_lista_proveedor = $${params.length + 1}`);
    params.push(updatePayload.pxListaProveedor);
  }
  if (updatePayload.habilitado !== undefined) {
    setClauses.push(`habilitado = $${params.length + 1}`);
    params.push(updatePayload.habilitado);
  }
  if (updatePayload.pxPromoFijo !== undefined) {
    setClauses.push(`px_promo_fijo = $${params.length + 1}`);
    params.push(updatePayload.pxPromoFijo);
    setClauses.push(`cotizacion_dolar = CASE WHEN px_dolares THEN cotizacion_dolar ELSE 1 END`);
  }
  params.push(ids);

  try {
    const sql = `UPDATE prod_precios_provee SET ${setClauses.join(", ")} WHERE cod_ext = ANY($${params.length}::text[])`;
    const actualizados = await prisma.$executeRawUnsafe(sql, ...params);

    if (updatePayload.marca !== undefined || updatePayload.rubro !== undefined) {
      await materializarDescuentosEnFilas(ids);
    }

    return { actualizados: Number(actualizados) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { actualizados: 0, error: msg };
  }
}

function whereVariacionPxListaMasiva(
  proveedorId: string,
  marcaNombre?: string,
  rubroNombre?: string
): Prisma.ListaPrecioProveedorWhereInput {
  const andParts: Prisma.ListaPrecioProveedorWhereInput[] = [
    { proveedor: { proveedorMercaderia: true } },
    { idProveedor: proveedorId.trim() },
  ];
  aplicaFiltroMarcaRubro(andParts, "marca", marcaNombre);
  aplicaFiltroMarcaRubro(andParts, "rubro", rubroNombre);
  return { AND: andParts };
}

/** Conteo de filas que recibirán la variación masiva de `px_lista_proveedor`. */
export async function contarProductosParaVariacionPxLista(
  proveedorId: string,
  marcaNombre?: string,
  rubroNombre?: string
): Promise<number> {
  return prisma.listaPrecioProveedor.count({
    where: whereVariacionPxListaMasiva(proveedorId, marcaNombre, rubroNombre),
  });
}

/**
 * Aplica `variacion` % a `px_lista_proveedor`: `px * (1 + variacion/100)` (2 dec. en el %; resultado a 4 dec., piso 0).
 * Alcance: proveedor mercadería + marca/rubro opcionales (rubro solo con marca, validado en Zod).
 */
export async function aplicarVariacionPxListaProveedorMasivo(
  proveedorId: string,
  variacion: number,
  marcaNombre?: string,
  rubroNombre?: string
): Promise<{ actualizados: number; error?: string }> {
  const prov = proveedorId.trim();
  if (!prov) return { actualizados: 0, error: "El proveedor es obligatorio." };
  if (!Number.isFinite(variacion) || variacion === 0 || Math.abs(variacion) > 99.99) {
    return { actualizados: 0, error: "La variación debe ser un porcentaje distinto de 0 (hasta 99,99 %)." };
  }

  const marca = marcaNombre?.trim() || null;
  const rubro = rubroNombre?.trim() || null;

  try {
    const actualizados = await prisma.$executeRawUnsafe(
      `UPDATE prod_precios_provee p
       SET px_lista_proveedor = GREATEST(ROUND(p.px_lista_proveedor * (1 + $1::numeric / 100), 4), 0),
           updated_at = CURRENT_TIMESTAMP
       FROM global_proveedores g
       WHERE p.id_proveedor = g.id
         AND g.proveedor_mercaderia = true
         AND p.id_proveedor = $2
         AND ($3::text IS NULL OR p.marca = $3)
         AND ($4::text IS NULL OR p.rubro = $4)`,
      variacion,
      prov,
      marca,
      rubro
    );
    return { actualizados: Number(actualizados) };
  } catch (e) {
    console.error("[listaPrecios][aplicarVariacionPxListaProveedorMasivo]", e);
    return { actualizados: 0, error: "Error al aplicar la variación de precio." };
  }
}

// ─── Pedido Urgente: ítems con descripción unificada ─────────────────

export interface PedidoUrgenteItem {
  id: string;
  codExt: string;
  prefijo: string;
  descripcion: string;
  /** `px_compra_final_sin_iva` desde prod_precios_provee (modal de cantidad). */
  pxCompraFinalSinIva: number | null;
  /** En filas 1:1; ausente en fila agrupada por `cod_tienda`. */
  ivaProveedor?: IvaProveedor;
  /** Cantidad pedida (URGENTE): `prod_ped_merc.urgente_cant_pedir`. */
  cantPedidaUrgente: number;
  /** true si hay regla REPOSICIÓN en `prod_ped_merc` para el `cod_tienda`. */
  confReposicion: boolean;
  /**
   * Cantidad a pedir por reposición (columna **CANT. REPO.**): misma regla que **CANT. A PEDIR**
   * en Pedido Reposición (`cantPedirReposicionMerc2`: forma, punto, conf., stock, stockeable, bulto).
   */
  cantReposicion: number;
  /** true si el ítem de proveedor está vinculado a un producto en `prod_precios_tienda`. */
  estaVinculadoTienda: boolean;
  /**
   * Varias filas `prod_precios_provee` con el mismo `codTiendaVinculo`: la UI muestra una sola fila;
   * cada miembro conserva su `cod_ext` para persistir cantidades. Ausente en filas no agrupadas.
   */
  miembrosAgrupacion?: Array<{
    codExt: string;
    prefijo: string;
    pxCompraFinalSinIva: number | null;
    /** Política IVA del proveedor (`global_proveedores.iva`). */
    ivaProveedor: IvaProveedor;
    cantPedidaUrgente: number;
    estaVinculadoTienda: boolean;
  }>;
}

async function mercaderiaMapsDesdeMerc2(
  sucursalTrim: string,
  pairs: Array<{ idProveedor: string; codExt: string }>,
  codTiendasDesdeFilas: string[]
): Promise<{
  mercaderiaMapUrgente: Map<string, number>;
  mercaderiaRepoSet: Set<string>;
  mercaderiaMapRepo: Map<string, number>;
}> {
  const mercaderiaMapUrgente = new Map<string, number>();
  const mercaderiaRepoSet = new Set<string>();
  const mercaderiaMapRepo = new Map<string, number>();

  const suc = await prisma.sucursal.findUnique({
    where: { codigo: sucursalTrim },
    select: { id: true },
  });
  if (!suc) {
    return { mercaderiaMapUrgente, mercaderiaRepoSet, mercaderiaMapRepo };
  }

  const codExts = [...new Set(pairs.map((p) => (p.codExt ?? "").trim()).filter(Boolean))];
  const codTiendas = [...new Set(codTiendasDesdeFilas.map((c) => c.trim()).filter(Boolean))];

  const orParts: Prisma.ProdPedMerc2WhereInput[] = [];
  if (codExts.length > 0) {
    orParts.push({
      tipoDePedido: TIPO_URGENTE_MERC2,
      urgenteCodExt: { in: codExts },
    });
  }
  if (codTiendas.length > 0) {
    orParts.push({
      tipoDePedido: "REPOSICION",
      reposicionCodTienda: { in: codTiendas },
    });
  }

  if (orParts.length === 0) {
    return { mercaderiaMapUrgente, mercaderiaRepoSet, mercaderiaMapRepo };
  }

  const rows = await prisma.prodPedMerc2.findMany({
    where: {
      sucursalId: suc.id,
      OR: orParts,
    },
    orderBy: [{ id: "desc" }],
    select: {
      tipoDePedido: true,
      urgenteCodExt: true,
      urgenteCantPedir: true,
      reposicionCodTienda: true,
      reposicionFormaPedido: true,
      reposicionPuntoPedido: true,
      reposicionCantConf: true,
    },
  });

  const reposicionReglaPorCodTienda = new Map<
    string,
    { forma: string | null; punto: number; cantConf: number }
  >();

  const cantUrgentePorCodExt = new Map<string, number>();
  for (const r of rows) {
    if (r.tipoDePedido === TIPO_URGENTE_MERC2 && r.urgenteCodExt?.trim()) {
      cantUrgentePorCodExt.set(
        r.urgenteCodExt.trim(),
        Math.max(0, Number(r.urgenteCantPedir ?? 0))
      );
    }
    if (r.tipoDePedido === "REPOSICION") {
      const k = (r.reposicionCodTienda ?? "").trim();
      if (!k || reposicionReglaPorCodTienda.has(k)) continue;
      mercaderiaRepoSet.add(k);
      reposicionReglaPorCodTienda.set(k, {
        forma: r.reposicionFormaPedido,
        punto: Math.max(0, Math.floor(Number(r.reposicionPuntoPedido ?? 0))),
        cantConf: Math.max(0, Math.floor(Number(r.reposicionCantConf ?? 0))),
      });
    }
  }

  const codTiendasRepo = [...mercaderiaRepoSet];
  const tiendaRowsRepo =
    codTiendasRepo.length > 0
      ? await prisma.prodTienda.findMany({
          where: { codTienda: { in: codTiendasRepo } },
          select: {
            codTienda: true,
            bulto: true,
          },
        })
      : [];
  const tiendaRepoPorCod = new Map(
    tiendaRowsRepo.map((t) => [t.codTienda.trim(), t])
  );
  const [stockMapsRepo, stockeableMapRepo] =
    codTiendasRepo.length > 0
      ? await Promise.all([
          buildMapsStockSucursalesPrincipales(codTiendasRepo),
          buildMapStockeable(codTiendasRepo),
        ])
      : [
          { maipu: new Map<string, number>(), guaymallen: new Map<string, number>() },
          new Map<string, boolean>(),
        ];

  for (const k of mercaderiaRepoSet) {
    const regla = reposicionReglaPorCodTienda.get(k);
    const tienda = tiendaRepoPorCod.get(k);
    let cant = 0;
    if (regla && tienda) {
      const stock = getStockSucursalPrincipal(k, sucursalTrim, stockMapsRepo);
      cant = cantPedirReposicionMerc2({
        forma: regla.forma,
        punto: regla.punto,
        cantConf: regla.cantConf,
        stock,
        stockeable: getStockeableFromMap(stockeableMapRepo, k),
        bulto: bultoProdTiendaValido(tienda.bulto),
      });
    }
    mercaderiaMapRepo.set(k, cant);
  }

  for (const p of pairs) {
    const ce = (p.codExt ?? "").trim();
    if (!ce) continue;
    const u = cantUrgentePorCodExt.get(ce);
    if (u == null || u <= 0) continue;
    mercaderiaMapUrgente.set(`${p.idProveedor}:${ce}`, u);
    mercaderiaMapUrgente.set(ce, u);
  }

  return { mercaderiaMapUrgente, mercaderiaRepoSet, mercaderiaMapRepo };
}

/**
 * Una sola descripción de **tienda** para la fila agrupada: toma `descripcion_tienda` de la relación
 * `prodTienda` vía `cod_tienda_vinculo`; si hay textos distintos, se usa el **más largo** (suele ser la ficha completa).
 * Solo si no hay ninguna descripción de tienda se recurre a `descripcion_proveedor`.
 */
function descripcionTiendaUnificadaParaGrupoPedidoUrgente(
  memberFilas: Array<{
    descripcionProveedor: string;
    prodTienda: { descripcionTienda: string | null } | null;
  }>
): string {
  const candidates: string[] = [];
  for (const f of memberFilas) {
    const rel = f.prodTienda?.descripcionTienda?.trim();
    if (rel) candidates.push(rel);
  }
  const uniqTienda = [...new Set(candidates.filter((c) => c.length > 0))];
  if (uniqTienda.length > 0) {
    return [...uniqTienda].sort((a, b) => b.length - a.length)[0]!;
  }
  const provDescs = memberFilas
    .map((f) => f.descripcionProveedor?.trim())
    .filter((d): d is string => Boolean(d));
  const uniqProv = [...new Set(provDescs)];
  if (uniqProv.length > 0) {
    return [...uniqProv].sort((a, b) => b.length - a.length)[0]!;
  }
  return "";
}

/**
 * Claves con cantidad a pedir &gt; 0 para el filtro **PEDIDO** de Pedido Urgente.
 * Urgente: `urgente_cant_pedir &gt; 0`. Reposición: cant. calculada (`cantPedirReposicionMerc2`) &gt; 0.
 */
async function clavesCantidadPositivaPedidoUrgente(
  sucursalTrim: string,
  pedidoTipo: "urgente" | "reposicion" | "cualquier"
): Promise<{ urgenteCodExts: Set<string>; repoCodTiendas: Set<string> }> {
  const urgenteCodExts = new Set<string>();
  const repoCodTiendas = new Set<string>();

  const suc = await prisma.sucursal.findUnique({
    where: { codigo: sucursalTrim },
    select: { id: true },
  });
  if (!suc) return { urgenteCodExts, repoCodTiendas };

  if (pedidoTipo === "urgente" || pedidoTipo === "cualquier") {
    const rows = await prisma.prodPedMerc2.findMany({
      where: {
        sucursalId: suc.id,
        tipoDePedido: TIPO_URGENTE_MERC2,
        urgenteCantPedir: { gt: 0 },
      },
      select: { urgenteCodExt: true },
    });
    for (const r of rows) {
      const c = (r.urgenteCodExt ?? "").trim();
      if (c) urgenteCodExts.add(c);
    }
  }

  if (pedidoTipo === "reposicion" || pedidoTipo === "cualquier") {
    const rows = await prisma.prodPedMerc2.findMany({
      where: {
        sucursalId: suc.id,
        tipoDePedido: "REPOSICION",
      },
      orderBy: [{ id: "desc" }],
      select: {
        reposicionCodTienda: true,
        reposicionFormaPedido: true,
        reposicionPuntoPedido: true,
        reposicionCantConf: true,
      },
    });

    const reglaPorCod = new Map<
      string,
      { forma: string | null; punto: number; cantConf: number }
    >();
    for (const r of rows) {
      const k = (r.reposicionCodTienda ?? "").trim();
      if (!k || reglaPorCod.has(k)) continue;
      reglaPorCod.set(k, {
        forma: r.reposicionFormaPedido,
        punto: Math.max(0, Math.floor(Number(r.reposicionPuntoPedido ?? 0))),
        cantConf: Math.max(0, Math.floor(Number(r.reposicionCantConf ?? 0))),
      });
    }

    const codTiendas = [...reglaPorCod.keys()];
    if (codTiendas.length > 0) {
      const [stockMaps, stockeableMap, bultosMap] = await Promise.all([
        buildMapsStockSucursalesPrincipales(codTiendas),
        buildMapStockeable(codTiendas),
        buildMapBultosProdTienda(codTiendas),
      ]);
      for (const k of codTiendas) {
        const regla = reglaPorCod.get(k)!;
        const stock = getStockSucursalPrincipal(k, sucursalTrim, stockMaps);
        const cant = cantPedirReposicionMerc2({
          forma: regla.forma,
          punto: regla.punto,
          cantConf: regla.cantConf,
          stock,
          stockeable: getStockeableFromMap(stockeableMap, k),
          bulto: bultosMap.get(k) ?? null,
        });
        if (cant > 0) repoCodTiendas.add(k);
      }
    }
  }

  return { urgenteCodExts, repoCodTiendas };
}

/**
 * Pantalla Pedido Urgente: filas **`prod_precios_provee`** con **`habilitado = true`**.
 * Varias filas con el mismo **`codTiendaVinculo`** se agrupan en **una sola fila** de UI (`id` `agrup-tienda:{cod_tienda}`, `miembrosAgrupacion`);
 * la paginación y el **`total`** cuentan **grupos** (fila vista), no filas crudas. Filas sin vínculo a tienda siguen 1:1 por `cod_ext`.
 * Filtro **`proveedorId`**: solo reduce qué **grupos/filas** entran al listado (al menos un miembro del grupo coincide); **`miembrosAgrupacion`** sigue incluyendo **todos** los proveedores del vínculo para el modal «Elegir Proveedor».
 * Filtro **`pedidoTipo`**: `urgente` / `reposicion` / `cualquier` = solo grupos con cant. &gt; 0 en ese tipo (o en cualquiera); `null` = catálogo completo.
 * `prefijo` vacío en la fila agrupada; **`descripcion`** unifica **`descripcion_tienda`** entre miembros.
 * Cantidades / flags de urgente y reposición se leen de **`prod_ped_merc`** según sucursal.
 */
async function getListaPedidoUrgenteDesdeListaPrecios(
  sucursalTrim: string,
  prov: string | undefined,
  busqueda: string,
  pageSize: number,
  paginaNum: number,
  pedidoTipo: "urgente" | "reposicion" | "cualquier" | null
): Promise<{
  items: PedidoUrgenteItem[];
  total: number;
  totalPaginas: number;
}> {
  const sucursalRow = await prisma.sucursal.findUnique({
    where: { codigo: sucursalTrim },
    select: { id: true },
  });
  if (!sucursalRow) {
    return { items: [], total: 0, totalPaginas: 1 };
  }

  let urgenteCodExtsFiltro: Set<string> | null = null;
  let repoCodTiendasFiltro: Set<string> | null = null;
  if (pedidoTipo) {
    const claves = await clavesCantidadPositivaPedidoUrgente(sucursalTrim, pedidoTipo);
    urgenteCodExtsFiltro = claves.urgenteCodExts;
    repoCodTiendasFiltro = claves.repoCodTiendas;
    if (
      (pedidoTipo === "urgente" && urgenteCodExtsFiltro.size === 0) ||
      (pedidoTipo === "reposicion" && repoCodTiendasFiltro.size === 0) ||
      (pedidoTipo === "cualquier" &&
        urgenteCodExtsFiltro.size === 0 &&
        repoCodTiendasFiltro.size === 0)
    ) {
      return { items: [], total: 0, totalPaginas: 1 };
    }
  }

  const listaWhereBaseParts: Prisma.ListaPrecioProveedorWhereInput[] = [{ habilitado: true }];

  /**
   * Con filtro PEDIDO: no cargar el catálogo completo. Semillas = filas con cant. &gt; 0;
   * se expanden a todo el grupo `codTiendaVinculo` para el modal Elegir Proveedor.
   */
  if (pedidoTipo && urgenteCodExtsFiltro && repoCodTiendasFiltro) {
    const orSeed: Prisma.ListaPrecioProveedorWhereInput[] = [];

    if (
      (pedidoTipo === "urgente" || pedidoTipo === "cualquier") &&
      urgenteCodExtsFiltro.size > 0
    ) {
      const codExtsUrg = [...urgenteCodExtsFiltro];
      const seedsUrg = await prisma.listaPrecioProveedor.findMany({
        where: { habilitado: true, codExt: { in: codExtsUrg } },
        select: { codExt: true, codTiendaVinculo: true },
      });
      const vinculosUrg = [
        ...new Set(
          seedsUrg
            .map((s) => s.codTiendaVinculo?.trim() ?? "")
            .filter((v) => v.length > 0)
        ),
      ];
      if (vinculosUrg.length > 0) {
        orSeed.push({ codTiendaVinculo: { in: vinculosUrg } });
      }
      orSeed.push({ codExt: { in: codExtsUrg } });
    }

    if (
      (pedidoTipo === "reposicion" || pedidoTipo === "cualquier") &&
      repoCodTiendasFiltro.size > 0
    ) {
      const tiendas = [...repoCodTiendasFiltro];
      orSeed.push({ codTiendaVinculo: { in: tiendas } });
      orSeed.push({ prodTienda: { codTienda: { in: tiendas } } });
    }

    if (orSeed.length === 0) {
      return { items: [], total: 0, totalPaginas: 1 };
    }
    listaWhereBaseParts.push({ OR: orSeed });
  }

  if (busqueda.length >= 3) {
    const tokens = busqueda.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      listaWhereBaseParts.push({
        AND: tokens.map((token) => ({
          OR: [
            { descripcionProveedor: { contains: token, mode: "insensitive" as const } },
            { codExt: { contains: token, mode: "insensitive" as const } },
            {
              prodTienda: {
                descripcionTienda: { contains: token, mode: "insensitive" as const },
              },
            },
          ],
        })),
      });
    }
  }
  const listaWhereBase: Prisma.ListaPrecioProveedorWhereInput =
    listaWhereBaseParts.length === 1 ? listaWhereBaseParts[0]! : { AND: listaWhereBaseParts };

  const includeListaPedidoUrgente = {
    proveedor: { select: { id: true, nombre: true, prefijo: true, iva: true } },
    prodTienda: { select: { codTienda: true, descripcionTienda: true } },
  } as const;

  /** Meta: conserva todos los miembros del grupo por `codTiendaVinculo`. */
  const meta = await prisma.listaPrecioProveedor.findMany({
    where: listaWhereBase,
    select: { codExt: true, codTiendaVinculo: true, idProveedor: true },
    orderBy: [{ codTiendaVinculo: "asc" }, { codExt: "asc" }],
  });

  const codExtToProveedor = new Map<string, string>();
  const groupKeyToCodExts = new Map<string, string[]>();
  for (const row of meta) {
    codExtToProveedor.set(row.codExt, row.idProveedor);
    const ct = row.codTiendaVinculo?.trim();
    const key = ct ? `T:${ct}` : `E:${row.codExt}`;
    const arr = groupKeyToCodExts.get(key) ?? [];
    arr.push(row.codExt);
    groupKeyToCodExts.set(key, arr);
  }
  for (const arr of groupKeyToCodExts.values()) {
    arr.sort((a, b) => a.localeCompare(b));
  }

  let sortedKeys = [...groupKeyToCodExts.keys()].sort((ka, kb) => {
    const a0 = groupKeyToCodExts.get(ka)![0]!;
    const b0 = groupKeyToCodExts.get(kb)![0]!;
    return a0.localeCompare(b0);
  });

  /** Seguridad: el grupo debe tener al menos una semilla con cant. &gt; 0 del tipo filtrado. */
  if (pedidoTipo && urgenteCodExtsFiltro && repoCodTiendasFiltro) {
    sortedKeys = sortedKeys.filter((k) => {
      const cods = groupKeyToCodExts.get(k)!;
      const tieneUrgente = cods.some((ce) => urgenteCodExtsFiltro!.has(ce));
      const codTiendaVinculo = k.startsWith("T:") ? k.slice(2) : "";
      const tieneRepo =
        Boolean(codTiendaVinculo) && repoCodTiendasFiltro!.has(codTiendaVinculo);
      if (pedidoTipo === "urgente") return tieneUrgente;
      if (pedidoTipo === "reposicion") return tieneRepo;
      return tieneUrgente || tieneRepo;
    });
  }

  if (prov) {
    sortedKeys = sortedKeys.filter((k) => {
      const cods = groupKeyToCodExts.get(k)!;
      return cods.some((ce) => codExtToProveedor.get(ce) === prov);
    });
  }

  const total = sortedKeys.length;
  const totalPaginasLista = total <= 0 ? 1 : Math.ceil(total / pageSize);
  if (total === 0) {
    return { items: [], total: 0, totalPaginas: 1 };
  }

  const skip = (Math.max(1, paginaNum) - 1) * pageSize;
  const pageKeys = sortedKeys.slice(skip, skip + pageSize);
  const codExtSet = new Set<string>();
  for (const k of pageKeys) {
    for (const ce of groupKeyToCodExts.get(k)!) {
      codExtSet.add(ce);
    }
  }

  const filas = await prisma.listaPrecioProveedor.findMany({
    where: { AND: [{ habilitado: true }, { codExt: { in: [...codExtSet] } }] },
    include: includeListaPedidoUrgente,
    orderBy: [{ codTiendaVinculo: "asc" }, { codExt: "asc" }],
  });

  if (filas.length === 0) {
    return { items: [], total, totalPaginas: totalPaginasLista };
  }

  const pairs = filas.map((f) => ({ idProveedor: f.idProveedor, codExt: f.codExt }));
  const { mercaderiaMapUrgente, mercaderiaRepoSet, mercaderiaMapRepo } =
    pairs.length > 0
      ? await mercaderiaMapsDesdeMerc2(
          sucursalTrim,
          pairs,
          filas.map((f) => f.prodTienda?.codTienda?.trim() ?? "").filter(Boolean)
        )
      : {
          mercaderiaMapUrgente: new Map<string, number>(),
          mercaderiaRepoSet: new Set<string>(),
          mercaderiaMapRepo: new Map<string, number>(),
        };

  const filaByCodExt = new Map(filas.map((f) => [f.codExt, f]));
  type FilaU = (typeof filas)[number];

  function itemDesdeFila(f: FilaU): PedidoUrgenteItem {
    const ce = (f.codExt ?? "").trim();
    const keyProv = `${f.idProveedor}:${ce}`;
    const descTienda = f.prodTienda?.descripcionTienda?.trim() || null;
    const cantUrgenteUi =
      mercaderiaMapUrgente.get(keyProv) ?? mercaderiaMapUrgente.get(ce) ?? 0;
    const tiendaListaId = f.codTiendaVinculo ?? null;

    return {
      id: f.codExt,
      codExt: f.codExt,
      prefijo: f.proveedor?.prefijo ?? "",
      descripcion: (descTienda && descTienda) || f.descripcionProveedor,
      pxCompraFinalSinIva: f.pxCompraFinalSinIva != null ? Number(f.pxCompraFinalSinIva) : null,
      ivaProveedor: f.proveedor.iva,
      cantPedidaUrgente: Math.max(0, Math.floor(cantUrgenteUi)),
      confReposicion: mercaderiaRepoSet.has(f.prodTienda?.codTienda?.trim() ?? ""),
      cantReposicion: mercaderiaMapRepo.get(f.prodTienda?.codTienda?.trim() ?? "") ?? 0,
      estaVinculadoTienda: tiendaListaId != null,
    };
  }

  const items: PedidoUrgenteItem[] = [];
  for (const key of pageKeys) {
    const codExtsGrupo = groupKeyToCodExts.get(key)!;
    const memberFilas = codExtsGrupo
      .map((ce) => filaByCodExt.get(ce))
      .filter((x): x is FilaU => x != null);
    if (memberFilas.length === 0) continue;
    if (memberFilas.length === 1) {
      const unico = itemDesdeFila(memberFilas[0]!);
      if (pedidoTipo === "urgente" && unico.cantPedidaUrgente <= 0) continue;
      if (pedidoTipo === "reposicion" && unico.cantReposicion <= 0) continue;
      if (
        pedidoTipo === "cualquier" &&
        unico.cantPedidaUrgente <= 0 &&
        unico.cantReposicion <= 0
      ) {
        continue;
      }
      items.push(unico);
      continue;
    }
    const codTienda = memberFilas[0]!.codTiendaVinculo?.trim();
    if (!codTienda) {
      for (const mf of memberFilas) {
        const it = itemDesdeFila(mf);
        if (pedidoTipo === "urgente" && it.cantPedidaUrgente <= 0) continue;
        if (pedidoTipo === "reposicion" && it.cantReposicion <= 0) continue;
        if (
          pedidoTipo === "cualquier" &&
          it.cantPedidaUrgente <= 0 &&
          it.cantReposicion <= 0
        ) {
          continue;
        }
        items.push(it);
      }
      continue;
    }
    const memberItems = memberFilas.map(itemDesdeFila);
    const cantUrgenteGrupo = memberItems.reduce((s, x) => s + x.cantPedidaUrgente, 0);
    const cantRepoGrupo = memberItems[0]!.cantReposicion;
    if (pedidoTipo === "urgente" && cantUrgenteGrupo <= 0) continue;
    if (pedidoTipo === "reposicion" && cantRepoGrupo <= 0) continue;
    if (pedidoTipo === "cualquier" && cantUrgenteGrupo <= 0 && cantRepoGrupo <= 0) {
      continue;
    }
    const descripcionGrupo = descripcionTiendaUnificadaParaGrupoPedidoUrgente(memberFilas);
    items.push({
      id: `agrup-tienda:${codTienda}`,
      codExt: memberItems[0]!.codExt,
      prefijo: "",
      descripcion: descripcionGrupo,
      pxCompraFinalSinIva: null,
      cantPedidaUrgente: cantUrgenteGrupo,
      confReposicion: memberItems[0]!.confReposicion,
      cantReposicion: cantRepoGrupo,
      estaVinculadoTienda: true,
      miembrosAgrupacion: memberItems.map((i) => ({
        codExt: i.codExt,
        prefijo: i.prefijo,
        pxCompraFinalSinIva: i.pxCompraFinalSinIva,
        ivaProveedor: i.ivaProveedor ?? IvaProveedor.PREGUNTA,
        cantPedidaUrgente: i.cantPedidaUrgente,
        estaVinculadoTienda: i.estaVinculadoTienda,
      })),
    });
  }

  return { items, total, totalPaginas: totalPaginasLista };
}

/**
 * Ítems de lista precios para la pantalla Pedido Urgente.
 * Solo devuelve datos si sucursal está informada.
 * descripcion = descripcion_tienda si existe; si no, descripcion_proveedor.
 * incluye `pxCompraFinalSinIva` para el modal de cantidad.
 */
export async function getListaPreciosParaPedidoUrgente(
  sucursal: string,
  proveedorId: string | undefined,
  pedidoTipo: "cualquier" | "urgente" | "reposicion" | undefined,
  q: string | undefined,
  pagina: number | undefined,
  pageSize: number | undefined
): Promise<{
  items: PedidoUrgenteItem[];
  total: number;
  totalPaginas: number;
}> {
  const sucursalTrim = sucursal?.trim() ?? "";
  if (!sucursalTrim) {
    return { items: [], total: 0, totalPaginas: 0 };
  }

  const prov = proveedorId?.trim() || undefined;
  const busqueda = q?.trim() ?? "";
  const takeSize = pageSize ?? 100;
  const paginaNum = Math.max(1, pagina ?? 1);

  /** Sin filtro PEDIDO: catálogo completo. Con filtro: solo cant. &gt; 0 del tipo elegido. */
  const filtroPedido: "urgente" | "reposicion" | "cualquier" | null =
    pedidoTipo === "urgente" ||
    pedidoTipo === "reposicion" ||
    pedidoTipo === "cualquier"
      ? pedidoTipo
      : null;

  return getListaPedidoUrgenteDesdeListaPrecios(
    sucursalTrim,
    prov,
    busqueda,
    takeSize,
    paginaNum,
    filtroPedido
  );
}

/** Proveedores con al menos un ítem en lista de precios (para filtro Pedido Urgente). */
export async function getProveedoresParaPedidoUrgente(): Promise<
  { id: string; nombre: string; prefijo: string }[]
> {
  const list = await prisma.proveedor.findMany({
    where: {
      proveedorMercaderia: true,
      listaPrecios: { some: { habilitado: true } },
    },
    select: { id: true, nombre: true, prefijo: true },
    orderBy: { prefijo: "asc" },
  });
  return list.map((p) => ({ ...p, prefijo: p.prefijo ?? "" }));
}
