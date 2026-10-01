import { Prisma } from "@prisma/client";

function claveMatriz(
  terminalId: string | null,
  pagoId: string,
  cuotaId: string | null
): string {
  return `${terminalId ?? ""}:${pagoId}:${cuotaId ?? ""}`;
}

type DbClient = Prisma.TransactionClient;

/**
 * Sincroniza `cobros_cx_fin` con el N:M forma×entidad y el catálogo `cobros_cuotas`.
 * - Si el par forma+entidad tiene cuotas: una fila por cuota.
 * - Si no: una fila con `cuota_id` null.
 * - Forma sin entidades: una fila con `terminal_id` null (entidad vacía en la grilla).
 */
export async function sincronizarMatrizFinAnaCosFina(tx: DbClient): Promise<void> {
  const [vinculos, pagosSinEntidad, cuotas, existentes] = await Promise.all([
    tx.cobrosFormaPagoEntidad.findMany({
      where: { pago: { enCostosFinancieros: true } },
      select: {
        pagoId: true,
        entidadId: true,
      },
    }),
    tx.finAnaCosFinaPagoCat.findMany({
      where: { entidades: { none: {} } },
      select: { id: true },
    }),
    tx.cobrosCuotaVinculo.findMany({
      select: { cuotaId: true, pagoId: true, entidadId: true },
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

  const cuotasPorPar = new Map<string, string[]>();
  for (const cuota of cuotas) {
    const key = `${cuota.entidadId}:${cuota.pagoId}`;
    const cur = cuotasPorPar.get(key) ?? [];
    cur.push(cuota.cuotaId);
    cuotasPorPar.set(key, cur);
  }

  type Deseado = { terminalId: string | null; pagoId: string; cuotaId: string | null };
  const deseados: Deseado[] = [];
  for (const pago of pagosSinEntidad) {
    deseados.push({
      terminalId: null,
      pagoId: pago.id,
      cuotaId: null,
    });
  }
  for (const vinculo of vinculos) {
    const parKey = `${vinculo.entidadId}:${vinculo.pagoId}`;
    const ids = cuotasPorPar.get(parKey) ?? [];
    if (ids.length === 0) {
      deseados.push({
        terminalId: vinculo.entidadId,
        pagoId: vinculo.pagoId,
        cuotaId: null,
      });
      continue;
    }
    for (const cuotaId of ids) {
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
    const par = `${row.terminalId ?? ""}:${row.pagoId}`;
    if (!plantillaPorPar.has(par)) plantillaPorPar.set(par, row);
  }

  const faltantes = deseados.filter(
    (d) => !existentesPorClave.has(claveMatriz(d.terminalId, d.pagoId, d.cuotaId))
  );
  if (faltantes.length > 0) {
    await tx.finAnaCosFina.createMany({
      data: faltantes.map((d) => {
        const plantilla = plantillaPorPar.get(`${d.terminalId ?? ""}:${d.pagoId}`);
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
