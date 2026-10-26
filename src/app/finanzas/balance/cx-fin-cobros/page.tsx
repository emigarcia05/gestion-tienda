import { redirect } from "next/navigation";
import FinBalCxFinCobrosPageClient from "@/components/finanzas/FinBalCxFinCobrosPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarCxFinCobrosData } from "@/services/balCxFinCobros.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    periodo?: string;
    pago?: string;
    sucursal?: string;
    q?: string;
    pagina?: string;
  }>;
}

export default async function FinBalCxFinCobrosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const data = await listarCxFinCobrosData(await searchParams);

  return <FinBalCxFinCobrosPageClient data={data} />;
}
