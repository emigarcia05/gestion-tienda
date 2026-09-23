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
  /** Si true, Cx. Fin. Cobros genera filas por cada cuota del catálogo. */
  aceptaCuotas: boolean;
  /** Si true, hay que vincular ≥ 1 entidad. */
  entidadObligatoria: boolean;
  /** IDs de `tesoreria_cobros_entidades` vinculados. */
  entidadIds: string[];
  /** Nombres MAYÚSCULAS de las entidades vinculadas (mismo orden que `entidadIds`). */
  entidadNombres: string[];
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
