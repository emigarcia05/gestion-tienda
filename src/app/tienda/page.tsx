import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

/** Cx Compra se fusionó con Lista Productos: conserva los filtros de la URL. */
export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) p.set(k, v);
  }
  const query = p.toString();
  const destino = GP_ROUTES.analisisPrecios.listaPropia.listaProductos;
  redirect(query ? `${destino}?${query}` : destino);
}
