/**
 * Constantes del módulo Factura (área Facturación).
 * Persistencia en `comprobantes_vtas`; fiscal vía WSAA + WSFEv1.
 */

import { CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT } from "@/lib/envios";

export const FACTURA_TIPOS = [
  "presupuesto",
  "factura_no_fiscal",
  "factura_fiscal",
  "nota_credito_no_fiscal",
  "nota_credito_fiscal",
] as const;

export type FacturaTipo = (typeof FACTURA_TIPOS)[number];

export const FACTURA_TIPO_LABELS: Record<FacturaTipo, string> = {
  presupuesto: "PRESUPUESTO",
  factura_no_fiscal: "FACTURA NO FISCAL",
  factura_fiscal: "FACTURA FISCAL",
  nota_credito_no_fiscal: "NOTA CRÉDITO NO FISCAL",
  nota_credito_fiscal: "NOTA CRÉDITO FISCAL",
};

/** Valor inicial del select en Crear. */
export const FACTURA_TIPO_DEFAULT: FacturaTipo = "presupuesto";

/** Clase de comprobante en la UI de Crear (el persistido sigue siendo `FacturaTipo`). */
export const FACTURA_CLASES = ["presupuesto", "venta", "nota_credito"] as const;
export type FacturaClase = (typeof FACTURA_CLASES)[number];

export const FACTURA_CLASE_LABELS: Record<FacturaClase, string> = {
  presupuesto: "PRESUPUESTO",
  venta: "VENTA",
  nota_credito: "NOTA DE CRÉDITO",
};

export const FACTURA_CONDICIONES_FISCALES = ["fiscal", "no_fiscal"] as const;
export type FacturaCondicionFiscal = (typeof FACTURA_CONDICIONES_FISCALES)[number];

export const FACTURA_CONDICION_FISCAL_LABELS: Record<FacturaCondicionFiscal, string> = {
  fiscal: "FISCAL",
  no_fiscal: "NO FISCAL",
};

export function claseDesdeFacturaTipo(tipo: FacturaTipo): FacturaClase {
  if (tipo === "presupuesto") return "presupuesto";
  if (tipo === "nota_credito_fiscal" || tipo === "nota_credito_no_fiscal") {
    return "nota_credito";
  }
  return "venta";
}

export function condicionFiscalDesdeFacturaTipo(
  tipo: FacturaTipo
): FacturaCondicionFiscal | null {
  if (tipo === "presupuesto") return null;
  if (tipo === "factura_fiscal" || tipo === "nota_credito_fiscal") return "fiscal";
  return "no_fiscal";
}

export function facturaTipoDesdeClaseYFiscal(
  clase: FacturaClase,
  fiscal: FacturaCondicionFiscal
): FacturaTipo {
  if (clase === "presupuesto") return "presupuesto";
  if (clase === "venta") {
    return fiscal === "fiscal" ? "factura_fiscal" : "factura_no_fiscal";
  }
  return fiscal === "fiscal" ? "nota_credito_fiscal" : "nota_credito_no_fiscal";
}

export const MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE =
  "El cliente superó el monto máximo de cuenta corriente. No se pueden emitir más facturas.";

/** True si hay tope configurado y el saldo CC ya lo supera (no se emite venta). */
export function clienteSuperaTopeCtaCorriente(
  saldo: number,
  tope: number | null | undefined
): boolean {
  if (tope == null) return false;
  return saldo > tope;
}

/** Entero 1–365 o null si el texto está vacío / inválido. */
export function parseDiasVencimiento(raw: string): number | null {
  const t = raw.trim();
  if (!t || !/^\d+$/.test(t)) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isInteger(n) || n < 1 || n > 365) return null;
  return n;
}

/**
 * Vencimiento de una venta a crédito: el plazo agendado del cliente.
 * Sin cliente de catálogo (p. ej. CONSUMIDOR FINAL) → null.
 */
export function diasVencimientoDesdePlazoCliente(
  plazo: number | null | undefined
): number | null {
  if (plazo == null) return null;
  if (!Number.isInteger(plazo) || plazo < 1 || plazo > 365) {
    return CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT;
  }
  return plazo;
}

/** Texto de visor: `PRESUPUESTO` o `VENTA - FISCAL`. */
export function etiquetaFacturaTipoVisor(tipo: FacturaTipo): string {
  const clase = claseDesdeFacturaTipo(tipo);
  const fiscal = condicionFiscalDesdeFacturaTipo(tipo);
  if (fiscal == null) return FACTURA_CLASE_LABELS[clase];
  return `${FACTURA_CLASE_LABELS[clase]} - ${FACTURA_CONDICION_FISCAL_LABELS[fiscal]}`;
}

