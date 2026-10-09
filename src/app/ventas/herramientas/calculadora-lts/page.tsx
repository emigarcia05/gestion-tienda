import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { getTiposPinturaRendimientosAction } from "@/actions/tiposPinturaRendimientos";
import TiendaCalcLitrosPageClient from "@/components/tienda/TiendaCalcLitrosPageClient";

export const dynamic = "force-dynamic";

export default async function TiendaCalcLitrosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.tintoLts)) redirect(GP_ROUTES.ayudaVendedor.controlStock);

  const tiposPintura = await getTiposPinturaRendimientosAction();
  const esEditor = rol === "editor";

  return <TiendaCalcLitrosPageClient tiposPintura={tiposPintura} esEditor={esEditor} />;
}
