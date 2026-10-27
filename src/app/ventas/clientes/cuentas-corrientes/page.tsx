import { redirect } from "next/navigation";
import FacturaCuentaCorrientePageClient from "@/components/facturacion/FacturaCuentaCorrientePageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { obtenerClienteFacturaSchema } from "@/lib/validations/factura";
import { obtenerClienteListaPorId } from "@/services/clientes.service";
import {
  listarNombresMarcaDistinctProdTienda,
  listarNombresRubroDistinctProdTienda,
} from "@/services/rubrosProdTienda.service";

export const dynamic = "force-dynamic";

export default async function FacturaCuentaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const { cliente } = await searchParams;
  const clienteParsed = obtenerClienteFacturaSchema.safeParse({ id: cliente });

  const [marcasCatalogo, rubrosCatalogo, clienteInicial] = await Promise.all([
    listarNombresMarcaDistinctProdTienda(),
    listarNombresRubroDistinctProdTienda(),
    clienteParsed.success ? obtenerClienteListaPorId(clienteParsed.data.id) : null,
  ]);

  return (
    <div className="area-page-shell">
      <FacturaCuentaCorrientePageClient
        marcasCatalogo={marcasCatalogo}
        rubrosCatalogo={rubrosCatalogo}
        clienteInicial={clienteInicial}
      />
    </div>
  );
}