export function esFacturaTipo(value: string): value is FacturaTipo {
  return (FACTURA_TIPOS as readonly string[]).includes(value);
}

/** Tipos que autorizan CAE vía WSFEv1. */
export function esFacturaTipoFiscal(
  tipo: FacturaTipo
): tipo is "factura_fiscal" | "nota_credito_fiscal" {
  return tipo === "factura_fiscal" || tipo === "nota_credito_fiscal";
}

export function esFacturaTipoNotaCredito(tipo: FacturaTipo): boolean {
  return tipo === "nota_credito_no_fiscal" || tipo === "nota_credito_fiscal";
}

/** Ventas (fiscal y no fiscal): el modal post-emisión muestra sección cobro. */
export function esFacturaTipoVenta(
  tipo: FacturaTipo
): tipo is "factura_fiscal" | "factura_no_fiscal" {
  return tipo === "factura_fiscal" || tipo === "factura_no_fiscal";
}

export type FacturaEfectoStock = "salida" | "ingreso" | "ninguno";

/** Regla de stock por tipo (se persiste en `efecto_stock`). */
export function efectoStockPorTipo(tipo: FacturaTipo): FacturaEfectoStock {
  switch (tipo) {
    case "factura_no_fiscal":
    case "factura_fiscal":
      return "salida";
    case "nota_credito_no_fiscal":
      return "ingreso";
    case "nota_credito_fiscal":
    case "presupuesto":
      return "ninguno";
  }
}

/** Nombre persistido / PDF cuando el cliente es Consumidor Final. */
export const FACTURA_CLIENTE_CONSUMIDOR_FINAL = "CONSUMIDOR FINAL";

export const FACTURA_BOTON_CLIENTE_CONSUMIDOR_FINAL =
  "El cliente es CONSUMIDOR FINAL";

export function nombreClienteFactura(raw: string): string {
  const nombre = raw.trim().toLocaleUpperCase("es-AR");
  return nombre || FACTURA_CLIENTE_CONSUMIDOR_FINAL;
}

export function esClienteFacturaVacio(raw: string): boolean {
  return raw.trim() === "";
}

export function esClienteConsumidorFinalCargado(raw: string): boolean {
  return (
    raw.trim().toLocaleUpperCase("es-AR") === FACTURA_CLIENTE_CONSUMIDOR_FINAL
  );
}

/**
 * «CONSUMIDOR FINAL» explícito no exige ítem del catálogo.
 * Vacío no cuenta: hay que cargar CF o elegir un cliente.
 * Cualquier otro texto (p. ej. «MAT») sí: hay que elegir de la lista.
 */
export function clienteFacturaRequiereCatalogo(raw: string): boolean {
  if (esClienteFacturaVacio(raw) || esClienteConsumidorFinalCargado(raw)) {
    return false;
  }
  return true;
}

export const MENSAJE_CLIENTE_FACTURA_NO_SELECCIONADO =
  "Seleccioná un cliente de la lista.";

export const MENSAJE_CLIENTE_FACTURA_VACIO =
  "Seleccioná un cliente o CONSUMIDOR FINAL.";

/** Null si se puede emitir; mensaje si falta CF explícito o `clienteId`. */
export function mensajeClienteFacturaNoSeleccionado(
  raw: string,
  clienteId: string | null | undefined
): string | null {
  if (esClienteFacturaVacio(raw) && !clienteId) {
    return MENSAJE_CLIENTE_FACTURA_VACIO;
  }
  if (!clienteFacturaRequiereCatalogo(raw)) return null;
  if (clienteId) return null;
  return MENSAJE_CLIENTE_FACTURA_NO_SELECCIONADO;
}

/** Máximo de sugerencias en el typeahead de productos (Crear). */
export const FACTURA_BUSQUEDA_PRODUCTOS_TAKE = 10;

/** Mínimo de caracteres (trim) para disparar la búsqueda de productos. */
export const FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS = 3;

/** Máximo de sugerencias en el typeahead de clientes (Crear). */
export const FACTURA_BUSQUEDA_CLIENTES_TAKE = 10;

/** Mínimo de caracteres (trim) para disparar la búsqueda de clientes. */
export const FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS = 3;

/** Tope de % de descuento en máscara (100,00 %). */
export const FACTURA_DESCUENTO_MAX_CENTS = 10_000;

