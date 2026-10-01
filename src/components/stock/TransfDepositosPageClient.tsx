"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltrosTransfDepositos from "@/components/stock/FiltrosTransfDepositos";
import TablaTransfDepositos, {
  type TablaTransfDepositosHandle,
} from "@/components/stock/TablaTransfDepositos";
import GenerarTransfDepositosModal from "@/components/stock/GenerarTransfDepositosModal";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import { Button } from "@/components/ui/button";
import { registrarTransferenciasDepositosAction } from "@/actions/stock";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PAGE_SIZE } from "@/lib/pagination";
import { enfocarDuxTransferenciaDepositosTab } from "@/lib/transfDepositosControl";
import type { Sucursal, TransfDepositosData } from "@/actions/stock";

interface Props {
  data: TransfDepositosData;
  origen: Sucursal | null;
  destino: Sucursal | null;
  q: string;
  marca: string;
  rubro: string;
  paginaNum: number;
  abrirGenerar?: boolean;
  paramsPagina: Record<string, string>;
}

/**
 * Pantalla **Stock · Trans. Depósitos**: origen/destino → marca/rubro/búsqueda;
 * grilla DESCRIPCIÓN / {origen} / → / {destino} / ACCIONES;
 * header **Generar Transf.** persiste cantidades de la grilla (si hay) y abre
 * el modal del lote abierto origen→destino. El borrador de la grilla se conserva
 * en `localStorage` por par origen→destino hasta **Transferido**.
 */
export default function TransfDepositosPageClient({
  data,
  origen,
  destino,
  q,
  marca,
  rubro,
  paginaNum,
  abrirGenerar = false,
  paramsPagina,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const tieneOrigen = origen !== null;
  const tablaRef = useRef<TablaTransfDepositosHandle>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (abrirGenerar && !modalOpen) {
    setModalOpen(true);
  }

  useEffect(() => {
    if (!abrirGenerar) return;
    const p = new URLSearchParams();
    for (const [clave, valor] of Object.entries(paramsPagina)) {
      if (valor) p.set(clave, valor);
    }
    const query = p.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [abrirGenerar, paramsPagina, pathname, router]);

  const filters = (
    <FiltrosTransfDepositos
      data={data}
      origenActual={origen}
      destinoActual={destino}
      qActual={q}
      marcaActual={marca}
      rubroActual={rubro}
      totalItems={data.total}
    />
  );

  function generarTransf() {
    if (!origen) {
      toast.error("Elegí sucursal origen.");
      return;
    }
    if (destino) {
      enfocarDuxTransferenciaDepositosTab();
    }
    const items = tablaRef.current?.getItemsConCantidad() ?? [];
    if (items.length === 0) {
      setModalOpen(true);
      return;
    }
    if (!destino) {
      toast.error("Elegí origen y destino distintos.");
      return;
    }
    startTransition(async () => {
      const res = await registrarTransferenciasDepositosAction({
        origen,
        destino,
        items,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setModalOpen(true);
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
          onClick={generarTransf}
          disabled={isPending}
        >
          <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />
          Generar Transf.
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

      <GenerarTransfDepositosModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        origenCodigo={origen}
        destinoCodigo={destino}
        onTransferido={() => {
          tablaRef.current?.clearCantidades();
          router.refresh();
        }}
      />
    </ClassicFilteredTableLayout>
  );
}
