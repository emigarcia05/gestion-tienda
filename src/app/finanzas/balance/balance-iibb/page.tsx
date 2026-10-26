import { redirect } from "next/navigation";
import FinBalBalanceIibbPageClient from "@/components/finanzas/FinBalBalanceIibbPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { esEditor, getRol } from "@/lib/sesion";
import { listarBalanceIibbData } from "@/services/balIibb.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function FinBalBalanceIibbPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [data, editor] = await Promise.all([listarBalanceIibbData(await searchParams), esEditor()]);

  return <FinBalBalanceIibbPageClient data={data} esEditor={editor} />;
}