export type FacturaComprobanteEstado = "borrador" | "autorizado" | "rechazado";

export type FacturaComprobanteListItem = {
  id: string;
  tipo: FacturaTipo;
  letra: string | null;
  fechaIso: string;
  nroComprobante: string;
  cliente: string;
  impTotal: number;
  /** `imp_total` si es venta CC con saldo pendiente; si no, `null`. */
  saldoPendiente: number | null;
  /** Días hasta el vencimiento (`fecha` + `dias_vencimiento` − hoy AR); negativo si vencido. */
  diasParaVencer: number | null;
  /** Códigos de `sucursales` asociadas al pto. vta. del comprobante (`global_pto_vta_sucursales`). */
  sucursalCodigos: string[];
  cae: string | null;
  caeVtoIso: string | null;
  resultado: string | null;
  estado: FacturaComprobanteEstado;
  ambiente: string;
  puedeNc: boolean;
};

/** Opción del filtro SUCURSAL en Lista Comprobantes / Presupuestos. */
export type FacturaSucursalFiltroOption = {
  codigo: string;
  nombre: string;
};

export type FacturaPtoVtaOpcion = {
  id: string;
  ptoVenta: string;
  titular: string;
  cuit: string | null;
  condicionIva: number | null;
  condicionIvaDescripcion: string | null;
};

export type FacturaEmitirResultado = {
  id: string;
  nroComprobante: string;
  cae: string | null;
  caeVtoIso: string | null;
  resultado: string | null;
  estado: FacturaComprobanteEstado;
  tipo: FacturaTipo;
  letra: string | null;
};

/** Línea local del remito en Crear. */
export type FacturaLineaLocal = {
  /** Clave estable en la grilla (permite el mismo cod en varias filas). */
  key: string;
  codTienda: string;
  descripcion: string;
  cantidad: number;
  pxLista: number;
  /**
   * Descuento especial de la línea.
   * `null` = hereda el % global del pie; número = override (p. ej. 20 con global 25).
   */
  descuentoPctEspecial: number | null;
  /** Comentario de línea (MAYÚSCULAS); vacío = sin comentario. */
  comentario: string;
};

/**
 * Descuento de comprobante (Crear, estado local).
 * - `porcentaje`: aplica el % a todos los PX. LISTA (salvo override de línea).
 * - `total_fac`: mantiene un TOTAL C/ DESC. objetivo y recalcula el % si cambian líneas/cantidades.
 */
export type FacturaDescuentoEstado = {
  fuente: "porcentaje" | "total_fac";
  /** 0–100 */
  porcentaje: number;
  /** Objetivo de TOTAL C/ DESC. cuando `fuente === "total_fac"`. */
  totalFacObjetivo: number | null;
};

export function clampDescuentoPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

export function totalLineaLista(
  linea: Pick<FacturaLineaLocal, "cantidad" | "pxLista">
): number {
  return linea.cantidad * linea.pxLista;
}

export function totalLineaFactura(
  linea: Pick<FacturaLineaLocal, "cantidad" | "pxLista">
): number {
  return totalLineaLista(linea);
}

export function pxConDescuento(pxLista: number, descuentoPct: number): number {
  const pct = clampDescuentoPct(descuentoPct);
  return Math.round(pxLista * (1 - pct / 100));
}

export function totalLineaConDescuento(
  linea: Pick<FacturaLineaLocal, "cantidad" | "pxLista">,
  descuentoPct: number
): number {
  return linea.cantidad * pxConDescuento(linea.pxLista, descuentoPct);
}

export function totalListaFactura(lineas: readonly FacturaLineaLocal[]): number {
  return lineas.reduce((sum, l) => sum + totalLineaLista(l), 0);
}

/**
 * % global del pie (sin overrides de línea).
 * Con `total_fac`, se recalcula desde el objetivo y el total de lista actual.
 */
export function porcentajeDescuentoGlobal(
  lineas: readonly FacturaLineaLocal[],
  descuento: FacturaDescuentoEstado | null
): number {
  if (descuento == null) return 0;
  if (descuento.fuente === "porcentaje") {
    return clampDescuentoPct(descuento.porcentaje);
  }
  const totalLista = totalListaFactura(lineas);
  const objetivo = descuento.totalFacObjetivo;
  if (totalLista <= 0 || objetivo == null) return 0;
  if (objetivo >= totalLista) return 0;
  if (objetivo <= 0) return 100;
  return clampDescuentoPct(((totalLista - objetivo) / totalLista) * 100);
}

