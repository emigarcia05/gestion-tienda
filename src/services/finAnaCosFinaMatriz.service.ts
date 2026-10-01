import { Prisma } from "@prisma/client";

function claveMatriz(terminalId: string, pagoId: string, cuotaId: string | null): string {
  return `${terminalId}:${pagoId}:${cuotaId ?? ""}`;
}

type DbClient = Prisma.TransactionClient;

/**
 * Sincroniza `fin_ana_cos_fina` con vínculos N:M forma×entidad:
 * - conserva las cuotas ya configuradas por par forma+entidad;
 * - para un par nuevo, hereda el set de cuotas de otro par de la misma forma de pago;
 * - si no hay plantilla, crea una fila base con `cuota_id = null`.
 * Crea faltantes (copia valores de una fila hermana del mismo par si existe) y borra huérfanas.
 */
export async function sincronizarMatrizFinAnaCosFina(tx: DbClient): Promise<void> {
  const [vinculos, existentes] = await Promise.all([
    tx.cobrosFormaPagoEntidad.findMany({
      where: { pago: { enCostosFinancieros: true } },
      select: {
        pagoId: true,
        entidadId: true,
      },
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

  type Deseado = { terminalId: string; pagoId: string; cuotaId: string | null };
  const deseados: Deseado[] = [];
  const existentesPorPar = new Map<string, (string | null)[]>();
  for (const fila of existentes) {
    const keyPar = `${fila.terminalId}:${fila.pagoId}`;
    const cur = existentesPorPar.get(keyPar) ?? [];
    cur.push(fila.cuotaId);
    existentesPorPar.set(keyPar, cur);
  }
  const plantillaCuotasPorPago = new Map<string, string[]>();
  for (const fila of existentes) {
    if (!fila.cuotaId) continue;
    const cur = plantillaCuotasPorPago.get(fila.pagoId) ?? [];
    cur.push(fila.cuotaId);
    plantillaCuotasPorPago.set(fila.pagoId, cur);
  }

  for (const vinculo of vinculos) {
    const parKey = `${vinculo.entidadId}:${vinculo.pagoId}`;
    const existentesPar = existentesPorPar.get(parKey) ?? [];
    const idsCuota: Array<string | null> =
      existentesPar.length > 0
        ? [...new Set(existentesPar)]
        : (() => {
            const plantilla = [...new Set(plantillaCuotasPorPago.get(vinculo.pagoId) ?? [])];
            return plantilla.length > 0 ? plantilla : [null];
          })();
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
