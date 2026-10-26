import { redirect } from "next/navigation";
import FinBalBalanceIvaPageClient from "@/components/finanzas/FinBalBalanceIvaPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { esEditor, getRol } from "@/lib/sesion";
import { listarBalanceIvaData } from "@/services/balIva.service";
import { getEstadoIvaComparacionPedido } from "@/services/finBalPosicionIvaComparacionPedido.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function FinBalBalanceIvaPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [data, comparacionPedidos, editor] = await Promise.all([
    listarBalanceIvaData(await searchParams),
    getEstadoIvaComparacionPedido(),
    esEditor(),
  ]);

  return (
    <FinBalBalanceIvaPageClient
      data={data}
      comparacionPedidos={comparacionPedidos}
      esEditor={editor}
    />
  );
}
