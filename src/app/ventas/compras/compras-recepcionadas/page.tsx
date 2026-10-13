import { redirect } from "next/navigation";
import { getRol } from "@/lib/sesion";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { listarComprasRecepcionadas } from "@/services/compras.service";
import ComprasPageClient from "@/components/pedidos/ComprasPageClient";
import type { SucursalPedidoEnvio } from "@/services/pedidosEnvio.service";

export const dynamic = "force-dynamic";

const LOG_TAG = "[pedidos/compras][page]";

interface Props {
  searchParams: Promise<{
    pagina?: string;
    proveedor?: string;
    sucursal?: string;
    q?: string;
  }>;
}

export default async function ComprasPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    redirect(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);
  }

  const { pagina = "1", proveedor = "", sucursal = "", q = "" } = await searchParams;
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const proveedorId = proveedor.trim();
  const sucursalCodigo: SucursalPedidoEnvio | "" =
    sucursal === "maipu" ? "maipu" : sucursal === "guaymallen" ? "guaymallen" : "";
  const qTrim = q.trim();

  let proveedores: Array<{ id: string; nombre: string; prefijo: string }> = [];
  try {
    const rows = await prisma.proveedor.findMany({
      where: { proveedorMercaderia: true },
      select: { id: true, nombre: true, prefijo: true },
      orderBy: { prefijo: "asc" },
    });
    proveedores = rows.map((p) => ({ id: p.id, nombre: p.nombre, prefijo: p.prefijo ?? "" }));
  } catch (e) {
    console.error(LOG_TAG, "fallo proveedores:", e instanceof Error ? e.message : e);
  }

  let res: Awaited<ReturnType<typeof listarComprasRecepcionadas>>;
  try {
    res = await listarComprasRecepcionadas({
      pagina: paginaNum,
      proveedorId: proveedorId || undefined,
      sucursalCodigo: sucursalCodigo || undefined,
      q: qTrim || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(LOG_TAG, "fallo listarComprasRecepcionadas:", msg);
    res = { success: false, error: "Error al listar las compras." };
  }

  return (
    <ComprasPageClient
      items={res.success ? res.data.items : []}
      total={res.success ? res.data.total : 0}
      totalPaginas={res.success ? res.data.totalPaginas : 1}
      paginaNum={res.success ? res.data.paginaActual : paginaNum}
      errorMsg={res.success ? null : res.error}
      proveedores={proveedores}
      proveedorId={proveedorId}
      sucursalCodigo={sucursalCodigo}
      q={qTrim}
    />
  );
}
