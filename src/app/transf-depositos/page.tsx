import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import TransfDepositosPageClient from "@/components/stock/TransfDepositosPageClient";
import {
  TRANSF_DEPOSITOS_DATA_VACIO,
  type SucursalTransf,
} from "@/lib/transfDepositosTypes";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    generar?: string;
    origen?: string;
    destino?: string;
    q?: string;
    marca?: string;
    rubro?: string;
    pagina?: string;
  }>;
}

function parseSucursal(raw: string | undefined): SucursalTransf | null {
  return raw === "guaymallen" || raw === "maipu" ? raw : null;
}

/**
 * Shell UI de Trans. Depósitos. Sin backend de catálogo/lote todavía:
 * datos vacíos; la grilla vive en `localStorage` hasta el nuevo cableado.
 */
export default async function TransfDepositosPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const {
    generar,
    origen,
    destino,
    q = "",
    marca = "",
    rubro = "",
    pagina = "1",
  } = await searchParams;

  const origenValido = parseSucursal(origen);
  const destinoParseado = parseSucursal(destino);
  const destinoValido =
    destinoParseado !== null && destinoParseado !== origenValido
      ? destinoParseado
      : null;
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);

  return (
    <TransfDepositosPageClient
      data={TRANSF_DEPOSITOS_DATA_VACIO}
      origen={origenValido}
      destino={destinoValido}
      q={q}
      marca={marca}
      rubro={rubro}
      paginaNum={paginaNum}
      abrirGenerar={generar === "1"}
      paramsPagina={{
        origen: origenValido ?? "",
        destino: destinoValido ?? "",
        q,
        marca,
        rubro,
      }}
    />
  );
}
