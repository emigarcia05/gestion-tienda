"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ModalTablaConFiltros, { type ColumnaModalTabla } from "@/components/shared/ModalTablaConFiltros";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  agregarProductoComparacionAction,
  buscarProductosParaComparacionAction,
} from "@/actions/comparacionCompetencia";
import type { ProductoTiendaParaComparacionRow } from "@/services/comparacionCompetencia.service";
import { toast } from "sonner";

const EMPTY: { items: ProductoTiendaParaComparacionRow[]; total: number } = {
  items: [],
  total: 0,
};

/** CHECK + MARCA + DESCRIPCIÓN */
const COLUMN_WIDTHS_PCT = [5, 20, 75] as const;

/** Antes `!max-w-[105rem]` (84rem × 1,25). 25 % más angosto. */
const MODAL_AGREGAR_PRODUCTO_COMPARACION_MAX_WIDTH = "!max-w-[78.75rem]";

export default function AgregarProductoComparacionModal({
  open,
  onOpenChange,
  onAgregado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgregado: () => void;
}) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetch = useCallback(async (q: string) => {
    setLoading(true);
    setErrorMsg(null);
    const res = await buscarProductosParaComparacionAction({ q, take: 100 });
    if (!res.ok) {
      setLoading(false);
      setData(EMPTY);
      setErrorMsg(res.error ?? "Error al buscar productos.");
      return;
    }
    setData({ items: res.data.items, total: res.data.total });
    setLoading(false);
  }, []);

  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      if (!open) return;
      void fetch(value);
    },
  });

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setQ("");
      setData(EMPTY);
      setErrorMsg(null);
      void fetch("");
    });
  }, [open, fetch, setQ]);

  const columns: ColumnaModalTabla<ProductoTiendaParaComparacionRow>[] = useMemo(
    () => [
      {
        key: "marca",
        label: "MARCA",
        className: "py-2 px-3 text-xs",
        render: (r) => r.marca ?? "—",
      },
      {
        key: "descripcionTienda",
        label: "DESCRIPCIÓN",
        className: "py-2 px-3 text-xs",
        render: (r) => (
          <span className="block truncate" title={r.descripcionTienda}>
            {r.descripcionTienda}
          </span>
        ),
      },
    ],
    []
  );

  async function agregarProducto(row: ProductoTiendaParaComparacionRow) {
    setConfirmPending(true);
    try {
      const res = await agregarProductoComparacionAction({ codTienda: row.codTienda });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo agregar el producto.");
        throw new Error(res.error ?? "Error");
      }
      toast.success("Producto agregado a comparación.");
      onAgregado();
    } finally {
      setConfirmPending(false);
    }
  }

  const filterContent = (
    <div className="flex flex-col gap-2">
      <FiltroBusquedaInput
        id="agregar-producto-comparacion-filtro"
        placeholder="BUSCAR POR DESCRIPCIÓN, CÓDIGO, MARCA O RUBRO..."
        value={q}
        onChange={handleQChange}
        isDebouncing={isDebouncing}
        inputRef={ref}
      />
      {errorMsg ? <span className="text-xs text-destructive">{errorMsg}</span> : null}
    </div>
  );

  return (
    <ModalTablaConFiltros<ProductoTiendaParaComparacionRow>
      open={open}
      onClose={() => onOpenChange(false)}
      title="Agregar Producto A Comparación"
      contentClassName={MODAL_AGREGAR_PRODUCTO_COMPARACION_MAX_WIDTH}
      selectionMode="singleConfirm"
      showSingleConfirmCheckbox
      confirmSingleLabel="Agregar Producto"
      confirmPending={confirmPending}
      filterContent={filterContent}
      tableColumnWidthsPct={COLUMN_WIDTHS_PCT}
      columns={columns}
      rows={data.items}
      count={data.total}
      loading={loading}
      emptyMessage="Sin Productos Disponibles"
      getRowId={(r) => r.id}
      onConfirmSingle={agregarProducto}
      onRowDoubleClick={(row) => void agregarProducto(row)}
    />
  );
}
