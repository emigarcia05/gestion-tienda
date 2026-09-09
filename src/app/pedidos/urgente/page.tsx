import { getPedidoUrgenteData } from "@/actions/pedidos";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { redirect } from "next/navigation";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import FiltrosPedidoUrgente from "@/components/pedidos/FiltrosPedidoUrgente";
import PedidoUrgentePageClient from "@/components/pedidos/PedidoUrgentePageClient";
import { prisma } from "@/lib/prisma";
import { getPosicionIvaComparacionRevisionToken } from "@/services/finBalPosicionIvaComparacionRevision.service";
import { hayFiltroExtraPedidoUrgente } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

type SucursalPedido = "guaymallen" | "maipu";

interface Props {
  searchParams: Promise<{
    q?: string;
    pagina?: string;
    sucursal?: string;
    proveedor?: string;
    pedido?: string;
  }>;
}

export default async function PedidoUrgentePage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) redirect(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);

  const { q = "", pagina = "1", sucursal = "", proveedor = "", pedido = "" } = await searchParams;
  const sucursalesPedido = await prisma.sucursal.findMany({
    where: { pedido: true, codigo: { in: ["guaymallen", "maipu"] } },
    select: { codigo: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const sucursalesDisponibles = sucursalesPedido.map((s) => ({
    value: s.codigo as SucursalPedido,
    label: s.nombre.toUpperCase(),
  }));
  const codigosHabilitados = new Set(sucursalesPedido.map((s) => s.codigo));
  const sucursalValida: SucursalPedido | "" =
    (sucursal === "maipu" || sucursal === "guaymallen") && codigosHabilitados.has(sucursal)
      ? (sucursal as SucursalPedido)
      : "";
  const pedidoValida: "cualquier" | "urgente" | "reposicion" | "" =
    pedido === "cualquier"
      ? "cualquier"
      : pedido === "urgente"
        ? "urgente"
        : pedido === "reposicion"
          ? "reposicion"
          : "";

  const [{ proveedores, productos, total, totalPaginas, ivaSaldoAcumuladoComparacion }, ivaComparacionRevisionToken] =
    await Promise.all([
      getPedidoUrgenteData({
        sucursal: sucursalValida,
        q,
        pagina,
        proveedor,
        pedido: pedidoValida,
      }),
      getPosicionIvaComparacionRevisionToken(),
    ]);
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const tieneSucursalSeleccionada = !!sucursalValida;
  const puedeListar =
    tieneSucursalSeleccionada &&
    hayFiltroExtraPedidoUrgente({
      proveedor,
      pedido: pedidoValida,
      q,
    });

  const filters = (
    <FiltrosPedidoUrgente
      q={q}
      sucursal={sucursalValida}
      proveedor={proveedor}
      pedido={pedidoValida}
      proveedores={proveedores}
      sucursales={sucursalesDisponibles}
      totalProductos={total}
    />
  );

  return (
    <PedidoUrgentePageClient
      filters={filters}
      productos={productos}
      proveedores={proveedores}
      sucursalValida={sucursalValida}
      sinFiltros={!puedeListar}
      tieneSucursal={tieneSucursalSeleccionada}
      pedidoValida={pedidoValida}
      total={total}
      totalPaginas={totalPaginas}
      paginaNum={paginaNum}
      proveedor={proveedor}
      q={q}
      ivaSaldoAcumuladoComparacion={ivaSaldoAcumuladoComparacion}
      ivaComparacionRevisionToken={ivaComparacionRevisionToken}
    />
  );
}
