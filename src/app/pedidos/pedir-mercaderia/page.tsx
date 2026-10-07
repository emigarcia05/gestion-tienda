import { redirect } from "next/navigation";
import { getPedidoUrgenteData } from "@/actions/pedidos";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { hayFiltroExtraPedidoUrgente } from "@/lib/pedidos";
import FiltrosPedidoUrgente from "@/components/pedidos/FiltrosPedidoUrgente";
import PedirMercaderiaPageClient from "@/components/pedidos/PedirMercaderiaPageClient";
import { getPosicionIvaComparacionRevisionToken } from "@/services/finBalPosicionIvaComparacionRevision.service";

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

export default async function PedirMercaderiaPage({ searchParams }: Props) {
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
    pedido === "cualquier" || pedido === "urgente" || pedido === "reposicion" ? pedido : "";

  const [{ proveedores, productos, total, totalPaginas, ivaSaldoAcumuladoComparacion }, ivaComparacionRevisionToken] =
    await Promise.all([
      getPedidoUrgenteData({ sucursal: sucursalValida, q, pagina, proveedor, pedido: pedidoValida }),
      getPosicionIvaComparacionRevisionToken(),
    ]);
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const tieneSucursal = !!sucursalValida;
  const puedeListar = tieneSucursal && hayFiltroExtraPedidoUrgente({ proveedor, pedido: pedidoValida, q });

  return (
    <PedirMercaderiaPageClient
      filters={
        <FiltrosPedidoUrgente
          q={q}
          sucursal={sucursalValida}
          proveedor={proveedor}
          pedido={pedidoValida}
          proveedores={proveedores}
          sucursales={sucursalesDisponibles}
        />
      }
      productos={productos}
      proveedores={proveedores}
      sucursalValida={sucursalValida}
      sinFiltros={!puedeListar}
      tieneSucursal={tieneSucursal}
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
