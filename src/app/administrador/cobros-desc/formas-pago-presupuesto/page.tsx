import { redirect } from "next/navigation";
import FormasPagoPresupuestoPageClient from "@/components/cobros-desc/FormasPagoPresupuestoPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarTextosFormasPagoPresupuesto } from "@/services/formasPagoPresupuesto.service";

export const dynamic = "force-dynamic";

export default async function FormasPagoPresupuestoPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const filas = await listarTextosFormasPagoPresupuesto();

  return (
    <div className="area-page-shell bg-gris">
      <FormasPagoPresupuestoPageClient filasIniciales={filas} esEditor={rol === "editor"} />
    </div>
  );
}
