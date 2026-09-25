/**
 * Constantes del módulo Factura (área Facturación).
 * Persistencia en `comprobantes_vtas`; fiscal vía WSAA + WSFEv1.
 */

import {
  CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT,
  type ClienteListaItem,
} from "@/lib/envios";

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

/** Etiqueta de columna TIPO en Lista Comprobantes. Fiscal y no fiscal se muestran igual. */
export function etiquetaTipoListaComprobantes(tipo: FacturaTipo): string {
  if (tipo === "factura_fiscal" || tipo === "factura_no_fiscal") {
    return "FACTURA";
  }
  if (tipo === "nota_credito_fiscal" || tipo === "nota_credito_no_fiscal") {
    return "NOTA CRÉDITO";
  }
  return FACTURA_TIPO_LABELS[tipo];
}

/** Tipos de Lista Comprobantes (sin presupuesto). */
export const FACTURA_TIPOS_LISTA_COMPROBANTES = FACTURA_TIPOS.filter(
  (t): t is Exclude<FacturaTipo, "presupuesto"> => t !== "presupuesto"
);

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

export const MENSAJE_PERSONAL_SESION_REQUERIDO =
  "Elegí un usuario en el slidenav.";

export const MENSAJE_PERSONAL_SIN_SUCURSAL =
  "El usuario no tiene sucursal asignada.";

export const MENSAJE_PTO_VTA_SUCURSAL_USUARIO =
  "No hay punto de venta activo para la sucursal del usuario.";

/** Forma de pago sintética para imputar una NC como cobro de una venta. */
export const FACTURA_COBRO_NOTA_CREDITO_LABEL = "NOTA DE CRÉDITO";

/** ID local (solo UI) para la opción sintética de cobro por NC. */
export const FACTURA_COBRO_NOTA_CREDITO_UI_ID = "__factura_nc__";

function normalizarNombreCobro(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("es-AR");
}

export type FacturaNcCobroAsignacion = {
  id: string;
  comprobanteId: string;
  comprobanteNro: string;
  createdAtIso: string;
  montoCents: number;
  personalNombre: string;
};

export type FacturaNcCobroVentaOption = {
  id: string;
  nroComprobante: string;
  fechaIso: string;
  saldoPendiente: number;
};

/** Cobros de una NC: imputaciones, ventas con saldo y excedente a devolver. */
export type FacturaNcCobroVista = {
  asignaciones: FacturaNcCobroAsignacion[];
  devoluciones: FacturaComprobanteCobroItem[];
  saldoDisponible: number;
  /** Crédito que no cubre ventas pendientes: se registra como cobro = devolución. */
  saldoADevolver: number;
  ventas: FacturaNcCobroVentaOption[];
};

export function esCobroNotaCreditoNombre(value: string): boolean {
  return (
    normalizarNombreCobro(value) ===
    normalizarNombreCobro(FACTURA_COBRO_NOTA_CREDITO_LABEL)
  );
}

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
 * Vencimiento de una venta a crédito: `clientes.cta_corriente_plazo`.
 * Sin plazo válido (CF u omisión) → default 1.
 */
export function diasVencimientoDesdePlazoCliente(
  plazo: number | null | undefined
): number {
  if (plazo == null || !Number.isInteger(plazo) || plazo < 1 || plazo > 365) {
    return CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT;
  }
  return plazo;
}

/** Suma de cobros del modal, en pesos (2 decimales). */
export function impCobradoDesdeCobros(
  cobros: readonly { montoCents: number }[]
): number {
  const cents = cobros.reduce((acc, c) => acc + c.montoCents, 0);
  return Math.round(cents) / 100;
}

/**
 * Si la venta queda con saldo, `dias_vencimiento` = plazo del cliente.
 * Pagado o no venta → null.
 */
export function diasVencimientoPorSaldoPendiente(args: {
  esVenta: boolean;
  impTotal: number;
  impCobrado: number;
  plazoCliente: number | null | undefined;
}): number | null {
  if (!args.esVenta) return null;
  if (saldoPendienteTrasCobro(args.impTotal, args.impCobrado) <= 0) return null;
  return diasVencimientoDesdePlazoCliente(args.plazoCliente);
}

