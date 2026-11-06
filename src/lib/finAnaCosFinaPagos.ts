import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  QrCode,
  ScrollText,
  Smartphone,
} from "lucide-react";

/** Ítem del catálogo `cobros_forma_pago` (con entidades N:M). */
export type FinAnaCosFinaPagoItem = {
  id: string;
  nombre: string;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  /** IDs de `cobros_entidades` vinculados. Vacío = la forma se usa sin entidad. */
  entidadIds: string[];
  /** Nombres MAYÚSCULAS de las entidades vinculadas (mismo orden que `entidadIds`). */
  entidadNombres: string[];
  /**
   * Alias de `cobros_vinc_cajas` de la sucursal (mismo orden que `entidadIds`).
   * Vacío en el catálogo global. Si la forma tiene `alias`, el cobro muestra esto en lugar del nombre.
   */
  entidadAlias: string[];
  /**
   * Mismo orden que `entidadIds`. El alias sugerido del mes (Seguimiento Fiscal)
   * va primero en el select, con la etiqueta PRIORITARIO. No impide elegir otro.
   */
  entidadPrioritaria?: boolean[];
  /** El cobro pide la fecha de acreditación a mano (también true si el vínculo de esa sucursal es cheque). */
  fechaAcreditacionVariable: boolean;
  /** `cobros_forma_pago.alias`. */
  alias: boolean;
  /**
   * Overlay de `cobros_vinc_cajas.es_cheque` al listar formas de una sucursal.
   * En el catálogo global queda false.
   */
  esCheque: boolean;
};

/** Id de forma de pago en simuladores (FK `cobros_forma_pago`). */
export type FormaPagoMargenContribucion = string;

export function filtrarPagosMargenContribucion(
  pagos: FinAnaCosFinaPagoItem[]
): FinAnaCosFinaPagoItem[] {
  return pagos
    .filter((p) => p.enMargenContribucion)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function filtrarPagosCostosFinancieros(
  pagos: FinAnaCosFinaPagoItem[]
): FinAnaCosFinaPagoItem[] {
  return pagos
    .filter((p) => p.enCostosFinancieros)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function etiquetaPagoDesdeItem(item: FinAnaCosFinaPagoItem): string {
  return item.nombre;
}

/** La forma pide alias (`cobros_forma_pago.alias`): el select de cobro se titula ALIAS. */
export function cobroMuestraAlias(
  pago: Pick<FinAnaCosFinaPagoItem, "alias"> | null | undefined
): boolean {
  return pago?.alias === true;
}

/** Texto de la opción: alias del vínculo de la sucursal, o el nombre de la entidad si no hay. */
export function etiquetaOpcionEntidadCobro(
  pago: FinAnaCosFinaPagoItem,
  indice: number
): string {
  if (pago.alias) {
    const alias = pago.entidadAlias[indice]?.trim();
    if (alias) return alias;
  }
  return pago.entidadNombres[indice] ?? "";
}

export type OpcionEntidadCobro = {
  id: string;
  etiqueta: string;
};

/** Opciones del select de cobro. El alias PRIORITARIO queda primero; el resto conserva el orden. */
export function opcionesEntidadCobro(pago: FinAnaCosFinaPagoItem): OpcionEntidadCobro[] {
  const opciones = pago.entidadIds.map((id, indice) => {
    const base = etiquetaOpcionEntidadCobro(pago, indice);
    const prioritario = pago.alias && pago.entidadPrioritaria?.[indice] === true;
    return {
      id,
      etiqueta: prioritario && base ? `${base} · PRIORITARIO` : base,
      prioritario,
      indice,
    };
  });
  opciones.sort((a, b) => Number(b.prioritario) - Number(a.prioritario) || a.indice - b.indice);
  return opciones.map(({ id, etiqueta }) => ({ id, etiqueta }));
}

export function buscarPagoPorId(
  pagos: FinAnaCosFinaPagoItem[],
  id: string
): FinAnaCosFinaPagoItem | undefined {
  return pagos.find((p) => p.id === id);
}

function nombrePagoNormalizado(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/** Ícono Lucide según el nombre del catálogo (sin columna `icono` en BD). */
export function iconoFormaPagoDesdeNombre(nombre: string): LucideIcon {
  const n = nombrePagoNormalizado(nombre);
  if (n.includes("EFECTIVO") || n.includes("CAJA")) return Banknote;
  if (n.includes("CHEQUE")) return ScrollText;
  if (n.includes("QR")) return QrCode;
  if (
    n.includes("DEBIT") ||
    n.includes("CREDIT") ||
    n.includes("TARJETA") ||
    n.includes("VISA") ||
    n.includes("MASTER")
  ) {
    return CreditCard;
  }
  if (
    n.includes("TRANSF") ||
    n.includes("BANCO") ||
    n.includes("CBU") ||
    n.includes("CVU")
  ) {
    return Landmark;
  }
  if (
    n.includes("MERCADO") ||
    n.includes("MODO") ||
    n.includes("BILLETERA") ||
    n.includes("WALLET")
  ) {
    return Smartphone;
  }
  return CircleDollarSign;
}
