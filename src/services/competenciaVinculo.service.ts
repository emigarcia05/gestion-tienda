import { prisma } from "@/lib/prisma";
import { ESTADO_RELEVAMIENTO_COMPETENCIA } from "@/lib/competenciaRelevamiento";
import { obtenerPxVtaSugeridoPorCompetenciaId } from "@/services/competenciaPxSugerido.service";

/** Fila mínima en `prod_precios_competencia` para FK de referente (p. ej. solo Px. Vta. Sugerido). */
export async function ensureVinculoCompetenciaParaReferencia(
  codTienda: string,
  competenciaId: string
): Promise<void> {
  const existing = await prisma.prodPrecioCompetencia.findUnique({
    where: { codTienda_competenciaId: { codTienda, competenciaId } },
    select: { codTienda: true },
  });
  if (existing) return;

  await prisma.prodPrecioCompetencia.create({
    data: {
      codTienda,
      competenciaId,
      urlProducto: null,
      tipoPagina: null,
      estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_URL,
      pxCompetencia: null,
      errorMensaje: null,
      relevadoAt: null,
    },
  });
}

export interface DatoVinculoCompetenciaCliente {
  urlProducto: string | null;
  tipoPagina: string | null;
  pxCompetencia: number | null;
  estado: string;
  errorMensaje: string | null;
  relevadoAt: string | null;
  /** true si el competidor tiene proveedor y existe `px_vta_sugerido` en `proveedor_prod_lista` para este `cod_tienda`. */
  urlBloqueadaPorPxSugerido: boolean;
}

export async function guardarUrlVinculoCompetencia(data: {
  codTienda: string;
  competenciaId: string;
  urlProducto: string | null;
  tipoPagina?: string | null;
}): Promise<DatoVinculoCompetenciaCliente> {
  const url = data.urlProducto?.trim() || null;
  const tipoPagina = data.tipoPagina?.trim() || null;

  const pxSugerido = await obtenerPxVtaSugeridoPorCompetenciaId(
    data.codTienda,
    data.competenciaId
  );
  if (pxSugerido != null) {
    throw new Error(
      "Este producto usa Px. Vta. Sugerido del proveedor asociado al competidor; no se puede cargar ni modificar la URL."
    );
  }

  if (!url) {
    const existenteSinUrl = await prisma.prodPrecioCompetencia.findUnique({
      where: {
        codTienda_competenciaId: {
          codTienda: data.codTienda,
          competenciaId: data.competenciaId,
        },
      },
      select: { urlProducto: true },
    });
    if (!existenteSinUrl?.urlProducto?.trim()) {
      const row = await prisma.prodPrecioCompetencia.findUnique({
        where: {
          codTienda_competenciaId: {
            codTienda: data.codTienda,
            competenciaId: data.competenciaId,
          },
        },
        select: vinculoSelect,
      });
      if (row) return mapVinculo(row);
    }

    const row = await prisma.prodPrecioCompetencia.upsert({
      where: {
        codTienda_competenciaId: {
          codTienda: data.codTienda,
          competenciaId: data.competenciaId,
        },
      },
      create: {
        codTienda: data.codTienda,
        competenciaId: data.competenciaId,
        urlProducto: null,
        tipoPagina: null,
        estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_URL,
        pxCompetencia: null,
        errorMensaje: null,
        relevadoAt: null,
      },
      update: {
        urlProducto: null,
        tipoPagina: null,
        estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_URL,
        errorMensaje: null,
        // Conserva px y relevado de este competidor (no afecta a otros).
      },
      select: vinculoSelect,
    });
    return mapVinculo(row);
  }

  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    throw new Error("URL de producto inválida.");
  }

  const urlNorm = url.startsWith("http") ? url : `https://${url}`;

  const existente = await prisma.prodPrecioCompetencia.findUnique({
    where: {
      codTienda_competenciaId: {
        codTienda: data.codTienda,
        competenciaId: data.competenciaId,
      },
    },
    select: { urlProducto: true, tipoPagina: true },
  });
  const urlPrev = existente?.urlProducto?.trim() || null;
  const urlPrevNorm = urlPrev
    ? urlPrev.startsWith("http")
      ? urlPrev
      : `https://${urlPrev}`
    : null;
  const urlCambio = urlPrevNorm !== urlNorm;
  const tipoPrev = existente?.tipoPagina?.trim() || null;
  const tipoCambio = tipoPrev !== (tipoPagina?.trim() || null);

  if (existente && !urlCambio && !tipoCambio) {
    const row = await prisma.prodPrecioCompetencia.findUnique({
      where: {
        codTienda_competenciaId: {
          codTienda: data.codTienda,
          competenciaId: data.competenciaId,
        },
      },
      select: vinculoSelect,
    });
    if (row) return mapVinculo(row);
  }

  const row = await prisma.prodPrecioCompetencia.upsert({
    where: {
      codTienda_competenciaId: {
        codTienda: data.codTienda,
        competenciaId: data.competenciaId,
      },
    },
    create: {
      codTienda: data.codTienda,
      competenciaId: data.competenciaId,
      urlProducto: urlNorm,
      tipoPagina,
      estado: ESTADO_RELEVAMIENTO_COMPETENCIA.PENDIENTE,
      pxCompetencia: null,
      errorMensaje: null,
      relevadoAt: null,
    },
    update: urlCambio
      ? {
          urlProducto: urlNorm,
          tipoPagina,
          estado: ESTADO_RELEVAMIENTO_COMPETENCIA.PENDIENTE,
          errorMensaje: null,
          pxCompetencia: null,
          relevadoAt: null,
        }
      : {
          tipoPagina,
          errorMensaje: null,
        },
    select: vinculoSelect,
  });
  return mapVinculo(row);
}

const vinculoSelect = {
  urlProducto: true,
  tipoPagina: true,
  pxCompetencia: true,
  estado: true,
  errorMensaje: true,
  relevadoAt: true,
} as const;

function mapVinculo(row: {
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
