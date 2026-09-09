import type { NextConfig } from "next";
import { GP_INTERNAL, GP_ROUTES } from "./src/lib/gestionProductosRoutes";

const R = GP_ROUTES;
const I = GP_INTERNAL;

/** Redirecciones permanentes: URLs antiguas → canónicas actuales (sidebar). */
function legacyGestionProductosRedirects(): { source: string; destination: string; permanent: true }[] {
  return [
    { source: "/gestion-productos/pedidos/generar-pedido", destination: R.pedidoMercaderia.generarPedido, permanent: true },
    { source: "/gestion-productos/pedidos/urgente", destination: R.pedidoMercaderia.confPedido.urgente, permanent: true },
    { source: "/gestion-productos/pedidos/tintometrico", destination: R.pedidoMercaderia.confPedido.tintometrico, permanent: true },
    { source: "/gestion-productos/pedidos/reposicion", destination: R.pedidoMercaderia.confPedido.reposicion, permanent: true },
    { source: "/gestion-productos/pedidos/historial", destination: R.pedidoMercaderia.recepcionPedido, permanent: true },
    { source: "/gestion-productos/pedidos", destination: R.pedidoMercaderia.generarPedido, permanent: true },
    { source: "/gestion-productos/proveedores/sugeridos", destination: R.ayudaVendedor.pxVenta.pxVtaSugerido, permanent: true },
    { source: "/gestion-productos/tienda/calc-tintometrico", destination: R.ayudaVendedor.pxVenta.pxTintometrico, permanent: true },
    { source: "/gestion-productos/tienda/calc-litros", destination: R.ayudaVendedor.calcLitros, permanent: true },
    { source: "/gestion-productos/procesos", destination: R.defaultEntry, permanent: true },
    { source: "/gestion-productos/ayuda-vendedor/procesos", destination: R.defaultEntry, permanent: true },
    { source: "/gestion-productos/cargar-gasto", destination: R.ayudaVendedor.cargarGasto, permanent: true },
    { source: "/gestion-productos/tienda/control-stock", destination: R.ayudaVendedor.controlStock, permanent: true },
    {
      source: "/gestion-productos/proveedores/lista-precios/reglas-descuentos",
      destination: R.analisisPrecios.listaProveedores.reglasDescuentos,
      permanent: true,
    },
    {
      source: "/gestion-productos/proveedores/lista-precios",
      destination: R.analisisPrecios.listaProveedores.listaPrecios,
      permanent: true,
    },
    { source: "/gestion-productos/proveedores/lista", destination: R.analisisPrecios.listaProveedores.lista, permanent: true },
    { source: "/gestion-productos/tienda/comp-proveedores", destination: R.analisisPrecios.cxYPxTienda.cxCompra, permanent: true },
    { source: "/gestion-productos/tienda/px-listas", destination: R.analisisPrecios.cxYPxTienda.pxListas, permanent: true },
    { source: "/gestion-productos/tienda/cx-px-tienda", destination: R.analisisPrecios.pxCompetencia, permanent: true },
    {
      source: "/gestion-productos/proveedores/comparacion-categorias/categorias",
      destination: R.analisisPrecios.compCategorias.comparacion,
      permanent: true,
    },
    {
      source: "/gestion-productos/proveedores/comparacion-categorias",
      destination: R.analisisPrecios.compCategorias.comparacion,
      permanent: true,
    },
    { source: "/gestion-productos/proveedores/competencia-precios", destination: R.analisisPrecios.pxCompetencia, permanent: true },
    { source: "/gestion-productos/precios-competencia", destination: R.analisisPrecios.pxCompetencia, permanent: true },
    { source: "/gestion-productos/proveedores", destination: R.analisisPrecios.listaProveedores.listaPrecios, permanent: true },
    { source: "/gestion-productos/tienda", destination: R.analisisPrecios.cxYPxTienda.cxCompra, permanent: true },
  ];
}

