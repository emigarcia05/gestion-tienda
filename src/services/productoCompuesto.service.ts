/**
 * Producto compuesto (kit): ítem de `prod_lista` armado con otros ítems de `prod_lista`
 * (`prod_lista_compuestos`). Reglas:
 * - siempre es PROD. PROPIO (sin vínculos con proveedores, sin `costo_manual`);
 * - un componente no puede ser compuesto, ni el compuesto componerse de sí mismo;
 * - costo = Σ (cantidad × costo resuelto de cada componente) → `costoProductoCompuesto`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import {
  cantidadComponenteDesdePrisma,
  type ComponenteCandidatoItem,
  type ComposicionProductoTienda,
} from "@/lib/productoCompuesto";
import type {
  ComponentesCompuestoInput,
  GuardarComponentesCompuestoInput,
} from "@/lib/validations/productoCompuesto";
import {
  SELECT_COSTO_COMPRA_TIENDA,
  resolverCostoCompraTienda,
} from "@/services/costoListaTienda.service";
import type { ServiceResult } from "@/types";

/** Error de regla de negocio (mensaje apto para el usuario). */
export class ErrorNegocioCompuesto extends Error {}

const CANDIDATOS_MAX = 30;

function resultadoError(error: unknown, contexto: string, fallback: string): ServiceResult<never> {
  if (error instanceof ErrorNegocioCompuesto) return { success: false, error: error.message };
  console.error(`[productoCompuesto.service] ${contexto}:`, error);
  return { success: false, error: fallback };
}

export async function getComposicionProductoTienda(
  codTienda: string
): Promise<ServiceResult<ComposicionProductoTienda>> {
  try {
    const row = await prisma.prodPropio.findUnique({
      where: { codTienda },
      select: {
        esProductoCompuesto: true,
        _count: { select: { compuestosQueLoUsan: true } },
        componentes: {
          select: {
            cantidad: true,
            componente: {
              select: { codTienda: true, descripcionTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
            },
          },
          orderBy: { componente: { descripcionTienda: "asc" } },
        },
      },
    });
    if (!row) return { success: false, error: "Ítem de tienda no encontrado." };
    return {
      success: true,
      data: {
        esProductoCompuesto: row.esProductoCompuesto,
        esComponenteDe: row._count.compuestosQueLoUsan,
        componentes: row.componentes.map((c) => ({
          codTienda: c.componente.codTienda,
          descripcion: (c.componente.descripcionTienda ?? "").trim(),
          cantidad: cantidadComponenteDesdePrisma(c.cantidad),
          costoUnitario: resolverCostoCompraTienda(c.componente),
        })),
      },
    };
  } catch (error) {
    return resultadoError(error, "getComposicionProductoTienda", "No se pudo leer la composición.");
  }
}

/**
 * Marca / desmarca producto compuesto. Al marcar: también PROD. PROPIO y `costo_manual` vacío
 * (exige sin vínculos y que no sea componente de otro compuesto). Al desmarcar: borra sus
 * componentes y queda como PROD. PROPIO.
 */
export async function setProductoCompuestoTienda(
  codTienda: string,
  esProductoCompuesto: boolean
): Promise<ServiceResult<{ esProductoCompuesto: boolean }>> {
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.prodPropio.findUnique({
        where: { codTienda },
        select: {
          _count: { select: { listaPreciosProveedores: true, compuestosQueLoUsan: true } },
        },
      });
      if (!row) throw new ErrorNegocioCompuesto("Ítem de tienda no encontrado.");

      if (!esProductoCompuesto) {
        await tx.prodListaCompuesto.deleteMany({ where: { codTiendaCompuesto: codTienda } });
        await tx.prodPropio.update({
          where: { codTienda },
          data: { esProductoCompuesto: false },
        });
        return;
      }
      if (row._count.listaPreciosProveedores > 0) {
        throw new ErrorNegocioCompuesto(
          "Este ítem tiene vínculos con proveedores. Desvinculá todos antes de marcarlo como compuesto."
        );
      }
      if (row._count.compuestosQueLoUsan > 0) {
        throw new ErrorNegocioCompuesto(
          "Este ítem es componente de otro producto compuesto: no puede ser compuesto."
        );
      }
      await tx.prodPropio.update({
        where: { codTienda },
        data: {
          esProductoCompuesto: true,
          esProductoPropio: true,
          costoManual: null,
          costoCompraCodExt: null,
        },
      });
    });
    return { success: true, data: { esProductoCompuesto } };
  } catch (error) {
    return resultadoError(error, "setProductoCompuestoTienda", "No se pudo actualizar el producto.");
  }
}

