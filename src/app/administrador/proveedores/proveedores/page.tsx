import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getProveedoresMercaderia } from "@/actions/proveedores";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import CrearProveedorModal from "@/components/proveedores/CrearProveedorModal";
import TablaProveedoresLista from "@/components/proveedores/TablaProveedoresLista";

export const dynamic = "force-dynamic";

export default async function ListaProveedoresPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.proveedores.lista)) redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);

  const [proveedores] = await Promise.all([getProveedoresMercaderia()]);
  const p = PERMISOS.proveedores;

  const actions =
    puede(rol, p.acciones.nuevoProveedor) ? (
      <div className="flex gap-2">
        <CrearProveedorModal />
      </div>
    ) : undefined;

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout title="Proveedores" subtitle="Proveedores" actions={actions}>
        <TablaProveedoresLista proveedores={proveedores} />
      </ClassicFilteredTableLayout>
    </div>
  );
}