function canonicalGestionProductosRewrites(): { source: string; destination: string }[] {
  return [
    { source: R.pedidoMercaderia.generarPedido, destination: I.pedidoMercaderia.generarPedido },
    { source: R.pedidoMercaderia.confPedido.urgente, destination: I.pedidoMercaderia.confPedido.urgente },
    { source: R.pedidoMercaderia.confPedido.tintometrico, destination: I.pedidoMercaderia.confPedido.tintometrico },
    { source: R.pedidoMercaderia.confPedido.reposicion, destination: I.pedidoMercaderia.confPedido.reposicion },
    { source: R.pedidoMercaderia.recepcionPedido, destination: I.pedidoMercaderia.recepcionPedido },
    { source: R.ayudaVendedor.pxVenta.pxVtaSugerido, destination: I.ayudaVendedor.pxVenta.pxVtaSugerido },
    { source: R.ayudaVendedor.pxVenta.pxTintometrico, destination: I.ayudaVendedor.pxVenta.pxTintometrico },
    { source: R.ayudaVendedor.calcLitros, destination: I.ayudaVendedor.calcLitros },
    { source: R.ayudaVendedor.cargarGasto, destination: I.ayudaVendedor.cargarGasto },
    { source: R.envios.programados, destination: I.envios.programados },
    { source: R.envios.conductor, destination: I.envios.conductor },
    { source: R.ayudaVendedor.controlStock, destination: I.ayudaVendedor.controlStock },
    { source: R.ayudaVendedor.transfDepositos, destination: I.ayudaVendedor.transfDepositos },
    {
      source: R.analisisPrecios.listaProveedores.listaPrecios,
      destination: I.analisisPrecios.listaProveedores.listaPrecios,
    },
    {
      source: R.analisisPrecios.listaProveedores.reglasDescuentos,
      destination: I.analisisPrecios.listaProveedores.reglasDescuentos,
    },
    { source: R.analisisPrecios.listaProveedores.lista, destination: I.analisisPrecios.listaProveedores.lista },
    { source: R.analisisPrecios.cxYPxTienda.cxCompra, destination: I.analisisPrecios.cxYPxTienda.cxCompra },
    { source: R.analisisPrecios.cxYPxTienda.pxListas, destination: I.analisisPrecios.cxYPxTienda.pxListas },
    { source: R.analisisPrecios.pxCompetencia, destination: I.analisisPrecios.pxCompetencia },
    {
      source: R.analisisPrecios.compCategorias.comparacion,
      destination: I.analisisPrecios.compCategorias.comparacion,
    },
    {
      source: R.asistenteIa.buscarColorImagen,
      destination: I.asistenteIa.buscarColorImagen,
    },
    {
      source: R.asistenteIa.disenarColores,
      destination: I.asistenteIa.disenarColores,
    },
  ];
}

