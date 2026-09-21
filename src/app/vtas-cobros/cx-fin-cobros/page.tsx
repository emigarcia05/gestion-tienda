import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinAnaCosFinaPageClient from "@/components/finanzas/FinAnaCosFinaPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarFinAnaCosFina } from "@/services/finAnaCosFina.service";
import { listarFinAnaCosFinaTerminalesMarcas } from "@/services/finAnaCosFinaTerminalMarca.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
<<<<<<< HEAD
import { listarCobrosBancos } from "@/services/cobrosBancos.service";
=======
import { listarCobrosCuotas } from "@/services/cobrosCuotas.service";
>>>>>>> facturacion

export const dynamic = "force-dynamic";

export default async function VtasCobrosCxFinCobrosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const esEditor = rol === "editor";
<<<<<<< HEAD
  const [filas, marcas, pagos, bancos] = await Promise.all([
    listarFinAnaCosFina(),
    listarFinAnaCosFinaTerminalesMarcas(),
    listarFinAnaCosFinaPagos(),
    listarCobrosBancos(),
=======
  const [filas, marcas, pagos, cuotas] = await Promise.all([
    listarFinAnaCosFina(),
    listarFinAnaCosFinaTerminalesMarcas(),
    listarFinAnaCosFinaPagos(),
    listarCobrosCuotas(),
>>>>>>> facturacion
  ]);

  return (
    <FinAnaCosFinaPageClient
      filas={filas}
      marcas={marcas}
      pagos={pagos}
<<<<<<< HEAD
      bancos={bancos}
=======
      cuotas={cuotas}
>>>>>>> facturacion
      esEditor={esEditor}
    />
  );
}
