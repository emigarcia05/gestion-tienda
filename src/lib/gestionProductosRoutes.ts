/**
 * Rutas de Ventas (mercadería, stock, envíos, herramientas) y de Productos / Proveedores
 * (Administrador). Valores derivados de `APP_ROUTES` (`/{área}/{módulo}/{función}`).
 */

import { APP_ROUTES, pathnameEnPrefijo } from "./appRoutes";

const V = APP_ROUTES.ventas;
const A = APP_ROUTES.administrador;

export const GP_ROUTES = {
  /** Hub de Ventas: panel vacío hasta elegir una ruta hoja en el sidenav. */
  defaultEntry: V.hub,
  pedidoMercaderia: {
    pedirMercaderia: V.compras.pedirMercaderia,
    confPedido: {
      tintometrico: V.compras.tintometrico,
    },
    /** Compras Emitidas. */
    recepcionPedido: V.compras.comprasEmitidas,
    /** Compras Recepcionadas: comprobantes recepcionados + nota de crédito. */
    compras: V.compras.comprasRecepcionadas,
  },
  ayudaVendedor: {
    pxVenta: {
      pxVtaSugerido: V.ventas.pxSugeridos,
      pxTintometrico: V.ventas.pxTintometrico,
    },
    calcLitros: V.herramientas.calculadoraLts,
    controlStock: V.stock.controlStock,
    transfDepositos: V.stock.transfDepositos,
    movimientosStock: V.stock.movimientos,
  },
  analisisPrecios: {
    listaPropia: {
      listaProductos: A.productos.listaProductos,
    },
    listaProveedores: {
      listaPrecios: A.proveedores.listaProdProv,
      reglasDescuentos: A.proveedores.reglasDescuentos,
      lista: A.proveedores.proveedores,
    },
    cxYPxTienda: {
      cxCompra: A.productos.cxCompra,
      pxListas: A.productos.pxListas,
    },
    pxCompetencia: A.productos.pxCompetencia,
    compCategorias: {
      comparacion: A.productos.analisisCat,
    },
  },
  envios: {
    programados: V.envios.programados,
    conductor: V.envios.conductor,
  },
  asistenteIa: {
    buscarColorImagen: V.herramientas.buscarCodImagen,
    disenarColores: V.herramientas.disenar,
  },
} as const;

/** Conductor: lienzo mobile sin slidenav. */
export function esRutaEnviosConductor(pathname: string): boolean {
  return pathnameEnPrefijo(pathname, GP_ROUTES.envios.conductor);
}

export const REVALIDATE_LISTA_PRODUCTOS = [
  GP_ROUTES.analisisPrecios.listaPropia.listaProductos,
] as const;

export const REVALIDATE_LISTA_PRECIOS = [
  GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios,
  GP_ROUTES.analisisPrecios.listaProveedores.reglasDescuentos,
] as const;

export const REVALIDATE_PEDIDOS_MERCADERIA = [
  GP_ROUTES.pedidoMercaderia.pedirMercaderia,
  GP_ROUTES.pedidoMercaderia.confPedido.tintometrico,
  GP_ROUTES.pedidoMercaderia.recepcionPedido,
  GP_ROUTES.pedidoMercaderia.compras,
] as const;

export const REVALIDATE_CX_COMPRA = [
  GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra,
  GP_ROUTES.analisisPrecios.listaPropia.listaProductos,
] as const;

export const REVALIDATE_PX_COMPETENCIA = [GP_ROUTES.analisisPrecios.pxCompetencia] as const;

export const REVALIDATE_LISTA_PROVEEDORES_TABLERO = [
  GP_ROUTES.analisisPrecios.listaProveedores.lista,
] as const;

export const REVALIDATE_AYUDA_VENDEDOR_CALC = [
  GP_ROUTES.ayudaVendedor.calcLitros,
  GP_ROUTES.ayudaVendedor.pxVenta.pxTintometrico,
  GP_ROUTES.ayudaVendedor.controlStock,
  GP_ROUTES.ayudaVendedor.transfDepositos,
  GP_ROUTES.ayudaVendedor.movimientosStock,
] as const;

export const REVALIDATE_ENVIOS = [
  GP_ROUTES.envios.programados,
  GP_ROUTES.envios.conductor,
] as const;
