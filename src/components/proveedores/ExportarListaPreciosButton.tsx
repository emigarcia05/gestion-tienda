"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { exportarListaPreciosAction } from "@/actions/listaPrecios";
import type { ListaPreciosFiltrosExportInput } from "@/actions/listaPrecios";
import { descargarExcelListaPrecios } from "@/lib/exportListaPreciosExcelClient";

export interface ListaPreciosFiltrosExportSnapshot {
  filtros: ListaPreciosFiltrosExportInput | null;
  hasFilterActive: boolean;
  /** Total de ítems que coinciden con los filtros (sin paginación). */
  total: number;
}

interface Props {
  snapshot: ListaPreciosFiltrosExportSnapshot;
}

export default function ExportarListaPreciosButton({ snapshot }: Props) {
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    if (!snapshot.hasFilterActive || !snapshot.filtros) {
      toast.error(
        "Aplicá un filtro o escribí al menos 3 caracteres en la búsqueda para exportar."
      );
      return;
    }

    setExportando(true);
    try {
      const res = await exportarListaPreciosAction(snapshot.filtros);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo exportar la lista de precios.");
        return;
      }
      if (res.data.filas.length === 0) {
        toast.error("Ningún producto coincide con los filtros.");
        return;
      }
      descargarExcelListaPrecios(res.data.filas);
      const n = res.data.filas.length;
      toast.success(
        n === 1
          ? "Excel exportado: 1 producto."
          : `Excel exportado: ${n.toLocaleString("es-AR")} productos.`
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error inesperado al exportar la lista de precios."
      );
    } finally {
      setExportando(false);
    }
  }

  return (
    <ToolbarActionButton
      type="button"
      label="Exp. Lista"
      icon={<Upload aria-hidden />}
      loading={exportando}
      loadingLabel="Exportando…"
      disabled={!snapshot.hasFilterActive || exportando}
      onClick={() => void handleExportar()}
    />
  );
}
