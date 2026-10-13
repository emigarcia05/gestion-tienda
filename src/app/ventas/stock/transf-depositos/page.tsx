import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import TransfDepositosPageClient from "@/components/stock/TransfDepositosPageClient";

export const dynamic = "force-dynamic";

/**
 * Trans. Depósitos: historial de `stock_transferencias` de la sucursal del usuario.
 * El catálogo vive en el modal **Crear Transferencia**.
 */
export default async function TransfDepositosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  return <TransfDepositosPageClient />;
}
