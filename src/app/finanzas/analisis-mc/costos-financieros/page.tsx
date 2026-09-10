import { redirect } from "next/navigation";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";

export const dynamic = "force-dynamic";

/** Alias: Costos Financieros se movió a VTAS. & COBROS → Cx. Fin. Cobros. */
export default function FinAnaCosFinaLegacyRedirect() {
  redirect(VTAS_COBROS_ROUTES.cxFinCobros);
}
