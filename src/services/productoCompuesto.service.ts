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
import type {
  ComponenteCandidatoItem,
  ComposicionProductoTienda,
} from "@/lib/productoCompuesto";
import { cantidadDesdePrisma } from "@/lib/cantidadUnDecimal";
import type { GuardarComponentesCompuestoInput } from "@/lib/validations/productoCompuesto";
import {
  SELECT_COSTO_COMPRA_TIENDA,
  resolverCostoCompraTienda,
} from "@/services/costoListaTienda.service";
import type { ServiceResult } from "@/types";

class ErrorNegocio extends Error {}

const CANDIDATOS_MAX = 30;

function resultadoError(error: unknown, contexto: string, fallback: string): ServiceResult<never> {
  if (error instanceof ErrorNegocio) return { success: false, error: error.message };
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
          cantidad: cantidadDesdePrisma(c.cantidad),
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
      if (!row) throw new ErrorNegocio("Ítem de tienda no encontrado.");

      if (!esProductoCompuesto) {
        await tx.prodListaCompuesto.deleteMany({ where: { codTiendaCompuesto: codTienda } });
        await tx.prodPropio.update({
          where: { codTienda },
          data: { esProductoCompuesto: false },
        });
        return;
      }
      if (row._count.listaPreciosProveedores > 0) {
        throw new ErrorNegocio(
          "Este ítem tiene vínculos con proveedores. Desvinculá todos antes de marcarlo como compuesto."
        );
      }
      if (row._count.compuestosQueLoUsan > 0) {
        throw new ErrorNegocio(
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

/** Reemplaza la lista completa de componentes del compuesto. */
export async function guardarComponentesCompuesto(
  input: GuardarComponentesCompuestoInput
): Promise<ServiceResult<{ componentes: number }>> {
  const { codTienda, componentes } = input;
  const codigos = componentes.map((c) => c.codTienda);
  try {
    if (new Set(codigos).size !== codigos.length) {
      throw new ErrorNegocio("Hay componentes repetidos.");
    }
    if (codigos.includes(codTienda)) {
      throw new ErrorNegocio("Un producto compuesto no puede componerse de sí mismo.");
    }
    await prisma.$transaction(async (tx) => {
      const compuesto = await tx.prodPropio.findUnique({
        where: { codTienda },
        select: { esProductoCompuesto: true },
      });
      if (!compuesto) throw new ErrorNegocio("Ítem de tienda no encontrado.");
      if (!compuesto.esProductoCompuesto) {
        throw new ErrorNegocio("Marcá el ítem como PROD. COMPUESTO antes de cargar componentes.");
      }
      const existentes = await tx.prodPropio.findMany({
        where: { codTienda: { in: codigos } },
        select: { codTienda: true, descripcionTienda: true, esProductoCompuesto: true },
      });
      if (existentes.length !== codigos.length) {
        throw new ErrorNegocio("Algún componente ya no existe.");
      }
      const compuestoAnidado = existentes.find((e) => e.esProductoCompuesto);
      if (compuestoAnidado) {
        throw new ErrorNegocio(
          `«${compuestoAnidado.descripcionTienda ?? compuestoAnidado.codTienda}» es un producto compuesto: no puede ser componente.`
        );
      }
      await tx.prodListaCompuesto.deleteMany({ where: { codTiendaCompuesto: codTienda } });
      if (componentes.length > 0) {
        await tx.prodListaCompuesto.createMany({
          data: componentes.map((c) => ({
            codTiendaCompuesto: codTienda,
            codTiendaComponente: c.codTienda,
            cantidad: new Prisma.Decimal(c.cantidad),
          })),
        });
      }
    });
    return { success: true, data: { componentes: componentes.length } };
  } catch (error) {
    return resultadoError(error, "guardarComponentesCompuesto", "No se pudieron guardar los componentes.");
  }
}

/** Ítems que pueden ser componentes de `codTienda`: no compuestos y distintos de él. */
export async function buscarComponentesCandidatos(
  codTienda: string,
  q: string
): Promise<ServiceResult<ComponenteCandidatoItem[]>> {
  try {
    const texto: Prisma.ProdPropioWhereInput = filtroTexto(q, ["descripcionTienda", "codTienda"]);
    const rows = await prisma.prodPropio.findMany({
      where: {
        AND: [texto, { esProductoCompuesto: false }, { codTienda: { not: codTienda } }],
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
