"use client";

import { useMemo, useState } from "react";
import ModalTablaConFiltros, {
  type ColumnaModalTabla,
} from "@/components/shared/ModalTablaConFiltros";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { matchByMultiTerm } from "@/lib/busqueda";
import { fmtCelda } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import type { DescPromoOpcionProductoUi } from "@/components/desc-promos/CrearEditarDescPromoModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: DescPromoOpcionProductoUi[];
  codigosSeleccionados: string[];
  onConfirm: (productos: DescPromoOpcionProductoUi[]) => void;
}

const COLUMNAS: ColumnaModalTabla<DescPromoOpcionProductoUi>[] = [
  {
    key: "descripcion",
    label: "DESCRIPCIÓN",
    className: "min-w-0",
    render: (row) => (
      <span className="block truncate" title={row.descripcion || row.codTienda}>
        {fmtCelda(row.descripcion || row.codTienda)}
      </span>
    ),
  },
];

export default function DescPromoAgregarProductosModal({
  open,
  onOpenChange,
  productos,
  codigosSeleccionados,
  onConfirm,
}: Props) {
  const [qDebounced, setQDebounced] = useState("");
  const { q, handleQChange, isDebouncing, ref } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });

  const filas = useMemo(() => {
    const ya = new Set(codigosSeleccionados);
    const disponibles = productos.filter((p) => !ya.has(p.codTienda));
    if (!qDebounced.trim()) return disponibles;
    return disponibles.filter((p) =>
      matchByMultiTerm([p.descripcion, p.codTienda], qDebounced)
    );
  }, [productos, codigosSeleccionados, qDebounced]);

  const porCodigo = useMemo(() => {
    const map = new Map<string, DescPromoOpcionProductoUi>();
    for (const p of productos) map.set(p.codTienda, p);
    return map;
  }, [productos]);

  return (
    <ModalTablaConFiltros<DescPromoOpcionProductoUi>
      open={open}
      onClose={() => onOpenChange(false)}
      title="AGREGAR PRODUCTOS"
      selectionMode="multi"
      rows={filas}
      getRowId={(row) => row.codTienda}
      columns={COLUMNAS}
      tableColumnWidthsPct={[5, 95]}
      emptyMessage="NO HAY PRODUCTOS."
      confirmLabel={(count) =>
        count === 1 ? "Agregar 1 Producto" : `Agregar ${count} Productos`
      }
      onConfirm={(ids) => {
        const elegidos: DescPromoOpcionProductoUi[] = [];
        for (const id of ids) {
          const row = porCodigo.get(id);
          if (row) elegidos.push(row);
        }
        onConfirm(elegidos);
      }}
      filterContent={
        <FiltroBusquedaInput
          id="desc-promo-agregar-productos-q"
          placeholder="DESCRIPCIÓN"
          value={q}
          onChange={(value) => {
            handleQChange(value);
            if (value.trim() === "") setQDebounced("");
          }}
          isDebouncing={isDebouncing}
          inputRef={ref}
        />
      }
    />
  );
}
