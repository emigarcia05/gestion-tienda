"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getListaPreciosConOpcionesAction } from "@/actions/listaPrecios";
import { listarCatalogoPxSugeridosFacturaAction } from "@/actions/factura";
import SugeridosTablaConFiltros from "@/components/proveedores/SugeridosTablaConFiltros";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { FilaListaPrecioParaCliente } from "@/services/listaPrecios.service";
import type { CatalogoPxSugeridosFactura } from "@/services/facturaProductos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onElegir: (fila: FilaListaPrecioParaCliente) => void;
  elegirOcupado?: boolean;
}

export default function FacturaPxSugeridosModal({
  open,
  onOpenChange,
  onElegir,
  elegirOcupado = false,
}: Props) {
  const [catalogo, setCatalogo] = useState<CatalogoPxSugeridosFactura | null>(null);

  useEffect(() => {
    if (!open || catalogo) return;
    let cancelado = false;
    listarCatalogoPxSugeridosFacturaAction().then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        setCatalogo({ proveedores: [], marcas: [] });
        return;
      }
      setCatalogo(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [open, catalogo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="xl"
        title="PX SUGERIDOS"
        scrollBody={false}
        padding="sm"
        className="h-[85vh] max-w-5xl"
        bodyClassName="flex h-full min-h-0 flex-col"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {catalogo ? (
          <SugeridosTablaConFiltros
            proveedores={catalogo.proveedores}
            marcas={catalogo.marcas}
            fetchListaPreciosConOpcionesAction={getListaPreciosConOpcionesAction}
            onElegir={onElegir}
            elegirOcupado={elegirOcupado}
          />
        ) : (
          <p className="px-3 py-3 text-sm text-muted-foreground">Cargando…</p>
        )}
      </AppModal>
    </Dialog>
  );
}
