import type { CampoReglaDescuentoListaPrecio } from "@prisma/client";

import { clampPercent } from "@/lib/calculos";
import { prisma } from "@/lib/prisma";
import { listarRubrosCatalogoReglasDesdeProdTienda } from "@/services/rubrosProdTienda.service";
import type {
  ActualizarReglaDescuentoListaPrecioInput,
  CampoReglaDescuentoListaPrecioInput,
  CrearReglaDescuentoListaPrecioInput,
} from "@/lib/validations/descuentosListaPrecioReglas";
import {
  CAMPO_PX_PROMO_FIJO,
  type CampoDescuentoActivoListaPrecio,
  type DescuentosMaterializadosItem,
} from "@/lib/descuentosListaPrecioReglasConstants";
import type { ServiceResult } from "@/types/service.types";

/** Re-export para handoff UI (BACKEND_GUIDELINES § Reglas descuentos lista precios). */
export type { CampoReglaDescuentoListaPrecioInput as CampoReglaDescuentoListaPrecio };
export {
  CAMPO_DESC_ESPECIAL,
  CAMPO_PX_PROMO_FIJO,
  type CampoDescuentoActivoListaPrecio,
  type DescuentosMaterializadosItem,
} from "@/lib/descuentosListaPrecioReglasConstants";

export interface ItemParaResolverDescuentos {
  idProveedor: string;
  marca: string | null;
  rubro: string | null;
}

