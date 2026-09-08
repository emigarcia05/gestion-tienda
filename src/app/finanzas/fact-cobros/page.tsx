import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { finFactCobrosPeriodoSchema } from "@/lib/validations/finFactCobros";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import { listarFinFactCobrosPtoVtaMes } from "@/services/finFactCobros.service";
import FinFactCobrosPageClient from "@/components/finanzas/FinFactCobrosPageClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}

export default async function FinFactCobrosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const sp = await searchParams;
  const def = mesAnioCalendarioArgentina();
  const parsed = finFactCobrosPeriodoSchema.safeParse({
    mes: sp.mes ?? def.mes,
    anio: sp.anio ?? def.anio,
  });
  const mes = parsed.success ? parsed.data.mes : def.mes;
  const anio = parsed.success ? parsed.data.anio : def.anio;

  const filas = await listarFinFactCobrosPtoVtaMes({ mes, anio });

  return (
    <FinFactCobrosPageClient
      filas={filas}
      mes={mes}
      anio={anio}
      esEditor={rol === "editor"}
    />
  );
}
