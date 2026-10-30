/**
 * Pto. vta. por sucursal × grupo de factura (`sucursal_ptos_vtas_factura`).
 * `A` = receptor Responsable Inscripto; `BC` = resto (B si el emisor es RI, C si es Monotributo / Exento).
 */
import { ARCA_CONDICION_IVA } from "@/lib/facturaFiscal";

export const GRUPOS_FACTURA_PTO_VTA = ["A", "BC"] as const;

export type GrupoFacturaPtoVta = (typeof GRUPOS_FACTURA_PTO_VTA)[number];

export const ETIQUETA_GRUPO_FACTURA_PTO_VTA: Record<GrupoFacturaPtoVta, string> = {
  A: 'FACT. "A"',
  BC: 'FACT. "B/C"',
};

export function esGrupoFacturaPtoVta(valor: string): valor is GrupoFacturaPtoVta {
  return (GRUPOS_FACTURA_PTO_VTA as readonly string[]).includes(valor);
}

export function grupoFacturaPorReceptor(
  receptorCondicionIva: number | null | undefined
): GrupoFacturaPtoVta {
  return receptorCondicionIva === ARCA_CONDICION_IVA.RI ? "A" : "BC";
}

/** Solo un emisor Responsable Inscripto emite factura A. */
export function ptoVtaAdmiteGrupoFactura(
  grupo: GrupoFacturaPtoVta,
  emisorCondicionIva: number | null
): boolean {
  return grupo === "A" ? emisorCondicionIva === ARCA_CONDICION_IVA.RI : true;
}

export function mensajePtoVtaFacturaSinConfigurar(grupo: GrupoFacturaPtoVta): string {
  return `La sucursal no tiene punto de venta configurado para ${ETIQUETA_GRUPO_FACTURA_PTO_VTA[grupo]} (Administrador · Seguimiento Fiscal).`;
}
