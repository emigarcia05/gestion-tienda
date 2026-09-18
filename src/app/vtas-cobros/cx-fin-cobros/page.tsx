import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinAnaCosFinaPageClient from "@/components/finanzas/FinAnaCosFinaPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarFinAnaCosFina } from "@/services/finAnaCosFina.service";
import { listarFinAnaCosFinaTerminalesMarcas } from "@/services/finAnaCosFinaTerminalMarca.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import { listarCobrosBancos } from "@/services/cobrosBancos.service";

export const dynamic = "force-dynamic";

export default async function VtasCobrosCxFinCobrosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const esEditor = rol === "editor";
  const [filas, marcas, pagos, bancos] = await Promise.all([
    listarFinAnaCosFina(),
    listarFinAnaCosFinaTerminalesMarcas(),
    listarFinAnaCosFinaPagos(),
    listarCobrosBancos(),
  ]);

  return (
    <FinAnaCosFinaPageClient
      key={pagos.map((p) => `${p.id}:${p.orden}`).join("|")}
      filas={filas}
      marcas={marcas}
      pagos={pagos}
      bancos={bancos}
      esEditor={esEditor}
    />
  );
}
