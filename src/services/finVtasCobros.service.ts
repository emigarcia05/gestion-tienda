import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";
import { prisma } from "@/lib/prisma";

export type FinVtasCobroFila = {
  id: string;
  idCobro: string;
  idSucursal: string;
  nombreSucursal: string;
  fecha: string;
  descripcion: string;
  monto: string;
  idTarjeta: string;
  idPlanTarjeta: string;
  idTerminal: string;
  tipoValor: string;
};

export async function listarFinVtasCobros(params: {
  mes: number;
  anio: number;
}): Promise<FinVtasCobroFila[]> {
  try {
    const desde = new Date(Date.UTC(params.anio, params.mes - 1, 1));
    const hastaExcl = new Date(Date.UTC(params.anio, params.mes, 1));
    const rows = await prisma.finVtasCobro.findMany({
      where: {
        fecha: { gte: desde, lt: hastaExcl },
      },
      orderBy: [{ fecha: "asc" }, { idCobro: "asc" }, { linea: "asc" }],
      select: {
        id: true,
        idCobro: true,
        idSucursal: true,
        fecha: true,
        descripcion: true,
        monto: true,
        idTarjeta: true,
        idPlanTarjeta: true,
        idTerminal: true,
        tipoValor: true,
        sucursal: { select: { nombre: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      idCobro: r.idCobro.toString(),
      idSucursal: r.idSucursal,
      nombreSucursal: r.sucursal.nombre.toLocaleUpperCase("es-AR"),
      fecha: isoYmdFromPrismaDateOnly(r.fecha),
      descripcion: r.descripcion,
      monto: r.monto.toFixed(2),
      idTarjeta: r.idTarjeta != null ? r.idTarjeta.toString() : "",
      idPlanTarjeta: r.idPlanTarjeta != null ? r.idPlanTarjeta.toString() : "",
      idTerminal: r.idTerminal != null ? r.idTerminal.toString() : "",
      tipoValor: r.tipoValor,
    }));
  } catch (e) {
    console.error("[vtasCobros][listarFinVtasCobros]", e);
    return [];
  }
}
