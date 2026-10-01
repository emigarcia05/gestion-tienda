import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { getTransfDepositos, type Sucursal } from "@/actions/stock";
import TransfDepositosPageClient from "@/components/stock/TransfDepositosPageClient";

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

function parseSucursal(raw: string | undefined): Sucursal | null {
  return raw === "guaymallen" || raw === "maipu" ? raw : null;
}

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
  /** Origen y destino no pueden coincidir. */
  const destinoValido =
    destinoParseado !== null && destinoParseado !== origenValido
      ? destinoParseado
      : null;
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);

  const data = origenValido
    ? await getTransfDepositos(origenValido, destinoValido, {
        q,
        marca,
        rubro,
        pagina: paginaNum,
      })
    : {
        items: [],
        total: 0,
        totalPaginas: 0,
        marcas: [],
        rubros: [],
        controlesRecientes: [],
        loteAbierto: [],
      };

  return (
    <TransfDepositosPageClient
      data={data}
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
