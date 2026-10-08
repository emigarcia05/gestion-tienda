import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shouldAbortCompetenciaSyncInDb } from "@/lib/competenciaPreciosProgressDb";
import { ESTADO_RELEVAMIENTO_COMPETENCIA } from "@/lib/competenciaRelevamiento";
import {
  aplicarPrioridadPrecioMostrar,
  countVinculosRelevablesCompetencia,
  obtenerPxVtaSugeridoParaCompetencia,
  obtenerPxVtaSugeridoPorCompetenciaId,
  whereVinculosRelevablesCompetencia,
} from "@/services/competenciaPxSugerido.service";
import { extraerPrecioDesdeUrlProducto } from "@/services/competenciaPrecioScraping.service";
import type { DatoVinculoCompetenciaCliente } from "@/services/competenciaVinculo.service";

const DELAY_MS = 300;

export class SyncCompetenciaPreciosCancelledError extends Error {
  constructor() {
    super("Comparación de competencia cancelada.");
    this.name = "SyncCompetenciaPreciosCancelledError";
  }
}

export interface SyncCompetenciaPreciosResult {
  procesados: number;
  encontrados: number;
  vacios: number;
  errores: number;
  desdeSugerido: number;
}

export interface SyncCompetenciaPreciosOptions {
  competenciaId: string;
  idProveedor?: string | null;
  codTienda?: string;
  limiteProductos?: number;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Releva precios por vínculo producto×competidor: primero `px_vta_sugerido` del proveedor
 * asociado (si está configurado y existe en `proveedor_prod_lista`); si no, scraping de `url_producto`.
 */
export async function syncCompetenciaPrecios(
  options: SyncCompetenciaPreciosOptions
): Promise<SyncCompetenciaPreciosResult> {
  const idProveedor = options.idProveedor ?? null;

  const whereVinculo = whereVinculosRelevablesCompetencia({
    competenciaId: options.competenciaId,
    idProveedor,
    codTienda: options.codTienda,
  });

  const competencia = await prisma.prodCompetencia.findUnique({
    where: { id: options.competenciaId },
    select: { configExtraccion: true, idProveedor: true },
  });

  const proveedorSync = idProveedor ?? competencia?.idProveedor ?? null;

  const totalEnBd = await countVinculosRelevablesCompetencia({
    competenciaId: options.competenciaId,
    idProveedor: proveedorSync,
    codTienda: options.codTienda,
  });
  const limite = options.limiteProductos;
  const totalObjetivo =
    limite != null && limite > 0 ? Math.min(totalEnBd, limite) : totalEnBd;

  let processed = 0;
  let encontrados = 0;
  let vacios = 0;
  let errores = 0;
  let desdeSugerido = 0;
  let skip = 0;

  while (processed < totalObjetivo) {
    if (await shouldAbortCompetenciaSyncInDb()) {
      throw new SyncCompetenciaPreciosCancelledError();
    }

    const take = Math.min(50, totalObjetivo - processed);
    const vinculos = await prisma.prodPrecioCompetencia.findMany({
      where: whereVinculo,
      orderBy: { codTienda: "asc" },
      skip,
      take,
      select: {
        codTienda: true,
        competenciaId: true,
        urlProducto: true,
        tipoPagina: true,
      },
    });
    if (vinculos.length === 0) break;

    for (const v of vinculos) {
      const now = new Date();
      const url = v.urlProducto?.trim() || null;

      try {
        if (proveedorSync) {
          const precioSugerido = await obtenerPxVtaSugeridoParaCompetencia(
            v.codTienda,
            proveedorSync
          );
          if (precioSugerido != null) {
            encontrados++;
            desdeSugerido++;
            // El sugerido se muestra en lectura; en BD se conserva el relevamiento por URL.
            processed++;
            options.onProgress?.(processed, totalObjetivo);
            if (await shouldAbortCompetenciaSyncInDb()) {
              throw new SyncCompetenciaPreciosCancelledError();
            }
            continue;
          }
        }

        if (!url) {
          vacios++;
          await prisma.prodPrecioCompetencia.update({
            where: {
              codTienda_competenciaId: {
                codTienda: v.codTienda,
                competenciaId: v.competenciaId,
              },
            },
            data: {
              pxCompetencia: null,
              estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_PRECIO,
              errorMensaje: null,
              relevadoAt: now,
            },
          });
          processed++;
          options.onProgress?.(processed, totalObjetivo);
          continue;
        }

        const resultado = await extraerPrecioDesdeUrlProducto(url, {
          configExtraccion: competencia?.configExtraccion,
          tipoPagina: v.tipoPagina,
        });

        if (!resultado.ok) {
          errores++;
          await prisma.prodPrecioCompetencia.update({
            where: {
              codTienda_competenciaId: {
                codTienda: v.codTienda,
                competenciaId: v.competenciaId,
              },
            },
            data: {
              pxCompetencia: null,
              estado: ESTADO_RELEVAMIENTO_COMPETENCIA.ERROR,
              errorMensaje: resultado.error.slice(0, 500),
              relevadoAt: now,
            },
          });
        } else if (resultado.precio != null) {
          encontrados++;
          await prisma.prodPrecioCompetencia.update({
            where: {
              codTienda_competenciaId: {
                codTienda: v.codTienda,
                competenciaId: v.competenciaId,
              },
            },
            data: {
              pxCompetencia: new Prisma.Decimal(resultado.precio),
              estado: ESTADO_RELEVAMIENTO_COMPETENCIA.OK,
              errorMensaje: null,
              relevadoAt: now,
            },
          });
        } else {
          vacios++;
          await prisma.prodPrecioCompetencia.update({
            where: {
              codTienda_competenciaId: {
                codTienda: v.codTienda,
                competenciaId: v.competenciaId,
              },
            },
            data: {
              pxCompetencia: null,
              estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_PRECIO,
              errorMensaje: null,
              relevadoAt: now,
            },
          });
        }
      } catch (e) {
        errores++;
        const msg = e instanceof Error ? e.message : "Error desconocido.";
        await prisma.prodPrecioCompetencia.update({
          where: {
            codTienda_competenciaId: {
              codTienda: v.codTienda,
              competenciaId: v.competenciaId,
            },
          },
          data: {
            pxCompetencia: null,
            estado: ESTADO_RELEVAMIENTO_COMPETENCIA.ERROR,
            errorMensaje: msg.slice(0, 500),
            relevadoAt: now,
          },
        });
      }

      processed++;
      options.onProgress?.(processed, totalObjetivo);
      await delay(DELAY_MS);

      if (await shouldAbortCompetenciaSyncInDb()) {
        throw new SyncCompetenciaPreciosCancelledError();
      }
    }

    skip += take;
  }

  await prisma.prodCompetencia.update({
    where: { id: options.competenciaId },
    data: { ultimaComparacionAt: new Date() },
  });

  return { procesados: processed, encontrados, vacios, errores, desdeSugerido };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const vinculoRelevadoSelect = {
  urlProducto: true,
  tipoPagina: true,
  pxCompetencia: true,
  estado: true,
  errorMensaje: true,
  relevadoAt: true,
} as const;

function mapVinculoRelevado(row: {
  urlProducto: string | null;
  tipoPagina: string | null;
  pxCompetencia: { toString(): string } | null;
  estado: string;
  errorMensaje: string | null;
  relevadoAt: Date | null;
}): DatoVinculoCompetenciaCliente {
  return {
    urlProducto: row.urlProducto,
    tipoPagina: row.tipoPagina,
    pxCompetencia: row.pxCompetencia != null ? Number(row.pxCompetencia) : null,
    estado: row.estado,
    errorMensaje: row.errorMensaje,
    relevadoAt: row.relevadoAt?.toISOString() ?? null,
    urlBloqueadaPorPxSugerido: false,
  };
}

/**
 * Releva un solo vínculo producto×competidor (sin lock ni progreso de sync masivo).
 */
export async function relevarVinculoCompetenciaUnico(params: {
  codTienda: string;
  competenciaId: string;
}): Promise<DatoVinculoCompetenciaCliente> {
  const { codTienda, competenciaId } = params;

  const competencia = await prisma.prodCompetencia.findUnique({
    where: { id: competenciaId },
    select: { configExtraccion: true, idProveedor: true },
  });
  if (!competencia) {
    throw new Error("Competidor no encontrado.");
  }

  const pxSugerido = await obtenerPxVtaSugeridoPorCompetenciaId(codTienda, competenciaId);
  const now = new Date();
  if (pxSugerido != null) {
    await prisma.prodCompetencia.update({
      where: { id: competenciaId },
      data: { ultimaComparacionAt: now },
    });
    const row = await prisma.prodPrecioCompetencia.findUnique({
      where: {
        codTienda_competenciaId: { codTienda, competenciaId },
      },
      select: vinculoRelevadoSelect,
    });
    const base = row
      ? mapVinculoRelevado(row)
      : mapVinculoRelevado({
          urlProducto: null,
          tipoPagina: null,
          pxCompetencia: null,
          estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_URL,
          errorMensaje: null,
          relevadoAt: null,
        });
    return aplicarPrioridadPrecioMostrar(base, pxSugerido);
  }

  const vinculo = await prisma.prodPrecioCompetencia.findUnique({
    where: {
      codTienda_competenciaId: { codTienda, competenciaId },
    },
    select: {
      urlProducto: true,
      tipoPagina: true,
    },
  });

  const url = vinculo?.urlProducto?.trim() || null;
  if (!url) {
    throw new Error("No hay URL cargada para relevar.");
  }

  const tipoPagina = vinculo?.tipoPagina?.trim() || null;

  try {
    const resultado = await extraerPrecioDesdeUrlProducto(url, {
      configExtraccion: competencia.configExtraccion,
      tipoPagina,
    });

    if (!resultado.ok) {
      await prisma.prodPrecioCompetencia.update({
        where: {
          codTienda_competenciaId: { codTienda, competenciaId },
        },
        data: {
          pxCompetencia: null,
          estado: ESTADO_RELEVAMIENTO_COMPETENCIA.ERROR,
          errorMensaje: resultado.error.slice(0, 500),
          relevadoAt: now,
        },
      });
    } else if (resultado.precio != null) {
      await prisma.prodPrecioCompetencia.update({
        where: {
          codTienda_competenciaId: { codTienda, competenciaId },
        },
        data: {
          pxCompetencia: new Prisma.Decimal(resultado.precio),
          estado: ESTADO_RELEVAMIENTO_COMPETENCIA.OK,
          errorMensaje: null,
          relevadoAt: now,
        },
      });
    } else {
      await prisma.prodPrecioCompetencia.update({
        where: {
          codTienda_competenciaId: { codTienda, competenciaId },
        },
        data: {
          pxCompetencia: null,
          estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_PRECIO,
          errorMensaje: null,
          relevadoAt: now,
        },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido.";
    await prisma.prodPrecioCompetencia.update({
      where: {
        codTienda_competenciaId: { codTienda, competenciaId },
      },
      data: {
        pxCompetencia: null,
        estado: ESTADO_RELEVAMIENTO_COMPETENCIA.ERROR,
        errorMensaje: msg.slice(0, 500),
        relevadoAt: now,
      },
    });
  }

  await prisma.prodCompetencia.update({
    where: { id: competenciaId },
    data: { ultimaComparacionAt: now },
  });

  const row = await prisma.prodPrecioCompetencia.findUnique({
    where: {
      codTienda_competenciaId: { codTienda, competenciaId },
    },
    select: vinculoRelevadoSelect,
  });
  if (!row) {
    throw new Error("No se encontró el vínculo tras relevar.");
  }

  return aplicarPrioridadPrecioMostrar(mapVinculoRelevado(row), null);
}

export interface RelevarVinculosPorCodTiendaResult {
  procesados: number;
  encontrados: number;
  vacios: number;
  errores: number;
}

/**
 * Releva todos los vínculos relevables de un producto tienda (URLs + Px sugerido).
 * Sin lock ni progreso de sync masivo.
 */
export async function relevarVinculosPorCodTienda(
  codTienda: string
): Promise<RelevarVinculosPorCodTiendaResult> {
  const competencias = await prisma.prodCompetencia.findMany({
    select: { id: true, idProveedor: true },
  });

  const result: RelevarVinculosPorCodTiendaResult = {
    procesados: 0,
    encontrados: 0,
    vacios: 0,
    errores: 0,
  };

  for (const c of competencias) {
    const relevable = await countVinculosRelevablesCompetencia({
      competenciaId: c.id,
      idProveedor: c.idProveedor,
      codTienda,
    });
    if (relevable === 0) continue;

    try {
      const vinculo = await relevarVinculoCompetenciaUnico({
        codTienda,
        competenciaId: c.id,
      });
      result.procesados++;
      if (vinculo.estado === ESTADO_RELEVAMIENTO_COMPETENCIA.OK) {
        result.encontrados++;
      } else if (vinculo.estado === ESTADO_RELEVAMIENTO_COMPETENCIA.ERROR) {
        result.errores++;
      } else {
        result.vacios++;
      }
    } catch {
      result.errores++;
    }

    await delay(DELAY_MS);
  }

  if (result.procesados === 0) {
    throw new Error(
      "No hay URLs asociadas ni precios sugeridos para relevar en este producto."
    );
  }

  return result;
}
