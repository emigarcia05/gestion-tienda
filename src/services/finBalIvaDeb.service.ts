import { prisma } from "@/lib/prisma";
import {
  esErrorColumnaImpIvaFaltante,
  MSG_MIGRACION_IMP_IVA_FALTANTE,
} from "@/lib/finBalIvaDebPrisma";

/** Línea de detalle IVA débito (`fin_bal_iva_deb_import`). */
export interface DetalleLineaIvaDebitoBalance {
  id: string;
  fechaEmisionIso: string;
  denominacionReceptor: string;
  impTotal: number;
  impIva: number;
}

function isoYmdUtcDesdeDbDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Comprobantes cuya `fecha_emision` cae en el mes calendario indicado. */
export async function listarDetalleIvaDebitoMes(params: {
  mes: number;
  anio: number;
}): Promise<DetalleLineaIvaDebitoBalance[]> {
  const { mes, anio } = params;
  try {
    const rows = await prisma.finBalIvaDebImportLine.findMany({
      where: {
        fechaEmision: {
          gte: new Date(Date.UTC(anio, mes - 1, 1)),
          lt: new Date(Date.UTC(anio, mes, 1)),
        },
      },
      orderBy: [{ fechaEmision: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fechaEmision: true,
        denominacionReceptor: true,
        impTotal: true,
        impIva: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      fechaEmisionIso: isoYmdUtcDesdeDbDate(r.fechaEmision),
      denominacionReceptor: r.denominacionReceptor,
      impTotal: Number(r.impTotal),
      impIva: Number(r.impIva),
    }));
  } catch (e: unknown) {
    if (!esErrorColumnaImpIvaFaltante(e)) throw e;
    const rows = await prisma.finBalIvaDebImportLine.findMany({
      where: {
        fechaEmision: {
          gte: new Date(Date.UTC(anio, mes - 1, 1)),
          lt: new Date(Date.UTC(anio, mes, 1)),
        },
      },
      orderBy: [{ fechaEmision: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fechaEmision: true,
        denominacionReceptor: true,
        impTotal: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      fechaEmisionIso: isoYmdUtcDesdeDbDate(r.fechaEmision),
      denominacionReceptor: r.denominacionReceptor,
      impTotal: Number(r.impTotal),
      impIva: 0,
    }));
  }
}

/** Suma `imp_iva` por mes calendario del año (índice 0 = enero). */
export async function listarIvaDebitoFinBalPorAnio(anio: number): Promise<number[]> {
  const out = Array.from({ length: 12 }, () => 0);
  try {
    const rows = await prisma.finBalIvaDebImportLine.findMany({
      where: {
        fechaEmision: {
          gte: new Date(Date.UTC(anio, 0, 1)),
          lt: new Date(Date.UTC(anio + 1, 0, 1)),
        },
      },
      select: { fechaEmision: true, impIva: true },
    });
    for (const r of rows) {
      const y = r.fechaEmision.getUTCFullYear();
      const mes = r.fechaEmision.getUTCMonth() + 1;
      if (y !== anio || mes < 1 || mes > 12) continue;
      out[mes - 1] += Number(r.impIva);
    }
    return out;
  } catch (e: unknown) {
    if (!esErrorColumnaImpIvaFaltante(e)) throw e;
    console.error("[finBalIvaDeb] imp_iva no existe en BD:", MSG_MIGRACION_IMP_IVA_FALTANTE);
    return out;
  }
}
