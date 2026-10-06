"use client";

import { useRef, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltrosTransfDepositos from "@/components/stock/FiltrosTransfDepositos";
import TablaTransfDepositos, {
  type TablaTransfDepositosHandle,
} from "@/components/stock/TablaTransfDepositos";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import { Button } from "@/components/ui/button";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  crearTransferenciaApi,
  pedirRefrescoNotificaciones,
} from "@/lib/stockTransferenciasClient";
import { parTransfIncluyeSucursalUsuario } from "@/lib/transfDepositosControl";
import type {
  SucursalTransf,
  TransfDepositosData,
} from "@/lib/transfDepositosTypes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";

interface Props {
  data: TransfDepositosData;
  origen: SucursalTransf | null;
  destino: SucursalTransf | null;
  q: string;
  marca: string;
  rubro: string;
  paginaNum: number;
  paramsPagina: Record<string, string>;
}

/**
 * Pantalla **Stock · Trans. Depósitos**.
 * **Generar Transferencia** crea `stock_transferencias` EMITIDO_PENDIENTE y
 * notifica a la otra sucursal. Sin DUX ni Excel.
 */
export default function TransfDepositosPageClient({
  data,
  origen,
  destino,
  q,
  marca,
  rubro,
  paginaNum,
  paramsPagina,
}: Props) {
  const tieneOrigen = origen !== null;
  const tablaRef = useRef<TablaTransfDepositosHandle>(null);
  const [isPending, startTransition] = useTransition();

  const filters = (
    <FiltrosTransfDepositos
      data={data}
      origenActual={origen}
      destinoActual={destino}
      qActual={q}
      marcaActual={marca}
      rubroActual={rubro}
    />
  );

  function generarTransferencia() {
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Elegí un usuario.");
      return;
    }
    if (!origen) {
      toast.error("Elegí sucursal origen.");
      return;
    }
    if (!destino) {
      toast.error("Elegí origen y destino distintos.");
      return;
    }
    if (
      !parTransfIncluyeSucursalUsuario(
        origen,
        destino,
        usuario.sucursalPorDefecto
      )
    ) {
      toast.error("Origen o destino debe ser tu sucursal.");
      return;
    }
    const items = tablaRef.current?.getItemsConCantidad() ?? [];
    if (items.length === 0) {
      toast.error("Cargá al menos una cantidad.");
      return;
    }
    startTransition(async () => {
      const res = await crearTransferenciaApi({
        origenCodigo: origen,
        destinoCodigo: destino,
        personalId: usuario.idPersonal,
        items: items.map((item) => ({
          codItem: item.codTienda,
          cantidad: item.cantidad,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      tablaRef.current?.clearCantidades();
      pedirRefrescoNotificaciones();
      toast.success(`Transferencia N° ${res.data.numero} enviada.`, {
        description: `Queda pendiente hasta que ${res.data.confirmaNombre} la acepte.`,
      });
    });
  }

  return (
    <ClassicFilteredTableLayout
      title="Stock"
      subtitle="Trans. Depósitos"
      filters={filters}
      actions={
        <Button
          type="button"
          className="h-10 px-4"
          onClick={generarTransferencia}
          disabled={isPending}
        >
          <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />
          Generar Transferencia
        </Button>
      }
    >
      <div className="flex flex-col h-full min-h-0 gap-0.5">
        <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
          <TablaTransfDepositos
            ref={tablaRef}
            data={data}
            origen={origen}
            destino={destino}
          />
        </div>
        {tieneOrigen && data.totalPaginas > 1 && (
          <div className="flex justify-end pt-2 shrink-0">
            <PaginacionTabla
              basePath={GP_ROUTES.ayudaVendedor.transfDepositos}
              params={paramsPagina}
              paginaActual={paginaNum}
              totalPaginas={data.totalPaginas}
              total={data.total}
              pageSize={PAGE_SIZE}
            />
          </div>
        )}
      </div>
    </ClassicFilteredTableLayout>
  );
}
