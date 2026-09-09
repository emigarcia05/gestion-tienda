import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { getReposicionData, type SucursalReposicion } from "@/actions/reposicion";
import { getEnviarPedidoData } from "@/actions/pedidos";
import ReposicionPageClient from "@/components/pedidos/ReposicionPageClient";
import { prisma } from "@/lib/prisma";
import { getPosicionIvaComparacionRevisionToken } from "@/services/finBalPosicionIvaComparacionRevision.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    sucursal?: string;
    q?: string;
    marca?: string;
    rubro?: string;
    configurado?: string;
    pagina?: string;
    proveedor?: string;
  }>;
}

export default async function PedidoReposicionPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) redirect(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);

  const {
    sucursal,
    q = "",
    marca = "",
    rubro = "",
    configurado = "",
    pagina = "1",
    proveedor = "",
  } = await searchParams;

  const sucursalesPedido = await prisma.sucursal.findMany({
    where: { pedido: true, codigo: { in: ["guaymallen", "maipu"] } },
    select: { codigo: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const sucursalesDisponibles = sucursalesPedido.map((s) => ({
    value: s.codigo as SucursalReposicion,
    label: s.nombre.toUpperCase(),
  }));
  const codigosHabilitados = new Set(sucursalesPedido.map((s) => s.codigo));
  const sucursalValida: SucursalReposicion | null =
    (sucursal === "guaymallen" || sucursal === "maipu") && codigosHabilitados.has(sucursal)
      ? (sucursal as SucursalReposicion)
      : null;

  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);

  const [data, { proveedores }, ivaComparacionRevisionToken] = await Promise.all([
    getReposicionData(sucursalValida, {
      q,
      marca,
      rubro,
      configurado: configurado === "si" ? "si" : "",
      pagina: paginaNum,
      proveedor,
    }),
    getEnviarPedidoData(),
    getPosicionIvaComparacionRevisionToken(),
  ]);

  const paramsPagina: Record<string, string> = {
    sucursal: sucursalValida ?? "",
    q,
    marca,
    rubro,
    configurado: configurado === "si" ? "si" : "",
    proveedor,
  };

  return (
    <ReposicionPageClient
      data={data}
      proveedores={proveedores}
      sucursalValida={sucursalValida}
      q={q}
      marca={marca}
      rubro={rubro}
      configurado={configurado === "si" ? "si" : ""}
      proveedor={proveedor}
      sucursales={sucursalesDisponibles}
      paginaNum={paginaNum}
      paramsPagina={paramsPagina}
      ivaComparacionRevisionToken={ivaComparacionRevisionToken}
    />
  );
}
