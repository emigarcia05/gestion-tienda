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
  /**
   * Valor único de cada opción del select (id del vínculo cuando hay alias).
   * Mismo orden que `entidadIds`. Si falta, el valor es el id de la entidad.
   */
  entidadOpcionIds?: string[];
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
  /** Valor del select. Único aunque dos alias compartan la entidad. */
  id: string;
  entidadId: string;
  entidadNombre: string;
  /** Alias del vínculo. Vacío si la forma no usa alias. */
  alias: string;
  /** Texto del select. El prioritario lleva la etiqueta PRIORITARIO. */
  etiqueta: string;
  /** Alias o entidad, sin la etiqueta PRIORITARIO. */
  etiquetaBase: string;
};

/** Opciones del select de cobro. Cada alias es una opción. El PRIORITARIO queda primero. */
export function opcionesEntidadCobro(pago: FinAnaCosFinaPagoItem): OpcionEntidadCobro[] {
  const opciones = pago.entidadIds.map((entidadId, indice) => {
    const base = etiquetaOpcionEntidadCobro(pago, indice);
    const prioritario = pago.alias && pago.entidadPrioritaria?.[indice] === true;
    const alias = pago.alias ? (pago.entidadAlias[indice]?.trim() ?? "") : "";
    return {
      id: pago.entidadOpcionIds?.[indice] || entidadId,
      entidadId,
      entidadNombre: pago.entidadNombres[indice] ?? "",
      alias,
      etiqueta: prioritario && base ? `${base} · PRIORITARIO` : base,
      etiquetaBase: base,
      prioritario,
      indice,
    };
  });
  opciones.sort((a, b) => Number(b.prioritario) - Number(a.prioritario) || a.indice - b.indice);
  return opciones.map(({ id, entidadId, entidadNombre, alias, etiqueta, etiquetaBase }) => ({
    id,
    entidadId,
    entidadNombre,
    alias,
    etiqueta,
    etiquetaBase,
  }));
}

export function opcionEntidadCobroPorId(
  pago: FinAnaCosFinaPagoItem,
  opcionId: string
): OpcionEntidadCobro | null {
  return opcionesEntidadCobro(pago).find((opcion) => opcion.id === opcionId) ?? null;
}

/** Si hay una sola opción, su id. Si hay varias, vacío: el usuario elige. */
export function idSiOpcionEntidadUnica(
  pago: FinAnaCosFinaPagoItem | null | undefined
): string {
  if (!pago) return "";
  const opciones = opcionesEntidadCobro(pago);
  return opciones.length === 1 ? opciones[0].id : "";
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
