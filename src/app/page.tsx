import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/appRoutes";

/** Entrada de la app: hub del área Ventas. */
export default function HomePage() {
  redirect(APP_ROUTES.ventas.hub);
}
