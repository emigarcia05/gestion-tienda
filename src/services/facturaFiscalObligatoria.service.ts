/**
 * Factura Fiscal Obligatoria por titular (`tesoreria_titulares.fac_obligatoria_*`).
 * Restante = monto − Σ ventas fiscales + Σ NC fiscales (`imp_total × cotizacion`), autorizadas,
 * de los ptos. vta. del titular, con `created_at >= fac_obligatoria_desde`.
 * Mientras el restante sea > 0, una venta no fiscal de esos ptos. vta. se emite como fiscal.
 */
import { prisma } from "@/lib/prisma";
import type { GuardarFacturaFiscalObligatoriaInput } from "@/lib/validations/facturaFiscalObligatoria";
import type { ServiceResult } from "@/types";

const TIPOS_FISCALES = ["factura_fiscal", "nota_credito_fiscal"] as const;

export interface FacturaFiscalObligatoriaFila {
  titularId: string;
  titular: string;
  /** `null` = sin obligación cargada; puede ser ≤ 0 si ya se cumplió. */
  restante: number | null;
}

type TitularObligacion = {
  nombre: string;
  facObligatoriaMonto: number | null;
  facObligatoriaDesde: Date | null;
};

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Restante por nombre de titular (solo los que tienen obligación cargada). */
async function restantesPorTitular(titulares: TitularObligacion[]): Promise<Map<string, number>> {
  const conObligacion = titulares.filter(
    (t): t is TitularObligacion & { facObligatoriaMonto: number; facObligatoriaDesde: Date } =>
      t.facObligatoriaMonto != null && t.facObligatoriaDesde != null
  );
  const out = new Map<string, number>();
  if (conObligacion.length === 0) return out;

  const desdeMin = conObligacion.reduce(
    (min, t) => (t.facObligatoriaDesde < min ? t.facObligatoriaDesde : min),
    conObligacion[0]!.facObligatoriaDesde
  );
  const comprobantes = await prisma.comprobanteVta.findMany({
    where: {
      estado: "autorizado",
      tipoComprobante: { in: [...TIPOS_FISCALES] },
      createdAt: { gte: desdeMin },
      ptoVta: { titular: { in: conObligacion.map((t) => t.nombre) } },
    },
    select: {
      tipoComprobante: true,
      impTotal: true,
      cotizacion: true,
      createdAt: true,
      ptoVta: { select: { titular: true } },
    },
  });

  for (const t of conObligacion) {
    let facturado = 0;
    for (const c of comprobantes) {
      if (c.ptoVta.titular !== t.nombre || c.createdAt < t.facObligatoriaDesde) continue;
      const signo = c.tipoComprobante === "nota_credito_fiscal" ? -1 : 1;
      facturado += signo * Number(c.impTotal) * Number(c.cotizacion);
    }
    out.set(t.nombre, redondear2(t.facObligatoriaMonto - facturado));
  }
  return out;
}

/** Titulares con al menos un pto. vta. (A→Z). */
export async function listarFacturaFiscalObligatoria(): Promise<FacturaFiscalObligatoriaFila[]> {
  const titulares = await prisma.tesoreriaTitular.findMany({
    where: { ptoVtas: { some: {} } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, facObligatoriaMonto: true, facObligatoriaDesde: true },
  });
  const restantes = await restantesPorTitular(titulares);
  return titulares.map((t) => ({
    titularId: t.id,
    titular: t.nombre.toLocaleUpperCase("es-AR"),
    restante: restantes.get(t.nombre) ?? null,
  }));
}

/** `monto = null` quita la obligación; si no, la reinicia desde ahora con ese monto. */
export async function guardarFacturaFiscalObligatoria(
  input: GuardarFacturaFiscalObligatoriaInput
): Promise<ServiceResult<FacturaFiscalObligatoriaFila>> {
  const existe = await prisma.tesoreriaTitular.findUnique({
    where: { id: input.titularId },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "El titular no existe." };

  const row = await prisma.tesoreriaTitular.update({
    where: { id: input.titularId },
    data:
      input.monto == null
        ? { facObligatoriaMonto: null, facObligatoriaDesde: null }
        : { facObligatoriaMonto: input.monto, facObligatoriaDesde: new Date() },
    select: { id: true, nombre: true, facObligatoriaMonto: true, facObligatoriaDesde: true },
  });
  return {
    success: true,
    data: {
      titularId: row.id,
      titular: row.nombre.toLocaleUpperCase("es-AR"),
      restante: row.facObligatoriaMonto,
    },
  };
}

/** true si el titular (por nombre de `tesoreria_titulares`) todavía tiene facturación obligatoria pendiente. */
export async function titularTieneFacturaObligatoriaPendiente(nombre: string): Promise<boolean> {
  const titular = await prisma.tesoreriaTitular.findUnique({
    where: { nombre },
    select: { nombre: true, facObligatoriaMonto: true, facObligatoriaDesde: true },
  });
  if (!titular) return false;
  const restante = (await restantesPorTitular([titular])).get(titular.nombre);
  return restante != null && restante > 0;
}
