import { redirect } from "next/navigation";
import FormasPagoPresupuestoPageClient from "@/components/cobros-desc/FormasPagoPresupuestoPageClient";
import { esCobroNotaCreditoNombre } from "@/lib/factura";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarCobrosCuotas } from "@/services/cobrosCuotas.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import { listarTextosFormasPagoPresupuesto } from "@/services/formasPagoPresupuesto.service";

export const dynamic = "force-dynamic";

export default async function FormasPagoPresupuestoPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [filas, pagos, cuotas] = await Promise.all([
    listarTextosFormasPagoPresupuesto(),
    listarFinAnaCosFinaPagos(),
    listarCobrosCuotas(),
  ]);
  const cuotasPorPago = new Map<string, { id: string; cuotas: string }[]>();
  for (const cuota of cuotas) {
    for (const pagoId of new Set(cuota.vinculos.map((vinculo) => vinculo.pagoId))) {
      const lista = cuotasPorPago.get(pagoId) ?? [];
      if (!lista.some((item) => item.id === cuota.id)) {
        lista.push({ id: cuota.id, cuotas: cuota.cuotas });
      }
      cuotasPorPago.set(pagoId, lista);
    }
  }
  for (const lista of cuotasPorPago.values()) {
    lista.sort((a, b) => a.cuotas.localeCompare(b.cuotas, "es"));
  }

  return (
    <div className="area-page-shell bg-gris">
      <FormasPagoPresupuestoPageClient
        filasIniciales={filas}
        formas={pagos
          .filter((pago) => !esCobroNotaCreditoNombre(pago.nombre))
          .map((pago) => ({
            id: pago.id,
            nombre: pago.nombre,
            cuotas: cuotasPorPago.get(pago.id) ?? [],
          }))}
        esEditor={rol === "editor"}
      />
    </div>
  );
}