/**
 * Valida e inserta componentes de `codTienda` (que ya debe existir como compuesto y sin componentes):
 * sin repetidos, sin auto-referencia, todos existentes y ninguno compuesto. Lanza
 * `ErrorNegocioCompuesto`. También lo usa el alta (`crearProductosTiendaLote`).
 */
export async function insertarComponentesCompuesto(
  tx: Prisma.TransactionClient,
  codTienda: string,
  componentes: ComponentesCompuestoInput
): Promise<void> {
  if (componentes.length === 0) return;
  const codigos = componentes.map((c) => c.codTienda);
  if (new Set(codigos).size !== codigos.length) {
    throw new ErrorNegocioCompuesto("Hay componentes repetidos.");
  }
  if (codigos.includes(codTienda)) {
    throw new ErrorNegocioCompuesto("Un producto compuesto no puede componerse de sí mismo.");
  }
  const existentes = await tx.prodPropio.findMany({
    where: { codTienda: { in: codigos } },
    select: { codTienda: true, descripcionTienda: true, esProductoCompuesto: true },
  });
  if (existentes.length !== codigos.length) {
    throw new ErrorNegocioCompuesto("Algún componente ya no existe.");
  }
  const compuestoAnidado = existentes.find((e) => e.esProductoCompuesto);
  if (compuestoAnidado) {
    throw new ErrorNegocioCompuesto(
      `«${compuestoAnidado.descripcionTienda ?? compuestoAnidado.codTienda}» es un producto compuesto: no puede ser componente.`
    );
  }
  await tx.prodListaCompuesto.createMany({
    data: componentes.map((c) => ({
      codTiendaCompuesto: codTienda,
      codTiendaComponente: c.codTienda,
      cantidad: new Prisma.Decimal(c.cantidad),
    })),
  });
}

/** Reemplaza la lista completa de componentes del compuesto. */
export async function guardarComponentesCompuesto(
  input: GuardarComponentesCompuestoInput
): Promise<ServiceResult<{ componentes: number }>> {
  const { codTienda, componentes } = input;
  try {
    await prisma.$transaction(async (tx) => {
      const compuesto = await tx.prodPropio.findUnique({
        where: { codTienda },
        select: { esProductoCompuesto: true },
      });
      if (!compuesto) throw new ErrorNegocioCompuesto("Ítem de tienda no encontrado.");
      if (!compuesto.esProductoCompuesto) {
        throw new ErrorNegocioCompuesto("Marcá el ítem como PROD. COMPUESTO antes de cargar componentes.");
      }
      await tx.prodListaCompuesto.deleteMany({ where: { codTiendaCompuesto: codTienda } });
      await insertarComponentesCompuesto(tx, codTienda, componentes);
    });
    return { success: true, data: { componentes: componentes.length } };
  } catch (error) {
    return resultadoError(error, "guardarComponentesCompuesto", "No se pudieron guardar los componentes.");
  }
}

/** Ítems que pueden ser componentes de `codTienda` (null = compuesto aún sin crear): no compuestos y distintos de él. */
export async function buscarComponentesCandidatos(
  codTienda: string | null,
  q: string
): Promise<ServiceResult<ComponenteCandidatoItem[]>> {
  try {
    const texto: Prisma.ProdPropioWhereInput = filtroTexto(q, ["descripcionTienda", "codTienda"]);
    const rows = await prisma.prodPropio.findMany({
      where: {
        AND: [
          texto,
          { habilitado: true },
          { esProductoCompuesto: false },
          ...(codTienda ? [{ codTienda: { not: codTienda } }] : []),
        ],
      },
      select: { codTienda: true, descripcionTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      take: CANDIDATOS_MAX,
    });
    return {
      success: true,
      data: rows.map((r) => ({
        codTienda: r.codTienda,
        descripcion: (r.descripcionTienda ?? "").trim(),
        costoUnitario: resolverCostoCompraTienda(r),
      })),
    };
  } catch (error) {
    return resultadoError(error, "buscarComponentesCandidatos", "No se pudo buscar productos.");
  }
}
