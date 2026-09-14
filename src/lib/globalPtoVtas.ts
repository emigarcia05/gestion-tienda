/** Catálogo `ptos_vtas` (ex `global_pto_vtas`) + sucursales (`global_pto_vta_sucursales`). */

export const PTO_VTA_CONDICIONES_IVA = [
  "Responsable Inscripto",
  "Monotributista",
] as const;

export type PtoVtaCondicionIva = (typeof PTO_VTA_CONDICIONES_IVA)[number];

export const PTO_VTA_CONDICION_IVA_LABELS: Record<PtoVtaCondicionIva, string> = {
  "Responsable Inscripto": "RESPONSABLE INSCRIPTO",
  Monotributista: "MONOTRIBUTO",
};

export type GlobalPtoVtaSucursalOption = {
  id: string;
  nombre: string;
};

export type GlobalPtoVtaItem = {
  id: string;
  /** CHAR(5) con ceros a la izquierda (ej. `00002`). */
  ptoVenta: string;
  nombreTitular: string;
  cuit: string | null;
  iiBb: string | null;
  iiBbMultilateral: boolean;
  condicionIva: PtoVtaCondicionIva | null;
  domicilioComercial: string | null;
  /** `YYYY-MM-DD` o null. */
  inicioActividades: string | null;
  sucursales: GlobalPtoVtaSucursalOption[];
};

export function esPtoVtaCondicionIva(v: string): v is PtoVtaCondicionIva {
  return (PTO_VTA_CONDICIONES_IVA as readonly string[]).includes(v);
}

/** Normaliza a CHAR(5) con relleno de ceros (1…99999 → `00001`…`99999`). */
export function normalizarPtoVentaCodigo(raw: string | number): string | null {
  const digits = String(raw).trim().replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > 99_999) return null;
  return String(n).padStart(5, "0");
}

/** Para cruzar con `nro_pto_vta` DUX (entero). */
export function ptoVentaCodigoANumero(codigo: string): number {
  return Number.parseInt(codigo, 10);
}
