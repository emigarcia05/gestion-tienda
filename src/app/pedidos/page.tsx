import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

export const dynamic = "force-dynamic";

export default function PedidosRootPage() {
  redirect(GP_ROUTES.pedidoMercaderia.pedirMercaderia);
}
