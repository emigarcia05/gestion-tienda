import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

/** Ruta legacy: reglas de descuento viven en modal desde Lista Precios. */
export default function ReglasDescuentosListaPrecioPage() {
  redirect(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);
}
