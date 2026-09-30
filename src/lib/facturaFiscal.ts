/**
 * Reglas fiscales de mercado interno (WSFEv1). Sin SOAP ni Prisma.
 * PX. LISTA se trata como precio final al cliente (IVA incluido en A/B).
 */

import { parseIsoYmdParts } from "@/lib/fechaArgentina";

export const ARCA_SERVICIO_WSFE = "wsfe" as const;
/** WSAA id del WS Constancia de Inscripción (ex padrón A5). */
export const ARCA_SERVICIO_CONSTANCIA = "ws_sr_constancia_inscripcion" as const;

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

/** IDs de impuesto SUPA en constancia de inscripción. */
export const ARCA_IMPUESTO = {
  MONOTRIBUTO: 20,
  IVA: 30,
  IVA_EXENTO: 32,
} as const;

/** Categorías de monotributo social (constancia ARCA). */
const ARCA_CATEGORIA_MONO_SOCIAL = new Set([61, 98, 99, 100]);

export type ArcaPadronImpuesto = {
  idImpuesto: number;
  estadoImpuesto: string | null;
  descripcionImpuesto: string | null;
};

export type ArcaPadronCategoria = {
  idCategoria: number | null;
  descripcionCategoria: string | null;
};

function impuestoConstanciaActivo(estado: string | null): boolean {
  const e = (estado ?? "AC").trim().toUpperCase();
  return e === "" || e === "AC" || e === "ACTIVO";
}

function tieneImpuestoActivo(list: readonly ArcaPadronImpuesto[], id: number): boolean {
  return list.some((i) => i.idImpuesto === id && impuestoConstanciaActivo(i.estadoImpuesto));
}

/**
 * Condición IVA (`condicion_iva_cod_arca.codigo`) a partir de la constancia.
 * Null si ARCA no informa un régimen claro (no asumir Consumidor Final).
 */
export function condicionIvaDesdeConstanciaArca(args: {
  tieneDatosMonotributo: boolean;
  categoriaMonotributo: ArcaPadronCategoria | null;
  impuestosRegimenGeneral: readonly ArcaPadronImpuesto[];
}): number | null {
  if (args.tieneDatosMonotributo) {
    const cat = args.categoriaMonotributo;
    const desc = (cat?.descripcionCategoria ?? "").toLocaleUpperCase("es-AR");
    if (
      (cat?.idCategoria != null && ARCA_CATEGORIA_MONO_SOCIAL.has(cat.idCategoria)) ||
      desc.includes("SOCIAL")
    ) {
      return ARCA_CONDICION_IVA.MONO_SOCIAL;
    }
    return ARCA_CONDICION_IVA.MONO;
  }
  if (tieneImpuestoActivo(args.impuestosRegimenGeneral, ARCA_IMPUESTO.IVA)) {
    return ARCA_CONDICION_IVA.RI;
  }
  if (tieneImpuestoActivo(args.impuestosRegimenGeneral, ARCA_IMPUESTO.IVA_EXENTO)) {
    return ARCA_CONDICION_IVA.EXENTO;
  }
  return null;
}

/** Razón social, o apellido + nombre (persona física). */
export function nombreDesdeConstanciaArca(args: {
  razonSocial: string | null;
  apellido: string | null;
  nombre: string | null;
}): string | null {
  const razon = (args.razonSocial ?? "").trim();
  if (razon) return razon.replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
  const partes = [args.apellido, args.nombre]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
  if (partes.length === 0) return null;
  return partes.join(" ").replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

/** Alícuotas WSFEv1 `AlicIva.Id`. */
export const ARCA_IVA_ALICUOTA_A_ID: Readonly<Record<number, number>> = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6,
};

const ARCA_IVA_ID_A_ALICUOTA: Readonly<Record<number, number>> = {
  3: 0,
  9: 2.5,
  8: 5,
  4: 10.5,
  5: 21,
  6: 27,
};

/** RG 1415 Anexo II, leyendas de condición del emisor (texto vigente de uso en comprobantes). */
const LEYENDA_CONDICION_IVA_EMISOR: Readonly<Record<number, string>> = {
  1: "IVA RESPONSABLE INSCRIPTO",
  4: "IVA EXENTO",
  6: "RESPONSABLE MONOTRIBUTO",
  13: "MONOTRIBUTISTA SOCIAL",
};

/** RG 5866/2026, Anexo II Apartado A Título II inciso d). */
export const LEYENDA_A_CONSUMIDOR_FINAL = "A CONSUMIDOR FINAL";

/** RG 5614/2024 art. 2 punto 7, inciso g). */
export const LEYENDA_TRANSPARENCIA_FISCAL =
  "Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)";

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

export function leyendaCondicionIvaEmisor(
  codigo: number | null | undefined,
  descripcionCatalogo?: string | null
): string {
  if (codigo != null && LEYENDA_CONDICION_IVA_EMISOR[codigo]) {
    return LEYENDA_CONDICION_IVA_EMISOR[codigo];
  }
  const catalogo = (descripcionCatalogo ?? "").trim();
  return catalogo ? catalogo.toLocaleUpperCase("es-AR") : "";
}

/**
 * RG 5614 art. 2 punto 5: el emisor responsable inscripto discrimina alícuota e IVA
 * ante responsable inscripto (factura A) o monotributista (factura B).
 */
export function operacionDiscriminaIva(args: {
  letra: string;
  receptorCondicionIva: number;
}): boolean {
  if (args.letra === "A") return true;
  if (
    args.letra === "B" &&
    (args.receptorCondicionIva === ARCA_CONDICION_IVA.MONO ||
      args.receptorCondicionIva === ARCA_CONDICION_IVA.MONO_SOCIAL)
  ) {
    return true;
  }
  return false;
}

