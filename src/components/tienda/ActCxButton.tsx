"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exportarCostoCxDiffAction } from "@/actions/cxPxTienda";
import { descargarExcelCostoCx } from "@/lib/exportCostoCxExcelClient";
import { DUX_NUEVO_IMPORTADOR_URL } from "@/lib/duxImportador";
import ModalSinProductosExportar from "@/components/tienda/ModalSinProductosExportar";

export default function ActCxButton() {
  const [exportando, setExportando] = useState(false);
  const [modalSinProductos, setModalSinProductos] = useState(false);

  async function handleActCx() {
    window.open(DUX_NUEVO_IMPORTADOR_URL, "_blank", "noopener,noreferrer");
    setExportando(true);
    try {
      const res = await exportarCostoCxDiffAction();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo exportar el Excel de costos.");
        return;
      }
      if (res.data.filas.length === 0) {
        setModalSinProductos(true);
        return;
      }
      descargarExcelCostoCx(res.data.filas);
      const n = res.data.filas.length;
      toast.success(
        n === 1
          ? "Excel exportado: 1 ítem."
          : `Excel exportado: ${n.toLocaleString("es-AR")} ítems.`
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error inesperado al exportar costos."
      );
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <ModalSinProductosExportar
        open={modalSinProductos}
        onOpenChange={setModalSinProductos}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="default"
            className="btn-primario-gestion gap-2 shrink-0"
            disabled={exportando}
            onClick={() => void handleActCx()}
          >
            <Upload className="h-4 w-4 shrink-0" />
            {exportando ? "Exportando..." : "Act. Cx."}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Exporta Excel (CODIGO + COSTO) con el costo del proveedor elegido (CX) de cada ítem
          para importar en DUX y abre el importador DUX
        </TooltipContent>
      </Tooltip>
    </>
  );
}
