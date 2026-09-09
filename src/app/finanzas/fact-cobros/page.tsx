import { redirect } from "next/navigation";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}

/** Alias: Fact & Cobros se movió a VTAS. Y COBROS → Ptos. Venta. */
export default async function FinFactCobrosLegacyRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  if (sp.mes) p.set("mes", sp.mes);
  if (sp.anio) p.set("anio", sp.anio);
  const q = p.toString();
  redirect(`${VTAS_COBROS_ROUTES.ptosVenta}${q ? `?${q}` : ""}`);
}