/** Alias histórico de `porcentajeDescuentoGlobal`. */
export function porcentajeDescuentoEfectivo(
  lineas: readonly FacturaLineaLocal[],
  descuento: FacturaDescuentoEstado | null
): number {
  return porcentajeDescuentoGlobal(lineas, descuento);
}

/** % a aplicar a una línea: especial o global. */
export function porcentajeDescuentoLinea(
  linea: Pick<FacturaLineaLocal, "descuentoPctEspecial">,
  pctGlobal: number
): number {
  if (linea.descuentoPctEspecial != null) {
    return clampDescuentoPct(linea.descuentoPctEspecial);
  }
  return clampDescuentoPct(pctGlobal);
}

export function hayDescuentoFactura(
  lineas: readonly FacturaLineaLocal[],
  descuento: FacturaDescuentoEstado | null
): boolean {
  const pctGlobal = porcentajeDescuentoGlobal(lineas, descuento);
  if (pctGlobal > 0) return true;
  return lineas.some(
    (l) => l.descuentoPctEspecial != null && l.descuentoPctEspecial > 0
  );
}

export type FacturaResumenTotales = {
  totalItem: number;
  totalLista: number;
  descPctPromedio: number;
  descPesos: number;
  totalConDesc: number;
  hayDescuento: boolean;
};

export function resumenTotalesFactura(
  lineas: readonly FacturaLineaLocal[],
  descuento: FacturaDescuentoEstado | null
): FacturaResumenTotales {
  const totalItem = lineas.length;
  const totalLista = totalListaFactura(lineas);
  const pctGlobal = porcentajeDescuentoGlobal(lineas, descuento);

  let totalConDesc = 0;
  let sumaPctPonderado = 0;
  for (const l of lineas) {
    const pct = porcentajeDescuentoLinea(l, pctGlobal);
    const lista = totalLineaLista(l);
    totalConDesc += totalLineaConDescuento(l, pct);
    sumaPctPonderado += pct * lista;
  }

  const descPctPromedio =
    totalLista > 0 ? clampDescuentoPct(sumaPctPonderado / totalLista) : 0;
  const hayDescuento = totalConDesc < totalLista - 0.5 || descPctPromedio > 0;

  return {
    totalItem,
    totalLista,
    descPctPromedio,
    descPesos: Math.max(0, totalLista - totalConDesc),
    totalConDesc,
    hayDescuento,
  };
}

/** Deriva el % a partir de un TOTAL FAC. objetivo. */
export function descuentoPctDesdeTotalFac(
  totalLista: number,
  totalFac: number
): number {
  if (totalLista <= 0) return 0;
  if (totalFac >= totalLista) return 0;
  if (totalFac <= 0) return 100;
  return clampDescuentoPct(((totalLista - totalFac) / totalLista) * 100);
}

/** TOTAL FAC. resultante al aplicar un %. */
export function totalFacDesdeDescuentoPct(
  totalLista: number,
  descuentoPct: number
): number {
  const pct = clampDescuentoPct(descuentoPct);
  return Math.round(totalLista * (1 - pct / 100));
}

/**
 * Al agregar una línea:
 * - `porcentaje`: hereda el % global (`descuentoPctEspecial = null`).
 * - `total_fac`: congela el DESC. % PROMEDIO actual como global `porcentaje`
 *   (deja de perseguir el objetivo al crecer el remito); la línea nueva hereda ese %.
 */
export function prepararDescuentoAlAgregarLinea(
  lineas: readonly FacturaLineaLocal[],
  descuento: FacturaDescuentoEstado | null
): {
  descuentoPctEspecial: number | null;
  descuentoSiguiente: FacturaDescuentoEstado | null;
} {
  if (descuento == null) {
    return { descuentoPctEspecial: null, descuentoSiguiente: null };
  }
  if (descuento.fuente === "porcentaje") {
    return {
      descuentoPctEspecial: null,
      descuentoSiguiente: descuento,
    };
  }

  const resumen = resumenTotalesFactura(lineas, descuento);
  const pct =
    resumen.descPctPromedio > 0
      ? resumen.descPctPromedio
      : porcentajeDescuentoGlobal(lineas, descuento);

  if (pct <= 0) {
    return {
      descuentoPctEspecial: null,
      descuentoSiguiente: descuento,
    };
  }

  return {
    descuentoPctEspecial: null,
    descuentoSiguiente: {
      fuente: "porcentaje",
      porcentaje: clampDescuentoPct(pct),
      totalFacObjetivo: null,
    },
  };
}