/** `imp_total` − `imp_cobrado`, piso 0 (2 decimales). */
export function saldoPendienteTrasCobro(
  impTotal: number,
  impCobrado: number
): number {
  const restante = Math.round((impTotal - impCobrado) * 100) / 100;
  return restante > 0 ? restante : 0;
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

/** Borrar en listado: presupuesto y no fiscales. Los fiscales (con o sin CAE) no se eliminan. */
export function puedeEliminarComprobante(tipo: FacturaTipo): boolean {
  return !esFacturaTipoFiscal(tipo);
}

/** Destino fiscal al convertir un comprobante no fiscal (venta o NC). */
export function tipoFiscalDesdeNoFiscal(
  tipo: FacturaTipo
): "factura_fiscal" | "nota_credito_fiscal" | null {
  if (tipo === "factura_no_fiscal") return "factura_fiscal";
  if (tipo === "nota_credito_no_fiscal") return "nota_credito_fiscal";
  return null;
}

export function puedeConvertirComprobanteEnFiscal(tipo: FacturaTipo): boolean {
  return tipoFiscalDesdeNoFiscal(tipo) != null;
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

/** NC con la misma condición fiscal que la venta origen. */
export function tipoNotaCreditoDesdeVenta(
  tipo: FacturaTipo
): "nota_credito_fiscal" | "nota_credito_no_fiscal" | null {
  if (tipo === "factura_fiscal") return "nota_credito_fiscal";
  if (tipo === "factura_no_fiscal") return "nota_credito_no_fiscal";
  return null;
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

export const FACTURA_BOTON_CLIENTE_CONSUMIDOR_FINAL = "CONSUMIDOR FINAL";

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

/** Movimientos del submódulo Cuenta Corrientes. */
export const CUENTA_CORRIENTE_MOVIMIENTO_TIPOS = [
  "cobro",
  "venta",
  "nota_credito",
] as const;

export type CuentaCorrienteMovimientoTipo =
  (typeof CUENTA_CORRIENTE_MOVIMIENTO_TIPOS)[number];

export const CUENTA_CORRIENTE_MOVIMIENTO_LABELS: Record<
  CuentaCorrienteMovimientoTipo,
  string
> = {
  cobro: "COBRO",
  venta: "VENTA",
  nota_credito: "NOTA CRÉDITO",
};

export type CuentaCorrienteClienteMovimiento = {
  id: string;
  tipo: CuentaCorrienteMovimientoTipo;
  fechaIso: string;
  createdAtIso: string;
  comprobanteId: string;
  nroComprobante: string;
  /** Segunda línea: nro (venta/NC) o forma de pago (cobro). */
  detalle: string;
  monto: number;
  saldoCc: number;
  /**
   * false = cobro `es_cuenta_corriente` (forma de pago, no dinero recibido)
   * o cobro `NOTA DE CRÉDITO` (la NC ya mueve el SALDO CC).
   */
  afectaSaldo: boolean;
  /**
   * true = baja el PENDIENTE de esa venta (`imp_cobrado`).
   * Los cobros `es_cuenta_corriente` no cuentan; la imputación de NC sí.
   */
  cuentaComoPago: boolean;
};

export type CuentaCorrienteProductoTipo = "venta" | "nota_credito";

export const CUENTA_CORRIENTE_PRODUCTO_TIPO_LABELS: Record<
  CuentaCorrienteProductoTipo,
  string
> = {
  venta: "VENTA",
  nota_credito: "NOTA DE CRÉDITO",
};

export type CuentaCorrienteProductoLinea = {
  id: string;
  fechaIso: string;
  createdAtIso: string;
  tipo: CuentaCorrienteProductoTipo;
  descripcion: string;
  cantidad: number;
  marca: string;
  rubro: string;
};

export type CuentaCorrienteClienteDatos = {
  cliente: ClienteListaItem;
  movimientos: CuentaCorrienteClienteMovimiento[];
  productos: CuentaCorrienteProductoLinea[];
};

export type CuentaCorrienteTotalPorItem = {
  descripcion: string;
  cantidad: number;
};

/** Cantidad neta por descripción (venta +, NC −) sobre el lote ya filtrado. */
export function totalesPorItemCuentaCorriente(
  productos: readonly CuentaCorrienteProductoLinea[]
): CuentaCorrienteTotalPorItem[] {
  const map = new Map<string, CuentaCorrienteTotalPorItem>();
  for (const p of productos) {
    const descripcion = p.descripcion.trim();
    const key = descripcion.toLocaleUpperCase("es-AR");
    if (!key) continue;
    const signo = p.tipo === "nota_credito" ? -1 : 1;
    const prev = map.get(key);
    map.set(key, {
      descripcion: prev?.descripcion ?? descripcion,
      cantidad: (prev?.cantidad ?? 0) + signo * p.cantidad,
    });
  }
  return [...map.values()].sort((a, b) =>
    a.descripcion.localeCompare(b.descripcion, "es-AR")
  );
}

/** Tope de % de descuento en máscara (100,00 %). */
export const FACTURA_DESCUENTO_MAX_CENTS = 10_000;

export type FacturaComprobanteEstado = "borrador" | "autorizado" | "rechazado";

/** Opción del filtro CLIENTE en Lista Comprobantes (catálogo, no texto libre). */
export type FacturaClienteFiltroOption = {
  id: string;
  etiqueta: string;
  proyectos: { id: string; etiqueta: string }[];
};

export type FacturaComprobanteListItem = {
  id: string;
  tipo: FacturaTipo;
  letra: string | null;
  fechaIso: string;
  /** ISO-8601 de `created_at` (hora de emisión; `fecha` es solo calendario). */
  createdAtIso: string;
  nroComprobante: string;
  cliente: string;
  /** FK `clientes`. Null en consumidor final o filas sin catálogo. */
  clienteId: string | null;
  /** FK `clientes_proyectos`. Null si el comprobante no tiene proyecto. */
  proyectoId: string | null;
  impTotal: number;
  /**
   * Venta: `imp_total` − `imp_cobrado`. NC: `imp_total` − imputado a ventas − devoluciones
   * (cobros en la propia NC). `null` si no hay resto o el tipo no aplica.
   */
  saldoPendiente: number | null;
  /** Días vencido (`hoy AR` − (`fecha` + `dias_vencimiento`)); `null` si no está vencido. */
  diasVencido: number | null;
  /** Códigos de `sucursales` asociadas al pto. vta. del comprobante (`global_pto_vta_sucursales`). */
  sucursalCodigos: string[];
  /** Nombres de sucursal del pto. vta. (MAYÚSCULAS). */
  sucursalNombres: string[];
  /** Nombre de `personal` que emitió; vacío si `personal_id` es null. */
  usuarioNombre: string;
  cae: string | null;
  caeVtoIso: string | null;
  resultado: string | null;
  estado: FacturaComprobanteEstado;
  ambiente: string;
  puedeNc: boolean;
  /** `personal.id_personal` de quien generó; null en filas viejas. */
  personalId: number | null;
};

/** Pie de Lista Comprobantes: recuento y montos según las filas visibles. */
export function resumenIndicadoresListaComprobantes(
  items: readonly FacturaComprobanteListItem[]
): {
  cantComprobantes: number;
  totalVendido: number;
  pendienteDeCobro: number;
} {
  let ventas = 0;
  let notasCredito = 0;
  let pendienteDeCobro = 0;
  for (const item of items) {
    if (item.estado === "rechazado") continue;
    if (esFacturaTipoVenta(item.tipo)) {
      ventas += item.impTotal;
    } else if (esFacturaTipoNotaCredito(item.tipo)) {
      notasCredito += item.impTotal;
    }
    if (item.saldoPendiente != null && esFacturaTipoVenta(item.tipo)) {
      pendienteDeCobro += item.saldoPendiente;
    }
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    cantComprobantes: items.length,
    totalVendido: round2(ventas - notasCredito),
    pendienteDeCobro: round2(pendienteDeCobro),
  };
}

/** Pie de Cuenta Corrientes: recuento y montos según los movimientos visibles. */
export function resumenIndicadoresCuentaCorriente(
  movimientos: readonly CuentaCorrienteClienteMovimiento[]
): {
  cantComprobantes: number;
  totalVendido: number;
  pendienteDeCobro: number;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const idsComprobantes = new Set<string>();
  let ventas = 0;
  let notasCredito = 0;
  for (const mov of movimientos) {
    if (mov.tipo === "venta") {
      idsComprobantes.add(mov.comprobanteId);
      ventas += mov.monto;
    } else if (mov.tipo === "nota_credito") {
      idsComprobantes.add(mov.comprobanteId);
      notasCredito += mov.monto;
    }
  }
  const ultimo = movimientos[movimientos.length - 1];
  return {
    cantComprobantes: idsComprobantes.size,
    totalVendido: round2(ventas - notasCredito),
    pendienteDeCobro: round2(ultimo?.saldoCc ?? 0),
  };
}

export type FiltroPeriodoCuentaCorriente = "todos" | "rango";
export type FiltroTipoCuentaCorriente = "todos" | CuentaCorrienteMovimientoTipo;
export type FiltroCondicionPagoCuentaCorriente = "todos" | "pendiente" | "pagado";

/** Estado de cobro de cada venta del ledger (cobros del mismo `comprobanteId`). */
export function mapaEstadoPagoVentasCc(
  movimientos: readonly CuentaCorrienteClienteMovimiento[]
): Map<string, "pendiente" | "pagado"> {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const ventas = new Map<string, number>();
  const cobrado = new Map<string, number>();
  for (const mov of movimientos) {
    if (mov.tipo === "venta") {
      ventas.set(mov.comprobanteId, round2((ventas.get(mov.comprobanteId) ?? 0) + mov.monto));
    } else if (mov.tipo === "cobro" && mov.cuentaComoPago) {
      cobrado.set(
        mov.comprobanteId,
        round2((cobrado.get(mov.comprobanteId) ?? 0) + mov.monto)
      );
    }
  }
  const out = new Map<string, "pendiente" | "pagado">();
  for (const [id, monto] of ventas) {
    const resto = round2(monto - (cobrado.get(id) ?? 0));
    out.set(id, resto > 0.009 ? "pendiente" : "pagado");
  }
  return out;
}

/** Filtros de Cuenta Corrientes sobre el ledger ya cargado (fecha / tipo / condición de pago). */
export function filtrarMovimientosCuentaCorriente(
  movimientos: readonly CuentaCorrienteClienteMovimiento[],
  filtros: {
    periodo: FiltroPeriodoCuentaCorriente;
    rangoDesde: string;
    rangoHasta: string;
    tipo: FiltroTipoCuentaCorriente;
    condicionPago: FiltroCondicionPagoCuentaCorriente;
  }
): CuentaCorrienteClienteMovimiento[] {
  const estadoPorVenta = mapaEstadoPagoVentasCc(movimientos);
  return movimientos.filter((mov) => {
    if (filtros.periodo === "rango") {
      if (!filtros.rangoDesde || !filtros.rangoHasta) return false;
      if (mov.fechaIso < filtros.rangoDesde || mov.fechaIso > filtros.rangoHasta) {
        return false;
      }
    }
    if (filtros.tipo !== "todos" && mov.tipo !== filtros.tipo) return false;
    if (filtros.condicionPago !== "todos") {
      if (mov.tipo === "nota_credito") return false;
      const estado = estadoPorVenta.get(mov.comprobanteId);
      if (estado == null) return false;
      if (filtros.condicionPago === "pendiente" && estado !== "pendiente") {
        return false;
      }
      if (filtros.condicionPago === "pagado" && estado !== "pagado") {
        return false;
      }
    }
    return true;
  });
}

export type FacturaComprobanteCobroItem = {
  id: string;
  /** ISO del `created_at` del cobro (hora de registro). */
  createdAtIso: string;
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  montoCents: number;
  esCuentaCorriente: boolean;
  plazoDias: number | null;
  /** Nombre MAYÚSCULAS del `personal` de la cabecera; vacío si no hay FK. */
  personalNombre: string;
};

/** Detalle de un cobro (Cuenta Corrientes · Ver). */
export type FacturaCobroDetalle = {
  cobro: FacturaComprobanteCobroItem;
  comprobantes: { id: string; nroComprobante: string }[];
};

/** Líneas de FORMA PAGO en el modal de cobros (2.ª fila = cuota / plazo). */
export function lineasFormaPagoCobro(item: FacturaComprobanteCobroItem): {
  linea1: string;
  linea2: string;
} {
  const entidad = item.entidadNombre.trim();
  const linea1 = entidad ? `${item.pagoNombre} - ${entidad}` : item.pagoNombre;
  const extras: string[] = [];
  const cuota = item.cuotaEtiqueta?.trim() ?? "";
  if (cuota) extras.push(cuota);
  if (item.esCuentaCorriente && item.plazoDias != null) {
    extras.push(`${item.plazoDias} DÍAS`);
  }
  return { linea1, linea2: extras.join(" · ") };
}

/** Opción del filtro SUCURSAL en Lista Comprobantes / Presupuestos. */
export type FacturaSucursalFiltroOption = {
  codigo: string;
  nombre: string;
};

/** Opción del filtro USUARIO en Lista Comprobantes / Presupuestos. */
export type FacturaUsuarioFiltroOption = {
  idPersonal: number;
  nombrePersonal: string;
};

export type FacturaPtoVtaOpcion = {
  id: string;
  ptoVenta: string;
  titular: string;
  cuit: string | null;
  condicionIva: number | null;
  condicionIvaDescripcion: string | null;
  /** Códigos de `sucursales` vía `global_pto_vta_sucursales`. */
  sucursalCodigos: string[];
};

/** Pto. vta. de la sucursal del usuario; si no hay, el primero activo. */
export function ptoVtaIdParaSucursal(
  ptoVtas: readonly FacturaPtoVtaOpcion[],
  sucursalCodigo: string | null | undefined
): string {
  if (sucursalCodigo) {
    const propio = ptoVtas.find((p) => p.sucursalCodigos.includes(sucursalCodigo));
    if (propio) return propio.id;
  }
  return ptoVtas[0]?.id ?? "";
}

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

/** Borrador para Duplicar → Crear (sin nro/CAE; la fecha de Crear es hoy AR). */
export type FacturaComprobanteDuplicarBorrador = {
  tipo: FacturaTipo;
  fechaIso: string;
  comentarios: string;
  cliente: string;
  clienteId: string | null;
  proyectoId: string | null;
  clienteCatalogo: ClienteListaItem | null;
  cbteAsocId: string | null;
  /** Etiqueta del original si se abre como NC (`?nc=`). */
  cbteAsocLabel: string | null;
  lineas: FacturaLineaLocal[];
  descuento: FacturaDescuentoEstado | null;
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
