import { redirect } from "next/navigation";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";

/** La tabla `fin_vtas_cobros` se eliminó; la pantalla de listado ya no existe. */
export default function VtasCobrosCobrosRedirectPage() {
  redirect(VTAS_COBROS_ROUTES.hub);
}