export interface ReglaDescuentoListaPrecio {
  id: string;
  campo: CampoReglaDescuentoListaPrecioInput;
  valor: number;
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
  proveedorNombre: string | null;
  proveedorPrefijo: string | null;
  marcaNombre: string | null;
  rubroNombre: string | null;
  especificidad: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogosReglasDescuentosListaPrecio {
  proveedores: { id: string; nombre: string; prefijo: string | null }[];
  marcas: { id: string; nombre: string }[];
  rubros: { id: string; nombre: string }[];
}

interface CondicionesRegla {
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
}

interface ReglaInterna extends CondicionesRegla {
  id: string;
  campo: CampoReglaDescuentoListaPrecio;
  valor: number;
}

interface CatalogosResolver {
  marcasPorId: Map<string, string>;
  rubrosPorId: Map<string, string>;
}

const CAMPOS_RESOLVER: CampoReglaDescuentoListaPrecio[] = [
  "dto_proveedor",
  "dto_marca",
  "dto_rubro",
  "dto_cantidad",
  "dto_financiero",
  "cx_transporte",
];

const CAMPO_A_PROPIEDAD: Record<
  CampoReglaDescuentoListaPrecio,
  keyof DescuentosMaterializadosItem
> = {
  dto_proveedor: "dtoProveedor",
  dto_marca: "dtoMarca",
  dto_rubro: "dtoRubro",
  dto_cantidad: "dtoCantidad",
  dto_financiero: "dtoFinanciero",
  cx_transporte: "cxTransporte",
};

const CHUNK_MATERIALIZACION = 500;

/** Normalización para matching ítem ↔ catálogo (trim + case-insensitive). */
export function normalizarTextoCondicionRegla(texto: string | null | undefined): string {
  return (texto ?? "").trim().toLocaleLowerCase("es");
}

export function especificidadRegla(condiciones: CondicionesRegla): number {
  return (
    (condiciones.idProveedor ? 1 : 0) +
    (condiciones.idMarca ? 1 : 0) +
    (condiciones.idRubro ? 1 : 0)
  );
}

/** Dos reglas pueden matchear el mismo ítem si sus condiciones no se contradicen en ningún eje. */
export function reglasDescuentoSeSolapan(a: CondicionesRegla, b: CondicionesRegla): boolean {
  const proveedorOk =
    a.idProveedor == null || b.idProveedor == null || a.idProveedor === b.idProveedor;
  const marcaOk = a.idMarca == null || b.idMarca == null || a.idMarca === b.idMarca;
  const rubroOk = a.idRubro == null || b.idRubro == null || a.idRubro === b.idRubro;
  return proveedorOk && marcaOk && rubroOk;
}

function condicionesIguales(a: CondicionesRegla, b: CondicionesRegla): boolean {
  return (
    a.idProveedor === b.idProveedor &&
    a.idMarca === b.idMarca &&
    a.idRubro === b.idRubro
  );
}

function reglaMatcheaItem(
  regla: ReglaInterna,
  item: ItemParaResolverDescuentos,
  catalogos: CatalogosResolver
): boolean {
  if (regla.idProveedor != null && regla.idProveedor !== item.idProveedor) {
    return false;
  }

  if (regla.idMarca != null) {
    const nombreMarca = catalogos.marcasPorId.get(regla.idMarca);
    if (!nombreMarca) return false;
    const marcaItem = normalizarTextoCondicionRegla(item.marca);
    if (!marcaItem) return false;
    if (marcaItem !== normalizarTextoCondicionRegla(nombreMarca)) return false;
  }

  if (regla.idRubro != null) {
    const nombreRubro = catalogos.rubrosPorId.get(regla.idRubro);
    if (!nombreRubro) return false;
    const rubroItem = normalizarTextoCondicionRegla(item.rubro);
    if (!rubroItem) return false;
    if (rubroItem !== normalizarTextoCondicionRegla(nombreRubro)) return false;
  }

  return true;
}

function resolverReglaGanadoraCampo(
  campo: CampoReglaDescuentoListaPrecio,
  item: ItemParaResolverDescuentos,
  reglasPorCampo: Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>,
  catalogos: CatalogosResolver
): ReglaInterna | null {
  const reglas = reglasPorCampo.get(campo) ?? [];
  let mejor: ReglaInterna | null = null;
  let mejorEspecificidad = -1;

  for (const regla of reglas) {
    if (!reglaMatcheaItem(regla, item, catalogos)) continue;
    const esp = especificidadRegla(regla);
    if (esp > mejorEspecificidad) {
      mejor = regla;
      mejorEspecificidad = esp;
    }
  }

  return mejor;
}

function resolverValorCampo(
  campo: CampoReglaDescuentoListaPrecio,
  item: ItemParaResolverDescuentos,
  reglasPorCampo: Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>,
  catalogos: CatalogosResolver
): number {
  const regla = resolverReglaGanadoraCampo(campo, item, reglasPorCampo, catalogos);
  return regla ? clampPercent(regla.valor) : 0;
}

export interface ReglaDescuentoAplicadaResumen {
  id: string;
  campo: CampoReglaDescuentoListaPrecioInput;
  valor: number;
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
  proveedorNombre: string | null;
  marcaNombre: string | null;
  rubroNombre: string | null;
  especificidad: number;
}

export interface ReglaDescuentoEspecificaResumen {
  id: string;
  nombre: string;
  valor: number;
}

export interface DescuentoActivoListaPrecio {
  campo: CampoDescuentoActivoListaPrecio;
  etiquetaCorta: string;
  label: string;
  tipo: "descuento" | "costo";
  valor: number;
  regla: ReglaDescuentoAplicadaResumen | null;
  reglaEspecifica: ReglaDescuentoEspecificaResumen | null;
}

const METADATA_CAMPOS_DESCUENTO_UI = [
  {
    campo: "dto_proveedor" as const,
    etiquetaCorta: "Prov.",
    label: "DESC. PROV.",
    tipo: "descuento" as const,
    propiedad: "dtoProveedor" as const,
  },
  {
    campo: "dto_marca" as const,
    etiquetaCorta: "Marca",
    label: "DESC. MARCA",
    tipo: "descuento" as const,
    propiedad: "dtoMarca" as const,
  },
  {
    campo: "dto_rubro" as const,
    etiquetaCorta: "Rubro",
    label: "DESC. RUBRO",
    tipo: "descuento" as const,
    propiedad: "dtoRubro" as const,
  },
  {
    campo: "dto_cantidad" as const,
    etiquetaCorta: "Cant.",
    label: "DESC. CANT.",
    tipo: "descuento" as const,
    propiedad: "dtoCantidad" as const,
  },
  {
    campo: "dto_financiero" as const,
    etiquetaCorta: "Finan.",
    label: "DESC. FINAN.",
    tipo: "descuento" as const,
    propiedad: "dtoFinanciero" as const,
  },
  {
    campo: "cx_transporte" as const,
    etiquetaCorta: "Transp.",
    label: "CX. TRANSP.",
    tipo: "costo" as const,
    propiedad: "cxTransporte" as const,
  },
] satisfies {
  campo: CampoReglaDescuentoListaPrecio;
  etiquetaCorta: string;
  label: string;
  tipo: "descuento" | "costo";
  propiedad: keyof DescuentosMaterializadosItem;
}[];

function mapReglaInternaAResumen(
  regla: ReglaInterna,
  catalogos: CatalogosResolver,
  proveedoresPorId: Map<string, string>
): ReglaDescuentoAplicadaResumen {
  return {
    id: regla.id,
    campo: regla.campo,
    valor: clampPercent(regla.valor),
    idProveedor: regla.idProveedor,
    idMarca: regla.idMarca,
    idRubro: regla.idRubro,
    proveedorNombre: regla.idProveedor
      ? (proveedoresPorId.get(regla.idProveedor) ?? null)
      : null,
    marcaNombre: regla.idMarca ? (catalogos.marcasPorId.get(regla.idMarca) ?? null) : null,
    rubroNombre: regla.idRubro ? (catalogos.rubrosPorId.get(regla.idRubro) ?? null) : null,
    especificidad: especificidadRegla(regla),
  };
}

export function resolverDescuentosActivosParaItem(
  item: ItemParaResolverDescuentos,
  valores: DescuentosMaterializadosItem,
  reglasPorCampo: Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>,
  catalogos: CatalogosResolver,
  proveedoresPorId: Map<string, string>
): DescuentoActivoListaPrecio[] {
  const activos: DescuentoActivoListaPrecio[] = [];

  for (const meta of METADATA_CAMPOS_DESCUENTO_UI) {
    const valor = valores[meta.propiedad];
    if (!(valor > 0)) continue;

    const reglaGanadora = resolverReglaGanadoraCampo(
      meta.campo,
      item,
      reglasPorCampo,
      catalogos
    );

    activos.push({
      campo: meta.campo,
      etiquetaCorta: meta.etiquetaCorta,
      label: meta.label,
      tipo: meta.tipo,
      valor,
      regla: reglaGanadora
        ? mapReglaInternaAResumen(reglaGanadora, catalogos, proveedoresPorId)
        : null,
      reglaEspecifica: null,
    });
  }

  return activos;
}

/** Resuelve descuentos activos (> 0) y la regla ganadora por campo para filas de lista precios. */
export async function enriquecerFilasConDescuentosActivos<
  TFila extends {
    codExt: string;
    marca: string | null;
    rubro: string | null;
    proveedor: { id: string } | null;
    dtoProveedor: number;
    dtoMarca: number;
    dtoRubro: number;
    dtoCantidad: number;
    dtoFinanciero: number;
    cxTransporte: number;
    descEspecial: number;
    pxPromoFijo?: number | null;
  },
>(filas: TFila[]): Promise<(TFila & { descuentosActivos: DescuentoActivoListaPrecio[] })[]> {
  if (filas.length === 0) return [];

  const [reglasPorCampo, catalogos, proveedores, reglasEspecPorCodExt] = await Promise.all([
    cargarReglasAgrupadasPorCampo(),
    cargarCatalogosResolver(),
    prisma.proveedor.findMany({ select: { id: true, nombre: true } }),
    cargarReglasEspecialesPorCodExt(
      filas.filter((f) => f.descEspecial > 0).map((f) => f.codExt)
    ),
  ]);

  const proveedoresPorId = new Map(proveedores.map((p) => [p.id, p.nombre]));

  return filas.map((fila) => {
    const idProveedor = fila.proveedor?.id;
    if (!idProveedor) {
      return { ...fila, descuentosActivos: [] };
    }

    const valores: DescuentosMaterializadosItem = {
      dtoProveedor: fila.dtoProveedor,
      dtoMarca: fila.dtoMarca,
      dtoRubro: fila.dtoRubro,
      dtoCantidad: fila.dtoCantidad,
      dtoFinanciero: fila.dtoFinanciero,
      cxTransporte: fila.cxTransporte,
    };

    const descuentosActivos = resolverDescuentosActivosParaItem(
      {
        idProveedor,
        marca: fila.marca,
        rubro: fila.rubro,
      },
      valores,
      reglasPorCampo,
      catalogos,
      proveedoresPorId
    );

    if (fila.descEspecial > 0) {
      const reglaEsp = reglasEspecPorCodExt.get(fila.codExt) ?? null;
      descuentosActivos.push({
        campo: "desc_especial",
        etiquetaCorta: "Espec.",
        label: "DESC. ESPECÍFICO",
        tipo: "descuento",
        valor: fila.descEspecial,
        regla: null,
        reglaEspecifica: reglaEsp,
      });
    }

    const pxPromo = fila.pxPromoFijo;
    if (pxPromo != null && pxPromo > 0) {
      descuentosActivos.unshift({
        campo: CAMPO_PX_PROMO_FIJO,
        etiquetaCorta: "Promo",
        label: "PX PROMO FIJO",
        tipo: "descuento",
        valor: pxPromo,
        regla: null,
        reglaEspecifica: null,
      });
    }

    return { ...fila, descuentosActivos };
  });
}

async function cargarReglasEspecialesPorCodExt(
  codigosExt: string[]
): Promise<Map<string, { id: string; nombre: string; valor: number }>> {
  const map = new Map<string, { id: string; nombre: string; valor: number }>();
  if (codigosExt.length === 0) return map;

  const links = await prisma.prodPrecioDescEspecialReglaProducto.findMany({
    where: { listaPrecioProveedorCodExt: { in: codigosExt } },
    include: { regla: { select: { id: true, nombre: true, valor: true } } },
  });

  for (const link of links) {
    map.set(link.listaPrecioProveedorCodExt, {
      id: link.regla.id,
      nombre: link.regla.nombre,
      valor: Number(link.regla.valor),
    });
  }
  return map;
}

export function resolverDescuentosParaItem(
  item: ItemParaResolverDescuentos,
  reglasPorCampo: Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>,
  catalogos: CatalogosResolver
): DescuentosMaterializadosItem {
  const result: DescuentosMaterializadosItem = {
    dtoProveedor: 0,
    dtoMarca: 0,
    dtoRubro: 0,
    dtoCantidad: 0,
    dtoFinanciero: 0,
    cxTransporte: 0,
  };

  for (const campo of CAMPOS_RESOLVER) {
    result[CAMPO_A_PROPIEDAD[campo]] = resolverValorCampo(
      campo,
      item,
      reglasPorCampo,
      catalogos
    );
  }

  return result;
}

async function cargarCatalogosResolver(): Promise<CatalogosResolver> {
  const [marcas, rubros] = await Promise.all([
    prisma.marca.findMany({ select: { id: true, nombre: true } }),
    prisma.prodRubroLista.findMany({ select: { id: true, nombre: true } }),
  ]);

  const marcasPorId = new Map<string, string>();
  for (const m of marcas) marcasPorId.set(m.id, m.nombre);

  const rubrosPorId = new Map<string, string>();
  for (const r of rubros) rubrosPorId.set(r.id, r.nombre);

  return { marcasPorId, rubrosPorId };
}

async function cargarReglasAgrupadasPorCampo(): Promise<
  Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>
> {
  const rows = await prisma.prodPrecioProveeRegla.findMany({
    select: {
      id: true,
      campo: true,
      valor: true,
      idProveedor: true,
      idMarca: true,
      idRubro: true,
    },
  });

  const map = new Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>();
  for (const campo of CAMPOS_RESOLVER) {
    map.set(campo, []);
  }

  for (const row of rows) {
    const list = map.get(row.campo) ?? [];
    list.push({
      id: row.id,
      campo: row.campo,
      valor: Number(row.valor),
      idProveedor: row.idProveedor,
      idMarca: row.idMarca,
      idRubro: row.idRubro,
    });
    map.set(row.campo, list);
  }

  return map;
}

async function persistirDescuentosBatch(
  filas: { codExt: string; descuentos: DescuentosMaterializadosItem }[]
): Promise<number> {
  if (filas.length === 0) return 0;

  const codExts: string[] = [];
  const dtoProveedor: number[] = [];
  const dtoMarca: number[] = [];
  const dtoRubro: number[] = [];
  const dtoCantidad: number[] = [];
  const dtoFinanciero: number[] = [];
  const cxTransporte: number[] = [];

  for (const f of filas) {
    codExts.push(f.codExt);
    dtoProveedor.push(f.descuentos.dtoProveedor);
    dtoMarca.push(f.descuentos.dtoMarca);
    dtoRubro.push(f.descuentos.dtoRubro);
    dtoCantidad.push(f.descuentos.dtoCantidad);
    dtoFinanciero.push(f.descuentos.dtoFinanciero);
    cxTransporte.push(f.descuentos.cxTransporte);
  }

  const actualizados = await prisma.$executeRawUnsafe(
    `
    UPDATE prod_precios_provee AS p
    SET
      dto_proveedor = v.dto_proveedor,
      dto_marca = v.dto_marca,
      dto_rubro = v.dto_rubro,
      dto_cantidad = v.dto_cantidad,
      dto_financiero = v.dto_financiero,
      cx_transporte = v.cx_transporte,
      updated_at = CURRENT_TIMESTAMP
    FROM (
      SELECT
        unnest($1::text[]) AS cod_ext,
        unnest($2::numeric[]) AS dto_proveedor,
        unnest($3::numeric[]) AS dto_marca,
        unnest($4::numeric[]) AS dto_rubro,
        unnest($5::numeric[]) AS dto_cantidad,
        unnest($6::numeric[]) AS dto_financiero,
        unnest($7::numeric[]) AS cx_transporte
    ) AS v
    WHERE p.cod_ext = v.cod_ext
    `,
    codExts,
    dtoProveedor,
    dtoMarca,
    dtoRubro,
    dtoCantidad,
    dtoFinanciero,
    cxTransporte
  );

  return Number(actualizados);
}

async function materializarItemsInterno(
  items: { codExt: string; idProveedor: string; marca: string | null; rubro: string | null }[],
  reglasPorCampo: Map<CampoReglaDescuentoListaPrecio, ReglaInterna[]>,
  catalogos: CatalogosResolver
): Promise<number> {
  if (items.length === 0) return 0;

  const batch = items.map((item) => ({
    codExt: item.codExt,
    descuentos: resolverDescuentosParaItem(item, reglasPorCampo, catalogos),
  }));

  return persistirDescuentosBatch(batch);
}

export async function materializarDescuentosEnFila(codExt: string): Promise<void> {
  await materializarDescuentosEnFilas([codExt]);
}

export async function materializarDescuentosEnFilas(
  codExts: string[]
): Promise<{ actualizados: number }> {
  const unique = [...new Set(codExts.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) return { actualizados: 0 };

  const [reglasPorCampo, catalogos] = await Promise.all([
    cargarReglasAgrupadasPorCampo(),
    cargarCatalogosResolver(),
  ]);

  let actualizados = 0;
  for (let i = 0; i < unique.length; i += CHUNK_MATERIALIZACION) {
    const chunkCodExts = unique.slice(i, i + CHUNK_MATERIALIZACION);
    const items = await prisma.listaPrecioProveedor.findMany({
      where: { codExt: { in: chunkCodExts } },
      select: {
        codExt: true,
        idProveedor: true,
        marca: true,
        rubro: true,
      },
    });
    actualizados += await materializarItemsInterno(items, reglasPorCampo, catalogos);
  }

  return { actualizados };
}

export async function recalcularTodasLasFilas(): Promise<{ actualizados: number }> {
  const [reglasPorCampo, catalogos] = await Promise.all([
    cargarReglasAgrupadasPorCampo(),
    cargarCatalogosResolver(),
  ]);

  let actualizados = 0;
  let cursor: string | undefined;

  for (;;) {
    const items = await prisma.listaPrecioProveedor.findMany({
      take: CHUNK_MATERIALIZACION,
      ...(cursor ? { skip: 1, cursor: { codExt: cursor } } : {}),
      orderBy: { codExt: "asc" },
      select: {
        codExt: true,
        idProveedor: true,
        marca: true,
        rubro: true,
      },
    });

    if (items.length === 0) break;
    actualizados += await materializarItemsInterno(items, reglasPorCampo, catalogos);
    cursor = items[items.length - 1]?.codExt;
    if (items.length < CHUNK_MATERIALIZACION) break;
  }

  return { actualizados };
}

/** v1: ante CRUD de regla recalcula todas las filas (documentado en BACKEND_GUIDELINES). */
export async function recalcularFilasAfectadasPorRegla(
  _regla: Pick<ReglaInterna, "campo" | "idProveedor" | "idMarca" | "idRubro">
): Promise<number> {
  const { actualizados } = await recalcularTodasLasFilas();
  return actualizados;
}

function inputToCondiciones(
  input: Pick<
    CrearReglaDescuentoListaPrecioInput | ActualizarReglaDescuentoListaPrecioInput,
    "idProveedor" | "idMarca" | "idRubro"
  >
): CondicionesRegla {
  return {
    idProveedor: input.idProveedor ?? null,
    idMarca: input.idMarca ?? null,
    idRubro: input.idRubro ?? null,
  };
}

export async function validarReglaSinConflicto(input: {
  id?: string;
  campo: CampoReglaDescuentoListaPrecioInput;
  idProveedor?: string | null;
  idMarca?: string | null;
  idRubro?: string | null;
}): Promise<ServiceResult<void>> {
  const condiciones = inputToCondiciones(input);

  const existenteDuplicada = await prisma.prodPrecioProveeRegla.findFirst({
    where: {
      campo: input.campo,
      idProveedor: condiciones.idProveedor,
      idMarca: condiciones.idMarca,
      idRubro: condiciones.idRubro,
      ...(input.id ? { NOT: { id: input.id } } : {}),
    },
    select: { id: true },
  });

  if (existenteDuplicada) {
    return {
      success: false,
      error: "Ya existe una regla con el mismo campo y condiciones.",
    };
  }

  const otras = await prisma.prodPrecioProveeRegla.findMany({
    where: {
      campo: input.campo,
      ...(input.id ? { NOT: { id: input.id } } : {}),
    },
    select: {
      id: true,
      idProveedor: true,
      idMarca: true,
      idRubro: true,
    },
  });

  const espNueva = especificidadRegla(condiciones);
  for (const otra of otras) {
    const condOtra: CondicionesRegla = {
      idProveedor: otra.idProveedor,
      idMarca: otra.idMarca,
      idRubro: otra.idRubro,
    };
    if (
      espNueva === especificidadRegla(condOtra) &&
      !condicionesIguales(condiciones, condOtra) &&
      reglasDescuentoSeSolapan(condiciones, condOtra)
    ) {
      return {
        success: false,
        error:
          "Conflicto de especificidad: otra regla del mismo campo puede matchear los mismos ítems. Ajustá las condiciones o eliminá la regla existente.",
      };
    }
  }

  if (condiciones.idProveedor) {
    const prov = await prisma.proveedor.findUnique({
      where: { id: condiciones.idProveedor },
      select: { id: true },
    });
    if (!prov) return { success: false, error: "Proveedor no encontrado." };
  }
  if (condiciones.idMarca) {
    const marca = await prisma.marca.findUnique({
      where: { id: condiciones.idMarca },
      select: { id: true },
    });
    if (!marca) return { success: false, error: "Marca no encontrada." };
  }
  if (condiciones.idRubro) {
    const rubro = await prisma.prodRubroLista.findUnique({
      where: { id: condiciones.idRubro },
      select: { id: true },
    });
    if (!rubro) return { success: false, error: "Rubro no encontrado en el catálogo." };
  }

  return { success: true, data: undefined };
}

function mapReglaRow(row: {
  id: string;
  campo: CampoReglaDescuentoListaPrecio;
  valor: { toString(): string } | number;
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
  createdAt: Date;
  updatedAt: Date;
  proveedor: { nombre: string; prefijo: string | null } | null;
  marca: { nombre: string } | null;
  rubro: { nombre: string } | null;
}): ReglaDescuentoListaPrecio {
  const condiciones: CondicionesRegla = {
    idProveedor: row.idProveedor,
    idMarca: row.idMarca,
    idRubro: row.idRubro,
  };
  return {
    id: row.id,
    campo: row.campo,
    valor: Number(row.valor),
    idProveedor: row.idProveedor,
    idMarca: row.idMarca,
    idRubro: row.idRubro,
    proveedorNombre: row.proveedor?.nombre ?? null,
    proveedorPrefijo: row.proveedor?.prefijo ?? null,
    marcaNombre: row.marca?.nombre ?? null,
    rubroNombre: row.rubro?.nombre ?? null,
    especificidad: especificidadRegla(condiciones),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listarReglasDescuentosListaPrecio(): Promise<ReglaDescuentoListaPrecio[]> {
  const rows = await prisma.prodPrecioProveeRegla.findMany({
    include: {
      proveedor: { select: { nombre: true, prefijo: true } },
      marca: { select: { nombre: true } },
      rubro: { select: { nombre: true } },
    },
    orderBy: [{ campo: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapReglaRow);
}

export async function crearReglaDescuentosListaPrecio(
  input: CrearReglaDescuentoListaPrecioInput
): Promise<ServiceResult<ReglaDescuentoListaPrecio>> {
  const validacion = await validarReglaSinConflicto(input);
  if (!validacion.success) return validacion;

  try {
    const row = await prisma.prodPrecioProveeRegla.create({
      data: {
        campo: input.campo,
        valor: clampPercent(input.valor),
        idProveedor: input.idProveedor ?? null,
        idMarca: input.idMarca ?? null,
        idRubro: input.idRubro ?? null,
      },
      include: {
        proveedor: { select: { nombre: true, prefijo: true } },
        marca: { select: { nombre: true } },
        rubro: { select: { nombre: true } },
      },
    });

    await recalcularFilasAfectadasPorRegla(row);

    return { success: true, data: mapReglaRow(row) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo crear la regla.";
    return { success: false, error: msg };
  }
}

export async function actualizarReglaDescuentosListaPrecio(
  input: ActualizarReglaDescuentoListaPrecioInput
): Promise<ServiceResult<ReglaDescuentoListaPrecio>> {
  const validacion = await validarReglaSinConflicto(input);
  if (!validacion.success) return validacion;

  try {
    const row = await prisma.prodPrecioProveeRegla.update({
      where: { id: input.id },
      data: {
        campo: input.campo,
        valor: clampPercent(input.valor),
        idProveedor: input.idProveedor ?? null,
        idMarca: input.idMarca ?? null,
        idRubro: input.idRubro ?? null,
      },
      include: {
        proveedor: { select: { nombre: true, prefijo: true } },
        marca: { select: { nombre: true } },
        rubro: { select: { nombre: true } },
      },
    });

    await recalcularFilasAfectadasPorRegla(row);

    return { success: true, data: mapReglaRow(row) };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2025") {
      return { success: false, error: "La regla no existe." };
    }
    const msg = e instanceof Error ? e.message : "No se pudo actualizar la regla.";
    return { success: false, error: msg };
  }
}

export async function eliminarReglaDescuentosListaPrecio(
  id: string
): Promise<ServiceResult<{ actualizados: number }>> {
  try {
    const row = await prisma.prodPrecioProveeRegla.delete({
      where: { id },
      select: {
        campo: true,
        idProveedor: true,
        idMarca: true,
        idRubro: true,
      },
    });

    const actualizados = await recalcularFilasAfectadasPorRegla(row);
    return { success: true, data: { actualizados } };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2025") {
      return { success: false, error: "La regla no existe." };
    }
    const msg = e instanceof Error ? e.message : "No se pudo eliminar la regla.";
    return { success: false, error: msg };
  }
}

export async function listarCatalogosReglasDescuentos(): Promise<CatalogosReglasDescuentosListaPrecio> {
  const [proveedores, marcas, rubros] = await Promise.all([
    prisma.proveedor.findMany({
      where: { proveedorMercaderia: true },
      select: { id: true, nombre: true, prefijo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.marca.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    listarRubrosCatalogoReglasDesdeProdTienda(),
  ]);

  return {
    proveedores: proveedores.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      prefijo: p.prefijo,
    })),
    marcas,
    rubros,
  };
}
