import FacturaCuentaCorrientePageClient from "@/components/facturacion/FacturaCuentaCorrientePageClient";
import { tokenCuentaCorrientePublicaSchema } from "@/lib/validations/factura";
import { resolverSesionCuentaCorrientePublica } from "@/services/clientes.service";
import {
  listarNombresMarcaDistinctProdTienda,
  listarNombresRubroDistinctProdTienda,
} from "@/services/rubrosProdTienda.service";

export const dynamic = "force-dynamic";

export default async function CuentaCorrientePublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = tokenCuentaCorrientePublicaSchema.safeParse(token);
  if (!parsed.success) {
    return (
      <div className="area-page-shell flex items-center justify-center">
        <p className="text-sm text-muted-foreground">El link no es válido.</p>
      </div>
    );
  }

  const [sesion, marcasCatalogo, rubrosCatalogo] = await Promise.all([
    resolverSesionCuentaCorrientePublica(parsed.data),
    listarNombresMarcaDistinctProdTienda(),
    listarNombresRubroDistinctProdTienda(),
  ]);

  if (!sesion.success) {
    return (
      <div className="area-page-shell flex items-center justify-center">
        <p className="text-sm text-muted-foreground">El link no es válido.</p>
      </div>
    );
  }

  return (
    <div className="area-page-shell">
      <FacturaCuentaCorrientePageClient
        marcasCatalogo={marcasCatalogo}
        rubrosCatalogo={rubrosCatalogo}
        visorPublico={{ token: parsed.data, sesion: sesion.data }}
      />
    </div>
  );
}
