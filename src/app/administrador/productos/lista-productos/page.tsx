import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getTiendaPageData } from "@/actions/tienda";
import ListaProductosPageClient from "@/components/tienda/ListaProductosPageClient";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    rubro?: string;
    cxCompra?: string;
    marca?: string;
    proveedor?: string;
    vinculado?: string;
    pagina?: string;
  }>;
}

export default async function ListaProductosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);

  const sp = await searchParams;
  const { q = "", rubro = "", cxCompra = "", marca = "", proveedor = "", pagina = "1" } = sp;
  const vLower = (sp.vinculado ?? "").toLowerCase();
  const vinculado = vLower === "no" || vLower === "si" ? vLower : "";

  const [data, editor] = await Promise.all([
    getTiendaPageData({
      q,
      rubro,
      cxCompra,
      marca,
      proveedor,
      vinculado: vinculado || undefined,
      pagina,
    }),
    esEditor(),
  ]);

  return (
    <ListaProductosPageClient
      items={data.items}
      total={data.total}
      totalPaginas={data.totalPaginas}
      proveedores={data.proveedores}
      marcas={data.marcas.map((m) => m.marca)}
      rubros={data.rubros.map((r) => r.rubro)}
      proveedoresCxCompra={data.proveedoresCxCompra}
      rol={rol}
      esEditor={editor}
      filtros={{ q, rubro, cxCompra, marca, proveedor, vinculado }}
      paginaNum={Math.max(1, parseInt(pagina, 10) || 1)}
    />
  );
}
