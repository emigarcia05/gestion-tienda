import { redirect } from "next/navigation";
import FinBalCxMercVendPageClient from "@/components/finanzas/FinBalCxMercVendPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarCxMercVendData } from "@/services/balCxMercaderia.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    periodo?: string;
    rubro?: string;
    sucursal?: string;
    q?: string;
    pagina?: string;
  }>;
}

export default async function FinBalCxMercVendPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const data = await listarCxMercVendData(await searchParams);

  return <FinBalCxMercVendPageClient data={data} />;
}
