import { redirect } from "next/navigation";
import DescPromosPageClient from "@/components/desc-promos/DescPromosPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarCobrosCuotas } from "@/services/cobrosCuotas.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import {
  listarDescPromos,
  listarOpcionesProductoDescPromo,
} from "@/services/descPromo.service";
import {
  listarMarcasCatalogo,
  listarRubrosCatalogo,
} from "@/services/listaProductos.service";

export const dynamic = "force-dynamic";

export default async function DescPromosDescuentosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.descPromos.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [items, productos, pagosCat, cuotas, rubros, marcas] = await Promise.all([
    listarDescPromos(),
    listarOpcionesProductoDescPromo(),
    listarFinAnaCosFinaPagos(),
    listarCobrosCuotas(),
    listarRubrosCatalogo(),
    listarMarcasCatalogo(),
  ]);

  const pagos = pagosCat.map((pago) => ({
    id: pago.id,
    nombre: pago.nombre,
  }));

  return (
    <div className="area-page-shell">
      <DescPromosPageClient
        items={items}
        productos={productos}
        pagos={pagos}
        cuotas={cuotas}
        rubros={rubros}
        marcas={marcas}
        esEditor={rol === "editor"}
      />
    </div>
  );
}
