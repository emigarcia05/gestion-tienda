import { ARCA_CONDICION_IVA } from "@/lib/facturaFiscal";

/**
 * SSOT de reglas de elección de punto de venta (consulta en Ptos. Vtas.;
 * la emisión automática se cablea sobre este mismo listado).
 */

export const PTO_VTA_REGLA_AMBITO = {
  GENERAL: "general",
  FACTURA_FISCAL: "factura_fiscal",
} as const;

export type PtoVtaReglaAmbito =
  (typeof PTO_VTA_REGLA_AMBITO)[keyof typeof PTO_VTA_REGLA_AMBITO];

export type PtoVtaRegla = {
  id: "sucursal_habilitada" | "fiscal_ri_mismo_iva";
  orden: number;
  ambito: PtoVtaReglaAmbito;
  titulo: string;
  resumen: string;
};

/** Código ARCA 1: cliente RI exige pto. vta. RI. */
export const PTO_VTA_REGLA_RI_CODIGO = ARCA_CONDICION_IVA.RI;

export const PTO_VTA_REGLA_AMBITO_TITULO: Record<PtoVtaReglaAmbito, string | null> = {
  general: null,
  factura_fiscal: "FACTURA FISCAL",
};

export const PTO_VTA_REGLAS: readonly PtoVtaRegla[] = [
  {
    id: "sucursal_habilitada",
    orden: 1,
    ambito: PTO_VTA_REGLA_AMBITO.GENERAL,
    titulo: "SUCURSAL",
    resumen:
      "El pto. vta. elegido debe estar habilitado para la sucursal que emite el comprobante.",
  },
  {
    id: "fiscal_ri_mismo_iva",
    orden: 2,
    ambito: PTO_VTA_REGLA_AMBITO.FACTURA_FISCAL,
    titulo: "RESPONSABLE INSCRIPTO",
    resumen:
      "Si el cliente es Responsable Inscripto, se debe seleccionar un pto. vta. que tenga la misma condición de IVA (Responsable Inscripto).",
  },
];
