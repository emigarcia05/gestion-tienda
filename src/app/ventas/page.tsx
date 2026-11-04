import type { Metadata } from "next";
import TableroVentas from "@/components/ventas/TableroVentas";
import {
  obtenerTableroVentas,
  tableroVentasVacio,
} from "@/services/tableroVentas.service";

export const metadata: Metadata = {
  title: "TiendaColor — Gestión",
};

export const dynamic = "force-dynamic";

/** Hub de Ventas: tablero mientras no hay una función abierta. */
export default async function VentasHubPage() {
  const resultado = await obtenerTableroVentas();
  return (
    <div className="area-page-shell">
      <TableroVentas
        datos={resultado.success ? resultado.data : tableroVentasVacio()}
        error={resultado.success ? undefined : resultado.error}
      />
    </div>
  );
}
