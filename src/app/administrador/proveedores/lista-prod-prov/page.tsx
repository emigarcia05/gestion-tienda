import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getProveedoresMercaderia } from "@/actions/proveedores";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { listarRubrosOpcionesDesdeProdTienda } from "@/services/rubrosProdTienda.service";
import { getCotizacionUsdEstado } from "@/services/cotizacionUsd.service";
import ListaPreciosPageClient from "@/components/proveedores/ListaPreciosPageClient";

export const dynamic = "force-dynamic";

export default async function ListaPreciosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.proveedores.listaPrecios)) redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);

  const [proveedores, marcasRows, rubros, cotizacionUsd] = await Promise.all([
    getProveedoresMercaderia(),
    prisma.marca.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    listarRubrosOpcionesDesdeProdTienda(),
    getCotizacionUsdEstado(),
  ]);

  const marcas = marcasRows.map((m) => ({ id: m.id, nombre: m.nombre }));

  return (
    <div className="area-page-shell">
      <ListaPreciosPageClient
        proveedores={proveedores}
        marcas={marcas}
        rubros={rubros}
        rol={rol}
        cotizacionUsd={cotizacionUsd}
      />
    </div>
  );
}
