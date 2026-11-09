import { redirect } from "next/navigation";
import FormasPagoPresupuestoPageClient from "@/components/cobros-desc/FormasPagoPresupuestoPageClient";
import { esCobroNotaCreditoNombre } from "@/lib/factura";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import { listarTextosFormasPagoPresupuesto } from "@/services/formasPagoPresupuesto.service";

export const dynamic = "force-dynamic";

export default async function FormasPagoPresupuestoPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [filas, pagos] = await Promise.all([
    listarTextosFormasPagoPresupuesto(),
    listarFinAnaCosFinaPagos(),
  ]);

  return (
    <div className="area-page-shell bg-gris">
      <FormasPagoPresupuestoPageClient
        filasIniciales={filas}
        formas={pagos
          .filter((pago) => !esCobroNotaCreditoNombre(pago.nombre))
          .map((pago) => ({ id: pago.id, nombre: pago.nombre }))}
        esEditor={rol === "editor"}
      />
    </div>
  );
}
