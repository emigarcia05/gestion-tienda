import { Prisma } from "@prisma/client";

function claveMatriz(terminalId: string, pagoId: string, cuotaId: string | null): string {
  return `${terminalId}:${pagoId}:${cuotaId ?? ""}`;
}

type DbClient = Prisma.TransactionClient;

/**
 * Sincroniza `fin_ana_cos_fina` con vínculos N:M y `acepta_cuotas`:
 * - sin cuotas: una fila por forma de pago (en costos) × entidad (`cuota_id` null)
 * - con `acepta_cuotas` y catálogo de cuotas: una fila por forma × entidad × cuota
 * Crea faltantes (copia valores de una fila hermana del mismo par si existe) y borra huérfanas.
 */
export async function sincronizarMatrizFinAnaCosFina(tx: DbClient): Promise<void> {
  const [vinculos, cuotas, existentes] = await Promise.all([
    tx.cobrosFormaPagoEntidad.findMany({
      where: { pago: { enCostosFinancieros: true } },
      select: {
        pagoId: true,
        entidadId: true,
        pago: { select: { aceptaCuotas: true } },
      },
    }),
    tx.cobrosCuota.findMany({
      orderBy: [{ cuotas: "asc" }],
      select: { id: true },
    }),
    tx.finAnaCosFina.findMany({
      select: {
        id: true,
        terminalId: true,
        pagoId: true,
        cuotaId: true,
        habilitado: true,
        impCheque: true,
        diasAcreditacion: true,
        arancel: true,
        costoFinanciero: true,
      },
    }),
  ]);

  const cuotaIds = cuotas.map((c) => c.id);

  type Deseado = { terminalId: string; pagoId: string; cuotaId: string | null };
  const deseados: Deseado[] = [];
  for (const vinculo of vinculos) {
    const idsCuota: Array<string | null> =
      vinculo.pago.aceptaCuotas && cuotaIds.length > 0 ? cuotaIds : [null];
    for (const cuotaId of idsCuota) {
      deseados.push({
        terminalId: vinculo.entidadId,
        pagoId: vinculo.pagoId,
        cuotaId,
      });
    }
  }

  const existentesPorClave = new Map(
    existentes.map((row) => [claveMatriz(row.terminalId, row.pagoId, row.cuotaId), row])
  );
  const plantillaPorPar = new Map<string, (typeof existentes)[number]>();
  for (const row of existentes) {
    const par = `${row.terminalId}:${row.pagoId}`;
    if (!plantillaPorPar.has(par)) plantillaPorPar.set(par, row);
  }

  const faltantes = deseados.filter(
    (d) => !existentesPorClave.has(claveMatriz(d.terminalId, d.pagoId, d.cuotaId))
  );
  if (faltantes.length > 0) {
    await tx.finAnaCosFina.createMany({
      data: faltantes.map((d) => {
        const plantilla = plantillaPorPar.get(`${d.terminalId}:${d.pagoId}`);
        return {
          terminalId: d.terminalId,
          pagoId: d.pagoId,
          cuotaId: d.cuotaId,
          habilitado: plantilla?.habilitado ?? true,
          impCheque: plantilla?.impCheque ?? false,
          diasAcreditacion: plantilla?.diasAcreditacion ?? null,
          arancel: plantilla?.arancel ?? new Prisma.Decimal(0),
          costoFinanciero: plantilla?.costoFinanciero ?? new Prisma.Decimal(0),
        };
      }),
    });
  }

  const deseadoSet = new Set(
    deseados.map((d) => claveMatriz(d.terminalId, d.pagoId, d.cuotaId))
  );
  const huerfanosIds = existentes
    .filter((row) => !deseadoSet.has(claveMatriz(row.terminalId, row.pagoId, row.cuotaId)))
    .map((row) => row.id);
  if (huerfanosIds.length > 0) {
    await tx.finAnaCosFina.deleteMany({ where: { id: { in: huerfanosIds } } });
  }
}
