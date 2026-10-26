/**
 * Sincronización de Balance IIBB (`bal_iibb`) desde la venta. Idempotente: crea, actualiza o borra
 * la fila del comprobante según su estado actual. Borrar el comprobante borra la fila (Cascade).
 *
 * VENTA: factura / NC **fiscal** autorizada con CAE de un punto de venta RI
 * (`ptos_vtas.condicion_iva = 1`) → DÉBITO = (imp_total × cotizacion / 1,21) × 4 % (NC en negativo).
 */
import { Prisma } from "@prisma/client";
import { iibbDesdeTotalVenta } from "@/lib/balIibb";
import { esFacturaTipo, esFacturaTipoFiscal, esFacturaTipoNotaCredito } from "@/lib/factura";
import { ARCA_CONDICION_IVA } from "@/lib/facturaFiscal";
import { prisma } from "@/lib/prisma";
import { nroComprobanteVta } from "@/services/balIvaSync.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Llamar tras autorizar (idempotente; reintentable al reconsultar ARCA). */
export async function sincronizarIibbVenta(
  comprobanteVtaId: string,
  db: DbClient = prisma
): Promise<void> {
  const c = await db.comprobanteVta.findUnique({
    where: { id: comprobanteVtaId },
    select: {
      tipoComprobante: true,
      estado: true,
      cae: true,
      fecha: true,
      impTotal: true,
      cotizacion: true,
      letra: true,
      ptoVenta: true,
      cbteNro: true,
      receptorNombre: true,
      ptoVta: { select: { condicionIva: true } },
    },
  });
  const tipo = c && esFacturaTipo(c.tipoComprobante) ? c.tipoComprobante : null;
  const iibb = c ? iibbDesdeTotalVenta(Number(c.impTotal) * Number(c.cotizacion)) : 0;
  if (
    !c ||
    !tipo ||
    !esFacturaTipoFiscal(tipo) ||
    c.ptoVta.condicionIva !== ARCA_CONDICION_IVA.RI ||
    c.estado !== "autorizado" ||
    !c.cae ||
    iibb <= 0
  ) {
    await db.balIibb.deleteMany({ where: { comprobanteVtaId } });
    return;
  }
  const valores = {
    descripcion: [nroComprobanteVta(c), c.receptorNombre.toUpperCase()]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 255),
    debito: new Prisma.Decimal((esFacturaTipoNotaCredito(tipo) ? -iibb : iibb).toFixed(2)),
    fecha: c.fecha,
  };
  await db.balIibb.upsert({
    where: { comprobanteVtaId },
    create: { comprobanteVtaId, origen: "VENTA", ...valores },
    update: valores,
  });
}
