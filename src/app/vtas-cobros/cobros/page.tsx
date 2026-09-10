import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { finVtasCobrosPeriodoSchema } from "@/lib/validations/finVtasCobros";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import { listarFinVtasCobros } from "@/services/finVtasCobros.service";
import VtasCobrosCobrosPageClient from "@/components/vtas-cobros/VtasCobrosCobrosPageClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}

export default async function VtasCobrosCobrosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const sp = await searchParams;
  const def = mesAnioCalendarioArgentina();
  const parsed = finVtasCobrosPeriodoSchema.safeParse({
    mes: sp.mes ?? def.mes,
    anio: sp.anio ?? def.anio,
  });
  const mes = parsed.success ? parsed.data.mes : def.mes;
  const anio = parsed.success ? parsed.data.anio : def.anio;
  const filas = await listarFinVtasCobros({ mes, anio });

  return (
    <VtasCobrosCobrosPageClient
      filas={filas}
      mes={mes}
      anio={anio}
      mesActual={def.mes}
      anioActual={def.anio}
      esEditor={rol === "editor"}
    />
  );
}
