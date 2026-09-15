import { redirect } from "next/navigation";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";

export const dynamic = "force-dynamic";

/** Alias: Fact & Cobros se movió a VTAS. & COBROS → Ptos. Vtas. */
export default function FinFactCobrosLegacyRedirect() {
  redirect(VTAS_COBROS_ROUTES.ptosVenta);
}
