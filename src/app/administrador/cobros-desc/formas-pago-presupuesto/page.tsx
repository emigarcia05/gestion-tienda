import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/appRoutes";

export default function FormasPagoPresupuestoRedirectPage() {
  redirect(APP_ROUTES.administrador.cobrosDesc.descuentos);
}
