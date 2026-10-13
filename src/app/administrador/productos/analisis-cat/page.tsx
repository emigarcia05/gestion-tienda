import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { getArbolCategorias } from "@/services/categoriasComparacion.service";
import ComparacionCategoriasClient from "@/components/proveedores/ComparacionCategoriasClient";

export const dynamic = "force-dynamic";

export default async function ComparacionCategoriasPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.comparacionCategorias.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const arbol = await getArbolCategorias();

  return (
    <div className="area-page-shell">
      <ComparacionCategoriasClient arbolInicial={arbol} rol={rol} />
    </div>
  );
}
