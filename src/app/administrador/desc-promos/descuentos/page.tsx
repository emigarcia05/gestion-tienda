import { redirect } from "next/navigation";
import DescPromosPageClient from "@/components/desc-promos/DescPromosPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import {
  listarDescPromos,
  listarOpcionesProductoDescPromo,
} from "@/services/descPromo.service";

export const dynamic = "force-dynamic";

export default async function DescPromosDescuentosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.descPromos.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [items, productos, pagosCat] = await Promise.all([
    listarDescPromos(),
    listarOpcionesProductoDescPromo(),
    listarFinAnaCosFinaPagos(),
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
        esEditor={rol === "editor"}
      />
    </div>
  );
}
