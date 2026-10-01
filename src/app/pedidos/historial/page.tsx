import { getRol } from "@/lib/sesion";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { redirect } from "next/navigation";
import * as pedidosHistoriaService from "@/services/pedidosHistoria.service";
import HistorialPedidosPageClient from "@/components/pedidos/HistorialPedidosPageClient";
import { prisma } from "@/lib/prisma";
import type { SucursalPedidoEnvio } from "@/services/pedidosEnvio.service";
import type { PedidoHistoriaEstado } from "@/services/pedidosHistoria.service";

export const dynamic = "force-dynamic";

const LOG_TAG = "[pedidos/historial][page]";

interface Props {
  searchParams: Promise<{
    pagina?: string;
    proveedor?: string;
    sucursal?: string;
    estado?: string;
    q?: string;
  }>;
}

export default async function HistorialPedidosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) redirect(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);

  const { pagina = "1", proveedor = "", sucursal = "", estado = "", q = "" } =
    await searchParams;
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const qTrim = q.trim();

  const proveedorId = proveedor.trim();
  const sucursalCodigo: SucursalPedidoEnvio | "" =
    sucursal === "maipu" ? "maipu" : sucursal === "guaymallen" ? "guaymallen" : "";

  const estadoParam = estado.trim().toUpperCase();
  /** Sin `estado` en la URL (entrada al módulo): por defecto solo pedidos abiertos. */
  const estadoFiltro: PedidoHistoriaEstado | "ALL" =
    estadoParam === "RECEPCIONADO"
      ? "RECEPCIONADO"
      : estadoParam === "ALL"
        ? "ALL"
        : "ABIERTO";

  const estadoUi: "ABIERTO" | "RECEPCIONADO" | "ALL" = estadoFiltro;

  // Resolución defensiva del listado de proveedores: cualquier error transitorio
  // de Neon (timeout, pool exhausted, conn reset) NO debe romper el render del
  // Server Component. Si falla, mostramos la página con `proveedores: []` y
  // dejamos rastro en logs para el digest correspondiente.
  let proveedores: Array<{ id: string; nombre: string; prefijo: string }> = [];
  try {
    const proveedoresRaw = await prisma.proveedor.findMany({
      where: { proveedorMercaderia: true },
      select: { id: true, nombre: true, prefijo: true },
      orderBy: { prefijo: "asc" },
    });
    proveedores = proveedoresRaw.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      prefijo: p.prefijo ?? "",
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(LOG_TAG, "fallo prisma.proveedor.findMany:", msg);
  }

  // `listarPedidosHistoria` ya devuelve ServiceResult; aún así envolvemos la
  // llamada por si Prisma lanza fuera del catch del servicio (raro, pero
  // posible cuando el adapter PG falla en init durante revalidaciones).
  let res: Awaited<
    ReturnType<typeof pedidosHistoriaService.listarPedidosHistoria>
  >;
  try {
    res = await pedidosHistoriaService.listarPedidosHistoria({
      pagina: paginaNum,
      proveedorId: proveedorId || undefined,
      sucursalCodigo: sucursalCodigo || undefined,
      estado: estadoFiltro,
      q: qTrim || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(LOG_TAG, "fallo listarPedidosHistoria:", msg);
    res = { success: false, error: msg };
  }

  if (!res.success) {
    return (
      <div className="area-page-shell">
        <HistorialPedidosPageClient
          items={[]}
          total={0}
          totalPaginas={1}
          paginaNum={paginaNum}
          proveedores={proveedores}
          proveedorId={proveedorId}
          sucursalCodigo={sucursalCodigo}
          estado={estadoUi}
          q={qTrim}
        />
      </div>
    );
  }

  const items = res.data.items.map((it) => ({
    ...it,
    generadoAt: it.generadoAt.toISOString(),
    registradoAt: it.registradoAt ? it.registradoAt.toISOString() : null,
  }));

  return (
    <HistorialPedidosPageClient
      items={items}
      total={res.data.total}
      totalPaginas={res.data.totalPaginas}
      paginaNum={res.data.paginaActual}
      proveedores={proveedores}
      proveedorId={proveedorId}
      sucursalCodigo={sucursalCodigo}
      estado={estadoUi}
      q={qTrim}
    />
  );
}
