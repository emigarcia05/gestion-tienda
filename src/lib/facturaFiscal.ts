/**
 * Reglas fiscales de mercado interno (WSFEv1). Sin SOAP ni Prisma.
 * PX. LISTA se trata como precio final al cliente (IVA incluido en A/B).
 */

import { parseIsoYmdParts } from "@/lib/fechaArgentina";

export const ARCA_SERVICIO_WSFE = "wsfe" as const;

export const ARCA_DOC_TIPO = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CF: 99,
} as const;

export const ARCA_CBTE_TIPO = {
  FACTURA_A: 1,
  NC_A: 3,
  FACTURA_B: 6,
  NC_B: 8,
  FACTURA_C: 11,
  NC_C: 13,
} as const;

export const ARCA_CONDICION_IVA = {
  RI: 1,
  EXENTO: 4,
  CF: 5,
  MONO: 6,
  PROV_EXT: 8,
  CLI_EXT: 9,
  MONO_SOCIAL: 13,
} as const;

/** Alícuotas WSFEv1 `AlicIva.Id`. */
export const ARCA_IVA_ALICUOTA_A_ID: Readonly<Record<number, number>> = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6,
};

export const ARCA_ALICUOTA_IVA_DEFAULT = 21;

/** Tope CF sin identificar (DocTipo 99 / DocNro 0). Ajustable por ENV. */
export const ARCA_CF_MAX_SIN_DOC_DEFAULT = 10_000_000;

export type ArcaLetra = "A" | "B" | "C";

export type ArcaAmbiente = "homo" | "prod";

export function roundArs2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function ivaIdDesdeAlicuota(alicuota: number): number | null {
  const id = ARCA_IVA_ALICUOTA_A_ID[alicuota];
  return id == null ? null : id;
}

/** Dígito verificador CUIT/CUIL (11 dígitos). */
export function digitoVerificadorCuit(base10: string): number | null {
  if (!/^\d{10}$/.test(base10)) return null;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i += 1) {
    suma += Number(base10[i]) * pesos[i];
  }
  const dv = 11 - (suma % 11);
  if (dv === 11) return 0;
  if (dv === 10) return 9;
  return dv;
}

export function esCuitValido(cuit: string): boolean {
  const d = cuit.replace(/\D/g, "");
  if (!/^\d{11}$/.test(d)) return false;
  const dv = digitoVerificadorCuit(d.slice(0, 10));
  return dv != null && dv === Number(d[10]);
}

export function esTipoLocalFiscal(
  tipo: string
): tipo is "factura_fiscal" | "nota_credito" {
  return tipo === "factura_fiscal" || tipo === "nota_credito";
}

export function emisorEsMonotributo(condicionIva: number): boolean {
  return (
    condicionIva === ARCA_CONDICION_IVA.MONO ||
    condicionIva === ARCA_CONDICION_IVA.MONO_SOCIAL
  );
}

export function emisorEsResponsableInscripto(condicionIva: number): boolean {
  return condicionIva === ARCA_CONDICION_IVA.RI;
}

export function emisorEsExento(condicionIva: number): boolean {
  return condicionIva === ARCA_CONDICION_IVA.EXENTO;
}

export type ResolverLetraInput = {
  emisorCondicionIva: number;
  receptorCondicionIva: number;
  esNotaCredito: boolean;
};

export type ResolverLetraOk = {
  ok: true;
  letra: ArcaLetra;
  cbteTipo: number;
};

export type ResolverLetraFail = { ok: false; error: string };

export function resolverLetraYCbteTipo(
  input: ResolverLetraInput
): ResolverLetraOk | ResolverLetraFail {
  const rec = input.receptorCondicionIva;
  if (
    rec === ARCA_CONDICION_IVA.PROV_EXT ||
    rec === ARCA_CONDICION_IVA.CLI_EXT
  ) {
    return {
      ok: false,
      error: "Receptor del exterior no está soportado (requiere WSFEX).",
    };
  }

  if (emisorEsResponsableInscripto(input.emisorCondicionIva)) {
    if (rec === ARCA_CONDICION_IVA.RI) {
      return {
        ok: true,
        letra: "A",
        cbteTipo: input.esNotaCredito
          ? ARCA_CBTE_TIPO.NC_A
          : ARCA_CBTE_TIPO.FACTURA_A,
      };
    }
    return {
      ok: true,
      letra: "B",
      cbteTipo: input.esNotaCredito
        ? ARCA_CBTE_TIPO.NC_B
        : ARCA_CBTE_TIPO.FACTURA_B,
    };
  }

  if (
    emisorEsMonotributo(input.emisorCondicionIva) ||
    emisorEsExento(input.emisorCondicionIva)
  ) {
    return {
      ok: true,
      letra: "C",
      cbteTipo: input.esNotaCredito
        ? ARCA_CBTE_TIPO.NC_C
        : ARCA_CBTE_TIPO.FACTURA_C,
    };
  }

  return {
    ok: false,
    error: "La condición IVA del emisor no permite emitir WSFEv1 de mercado interno.",
  };
}

