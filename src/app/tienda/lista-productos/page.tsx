import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ListaProductosPageClient from "@/components/tienda/ListaProductosPageClient";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarListaProductosSchema } from "@/lib/validations/listaProductos";
import { listarListaProductos } from "@/services/listaProductos.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; rubro?: string; marca?: string; pagina?: string }>;
}

export default async function ListaProductosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);

  const parsed = listarListaProductosSchema.safeParse(await searchParams);
  const filtros = parsed.success ? parsed.data : listarListaProductosSchema.parse({});
  const [data, editor] = await Promise.all([listarListaProductos(filtros), esEditor()]);

  return (
    <ListaProductosPageClient
      items={data.items}
      total={data.total}
      totalPaginas={data.totalPaginas}
      rubros={data.rubros}
      marcas={data.marcas}
      q={filtros.q}
      rubro={filtros.rubro}
      marca={filtros.marca}
      paginaNum={filtros.pagina}
      esEditor={editor}
    />
  );
}
