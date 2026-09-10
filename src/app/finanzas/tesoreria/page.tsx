import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinanzasTesoreriaPageClient from "@/components/finanzas/FinanzasTesoreriaPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarCajasTesoreria } from "@/services/cajasTesoreria.service";
import { formatFechaCortaArgentina } from "@/lib/fechaArgentina";

export const dynamic = "force-dynamic";

export default async function FinanzasTesoreriaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }
  const esEditor = rol === "editor";

  const items = await listarCajasTesoreria();
  const filas = items.map((c) => ({
    id: c.id,
    entidadId: c.entidadId,
    entidadNombre: c.entidadNombre,
    titular: c.titular,
    sucursalId: c.sucursalId,
    sucursalNombre: c.sucursalNombre,
    tipoCaja: c.tipoCaja,
    tipoValor: c.tipoValor,
    disponibilidad: c.disponibilidad,
    monto: c.monto,
    montoDisponible: c.montoDisponible,
    montoChequesDiferidos: c.montoChequesDiferidos,
    ultActualizacion: formatFechaCortaArgentina(c.ultActualizacion),
    ultActualizacionIso: c.ultActualizacion.toISOString(),
  }));

  return <FinanzasTesoreriaPageClient filas={filas} esEditor={esEditor} />;
}