/**
 * RG 5614 inciso g) + art. 99 Ley 27.743: consumidor final, exento o no alcanzado.
 */
export function operacionTransparenciaFiscal(receptorCondicionIva: number): boolean {
  return (
    receptorCondicionIva === ARCA_CONDICION_IVA.CF ||
    receptorCondicionIva === ARCA_CONDICION_IVA.EXENTO
  );
}

export type AlicuotaRepresentacion = {
  alicuota: number;
  baseImp: number;
  importe: number;
};

/** Importes de IVA de la autorización. Si el recálculo no cierra, usa el neto e IVA guardados. */
export function alicuotasParaRepresentacion(args: {
  lineas: readonly LineaImporteFiscal[];
  letra: ArcaLetra;
  impNeto: number;
  impIva: number;
}): AlicuotaRepresentacion[] {
  const respaldo: AlicuotaRepresentacion[] = [
    {
      alicuota: args.lineas[0]?.alicuotaIva ?? ARCA_ALICUOTA_IVA_DEFAULT,
      baseImp: args.impNeto,
      importe: args.impIva,
    },
  ];
  if (args.letra === "C") return [];
  const tot = armarTotalesWsfe(args.lineas, args.letra);
  if ("ok" in tot) return respaldo;
  const rows = tot.alicIva.map((a) => ({
    alicuota: ARCA_IVA_ID_A_ALICUOTA[a.id] ?? respaldo[0]!.alicuota,
    baseImp: a.baseImp,
    importe: a.importe,
  }));
  const neto = roundArs2(rows.reduce((s, r) => s + r.baseImp, 0));
  const iva = roundArs2(rows.reduce((s, r) => s + r.importe, 0));
  if (Math.abs(neto - args.impNeto) > 0.02 || Math.abs(iva - args.impIva) > 0.02) {
    return respaldo;
  }
  return rows;
}

/**
 * Identificación opcional del consumidor final (DNI o CUIT/CUIL).
 * No cambia la condición IVA: sigue siendo consumidor final.
 */
export function aplicarDocumentoConsumidorFinal(
  receptor: ReceptorFiscalSnapshot,
  documentoRaw: string
): { ok: true; receptor: ReceptorFiscalSnapshot } | { ok: false; error: string } {
  const documento = documentoRaw.replace(/\D/g, "");
  if (!documento) return { ok: true, receptor };
  if (receptor.condicionIva !== ARCA_CONDICION_IVA.CF) {
    return { ok: true, receptor };
  }
  if (documento.length >= 7 && documento.length <= 8) {
    return {
      ok: true,
      receptor: {
        ...receptor,
        docTipo: ARCA_DOC_TIPO.DNI,
        docNro: documento,
      },
    };
  }
  if (documento.length === 11 && esCuitValido(documento)) {
    return {
      ok: true,
      receptor: {
        ...receptor,
        docTipo: ARCA_DOC_TIPO.CUIT,
        docNro: documento,
      },
    };
  }
  return {
    ok: false,
    error: "Documento inválido. Usá DNI (7 u 8 dígitos) o CUIT (11 dígitos).",
  };
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

export function esTipoComprobanteFiscal(
  tipo: string
): tipo is "factura_fiscal" | "nota_credito_fiscal" {
  return tipo === "factura_fiscal" || tipo === "nota_credito_fiscal";
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

/** Dígitos del N° (p. ej. últimos 5 en Lista Comprobantes). Vacío si no hay números. */
export function ultimosDigitosNroComprobante(
  nroComprobante: string,
  cantidad: number
): string {
  const digits = nroComprobante.replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-cantidad);
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

export type ReceptorFiscalSnapshot = {
  docTipo: number;
  docNro: string;
  condicionIva: number;
};

export const RECEPTOR_FISCAL_CONSUMIDOR_FINAL: ReceptorFiscalSnapshot = {
  docTipo: ARCA_DOC_TIPO.CF,
  docNro: "0",
  condicionIva: ARCA_CONDICION_IVA.CF,
};

/**
 * Receptor fiscal desde el catálogo de clientes.
 * CUIT válido + condición IVA → esos datos; si falta alguno → Consumidor Final.
 */
export function receptorFiscalDesdeCliente(opts: {
  cuit: string | null;
  condicionIva: number | null;
}): ReceptorFiscalSnapshot {
  const cuit = (opts.cuit ?? "").replace(/\D/g, "");
  if (!esCuitValido(cuit) || opts.condicionIva == null) {
    return { ...RECEPTOR_FISCAL_CONSUMIDOR_FINAL };
  }
  return {
    docTipo: ARCA_DOC_TIPO.CUIT,
    docNro: cuit,
    condicionIva: opts.condicionIva,
  };
}

/** Catálogo del cliente si hay FK; si no, fallback (NC desde original) o CF. */
export function receptorFiscalParaEmitir(opts: {
  cliente: { cuit: string | null; condicionIva: number | null } | null;
  fallback?: {
    docTipo?: number;
    docNro?: string;
    condicionIva?: number;
  };
}): ReceptorFiscalSnapshot {
  if (opts.cliente) {
    return receptorFiscalDesdeCliente(opts.cliente);
  }
  const fb = opts.fallback;
  if (fb?.docTipo != null && fb.condicionIva != null && fb.docNro != null && fb.docNro !== "") {
    return {
      docTipo: fb.docTipo,
      docNro: fb.docNro,
      condicionIva: fb.condicionIva,
    };
  }
  return { ...RECEPTOR_FISCAL_CONSUMIDOR_FINAL };
}

export function validarFechaCbteIso(fechaIso: string): string | null {
  const p = parseIsoYmdParts(fechaIso);
  if (!p) return "Fecha de comprobante inválida.";
  return null;
}