const nextConfig: NextConfig = {
  /** Worker de pdfjs-dist en el bundle serverless (Vercel). Ver `@/lib/pdfjsServerLoad`. */
  outputFileTracingIncludes: {
    "/api/parse-lista-precios-pdf": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
  },
  /** Evita fallos de TLS al descargar Geist en `next/font` durante `next build` (p. ej. entornos corporativos). */
  experimental: {
    turbopackUseSystemTlsCerts: true,
    /** Planillas de estadísticas / imports con muchas filas vía Server Actions. */
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      ...legacyGestionProductosRedirects(),
      {
        source: "/proveedores",
        destination: R.analisisPrecios.listaProveedores.listaPrecios,
        permanent: true,
      },
      {
        source: "/proveedores/gestion",
        destination: R.analisisPrecios.listaProveedores.lista,
        permanent: true,
      },
      {
        source: "/finanzas/flujo-de-fondo",
        destination: "/finanzas/venc-por-fecha",
        permanent: true,
      },
      {
        source: "/finanzas/fact-cobros",
        destination: "/vtas-cobros/ptos-venta",
        permanent: true,
      },
      {
        source: "/proveedores/lista-precios/reglas-descuentos",
        destination: R.analisisPrecios.listaProveedores.reglasDescuentos,
        permanent: true,
      },
      {
        source: "/proveedores/lista-precios",
        destination: R.analisisPrecios.listaProveedores.listaPrecios,
        permanent: true,
      },
      {
        source: "/proveedores/sugeridos",
        destination: R.ayudaVendedor.pxVenta.pxVtaSugerido,
        permanent: true,
      },
      {
        source: "/proveedores/comparacion-categorias/categorias",
        destination: R.analisisPrecios.compCategorias.comparacion,
        permanent: true,
      },
      {
        source: R.analisisPrecios.compCategorias.categorias,
        destination: R.analisisPrecios.compCategorias.comparacion,
        permanent: true,
      },
      {
        source: "/proveedores/comparacion-categorias",
        destination: R.analisisPrecios.compCategorias.comparacion,
        permanent: true,
      },
      {
        source: "/proveedores/competencia-precios",
        destination: R.analisisPrecios.pxCompetencia,
        permanent: true,
      },
      {
        source: "/proveedores/lista",
        destination: R.analisisPrecios.listaProveedores.lista,
        permanent: true,
      },
      {
        source: "/tienda",
        destination: R.analisisPrecios.cxYPxTienda.cxCompra,
        permanent: true,
      },
      {
        source: "/stock",
        destination: R.ayudaVendedor.controlStock,
        permanent: true,
      },
      {
        source: "/tienda/tintometrico",
        destination: R.ayudaVendedor.pxVenta.pxTintometrico,
        permanent: true,
      },
      {
        source: "/tienda/litros",
        destination: R.ayudaVendedor.calcLitros,
        permanent: true,
      },
      {
        source: "/pedidos",
        destination: R.pedidoMercaderia.generarPedido,
        permanent: true,
      },
      {
        source: "/pedidos/enviar",
        destination: R.pedidoMercaderia.generarPedido,
        permanent: true,
      },
      {
        source: "/pedidos/urgente",
        destination: R.pedidoMercaderia.confPedido.urgente,
        permanent: true,
      },
      {
        source: "/pedidos/tintometrico",
        destination: R.pedidoMercaderia.confPedido.tintometrico,
        permanent: true,
      },
      {
        source: "/pedidos/reposicion",
        destination: R.pedidoMercaderia.confPedido.reposicion,
        permanent: true,
      },
      {
        source: "/pedidos/historial",
        destination: R.pedidoMercaderia.recepcionPedido,
        permanent: true,
      },
      {
        source: "/pedidos/generar",
        destination: R.pedidoMercaderia.recepcionPedido,
        permanent: true,
      },
      {
        source: "/tienda/tinto-lts",
        destination: R.ayudaVendedor.pxVenta.pxTintometrico,
        permanent: true,
      },
      {
        source: "/precios-competencia",
        destination: R.analisisPrecios.pxCompetencia,
        permanent: true,
      },
      {
        source: "/procesos",
        destination: R.defaultEntry,
        permanent: true,
      },
      {
        source: "/cargar-gasto",
        destination: R.ayudaVendedor.cargarGasto,
        permanent: true,
      },
      {
        source: "/envios",
        destination: R.envios.programados,
        permanent: true,
      },
      {
        source: "/envios/programados",
        destination: R.envios.programados,
        permanent: true,
      },
      {
        source: "/envios/conductor",
        destination: R.envios.conductor,
        permanent: true,
      },
      {
        source: "/envios/crear",
        destination: R.envios.conductor,
        permanent: true,
      },
      {
        source: "/gestion-productos/envios/crear",
        destination: R.envios.conductor,
        permanent: true,
      },
      {
        source: "/gestion-productos/envios",
        destination: R.envios.programados,
        permanent: true,
      },
      {
        source: "/tienda/cx-px",
        destination: R.analisisPrecios.pxCompetencia,
        permanent: true,
      },
      {
        source: "/tienda/px-listas",
        destination: R.analisisPrecios.cxYPxTienda.pxListas,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return canonicalGestionProductosRewrites();
  },
};

export default nextConfig;