export type LineaImporteFiscal = {
  importeFinal: number;
  alicuotaIva: number;
};

export type TotalesWsfe = {
  impNeto: number;
  impIva: number;
  impTotConc: number;
  impOpEx: number;
  impTrib: number;
  impExento: number;
  impTotal: number;
  alicIva: { id: number; baseImp: number; importe: number }[];
};

/**
 * Desglose para FECAERequest.
 * Letra C: no discrimina IVA (`ImpIVA = 0`, sin `AlicIva`).
 * A/B: el importe de línea es final con IVA; se extrae neto + IVA.
 */
export function armarTotalesWsfe(
  lineas: readonly LineaImporteFiscal[],
  letra: ArcaLetra
): TotalesWsfe | { ok: false; error: string } {
  const impTotal = roundArs2(lineas.reduce((s, l) => s + l.importeFinal, 0));
  if (impTotal <= 0) {
    return { ok: false, error: "El total del comprobante debe ser mayor a 0." };
  }

  if (letra === "C") {
    return {
      impNeto: impTotal,
      impIva: 0,
      impTotConc: 0,
      impOpEx: 0,
      impTrib: 0,
      impExento: 0,
      impTotal,
      alicIva: [],
    };
  }

  const porAlic = new Map<number, { base: number; iva: number }>();
  let impNeto = 0;
  let impIva = 0;
  for (const linea of lineas) {
    const id = ivaIdDesdeAlicuota(linea.alicuotaIva);
    if (id == null) {
      return {
        ok: false,
        error: `Alícuota IVA ${linea.alicuotaIva} no es un Id WSFEv1 conocido.`,
      };
    }
    const factor = 1 + linea.alicuotaIva / 100;
    const neto = roundArs2(linea.importeFinal / factor);
    const iva = roundArs2(linea.importeFinal - neto);
    impNeto = roundArs2(impNeto + neto);
    impIva = roundArs2(impIva + iva);
    const prev = porAlic.get(id) ?? { base: 0, iva: 0 };
    porAlic.set(id, {
      base: roundArs2(prev.base + neto),
      iva: roundArs2(prev.iva + iva),
    });
  }

  const alicIva = [...porAlic.entries()].map(([id, v]) => ({
    id,
    baseImp: v.base,
    importe: v.iva,
  }));

  const sumaAlic = roundArs2(
    alicIva.reduce((s, a) => s + a.baseImp + a.importe, 0)
  );
  const esperado = roundArs2(impNeto + impIva);
  if (Math.abs(sumaAlic - esperado) > 0.05) {
    return { ok: false, error: "Los importes de IVA no cierran con el neto." };
  }

  const reconstruido = roundArs2(impNeto + impIva);
  const ajuste = roundArs2(impTotal - reconstruido);
  if (Math.abs(ajuste) >= 0.01 && alicIva.length > 0) {
    const last = alicIva[alicIva.length - 1];
    last.importe = roundArs2(last.importe + ajuste);
    impIva = roundArs2(impIva + ajuste);
  }

  return {
    impNeto,
    impIva,
    impTotConc: 0,
    impOpEx: 0,
    impTrib: 0,
    impExento: 0,
    impTotal,
    alicIva,
  };
}

export function coherenciaImpTotal(t: TotalesWsfe): boolean {
  const suma = roundArs2(
    t.impNeto + t.impTotConc + t.impOpEx + t.impTrib + t.impIva
  );
  return Math.abs(suma - t.impTotal) < 0.02;
}

export function formatoNroComprobante(
  ptoVenta: string,
  cbteNro: number | null
): string {
  if (cbteNro == null || cbteNro <= 0) return "";
  return `${ptoVenta}-${String(cbteNro).padStart(8, "0")}`;
}

export function ptoVentaAEnteroArca(ptoVenta: string): number {
  return Number.parseInt(ptoVenta, 10);
}

export function docNroAEnteroArca(docNro: string): number {
  const d = docNro.replace(/\D/g, "");
  if (!d) return 0;
  const n = Number.parseInt(d, 10);
  return Number.isFinite(n) ? n : 0;
}

export function receptorRequiereCuit(condicionIva: number): boolean {
  return (
    condicionIva === ARCA_CONDICION_IVA.RI ||
    condicionIva === ARCA_CONDICION_IVA.MONO ||
    condicionIva === ARCA_CONDICION_IVA.MONO_SOCIAL ||
    condicionIva === ARCA_CONDICION_IVA.EXENTO
  );
}

export function validarFechaCbteIso(fechaIso: string): string | null {
  const p = parseIsoYmdParts(fechaIso);
  if (!p) return "Fecha de comprobante inválida.";
  return null;
}
