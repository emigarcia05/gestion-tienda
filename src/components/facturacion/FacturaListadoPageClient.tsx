"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  consultarFacturaComprobanteArcaAction,
  emitirNotaCreditoFacturaAction,
  obtenerFacturaComprobantePdfAction,
} from "@/actions/factura";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FilterRowSearch,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { Button } from "@/components/ui/button";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FACTURA_TIPO_LABELS,
  esFacturaTipoFiscal,
  type FacturaComprobanteListItem,
} from "@/lib/factura";
import { imprimirPdfFacturaComprobante } from "@/lib/facturaComprobantePdfClient";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtPrecio } from "@/lib/format";
import { matchByMultiTerm } from "@/lib/busqueda";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type Props = {
  items: FacturaComprobanteListItem[];
  variant: "facturas" | "presupuestos";
};

export default function FacturaListadoPageClient({
  items,
  variant,
}: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } =
    useFiltrosConBusqueda({
      qActual: qDebounced,
      debounceMs: 300,
      onDebouncedSearch: setQDebounced,
    });
  const [busyId, setBusyId] = useState<string | null>(null);

  const itemsFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [
          item.cliente,
          item.nroComprobante,
          item.cae ?? "",
          FACTURA_TIPO_LABELS[item.tipo],
          item.letra ?? "",
        ],
        qDebounced
      )
    );
  }, [items, qDebounced]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
  }

  async function handlePdf(id: string) {
    setBusyId(id);
    try {
      const res = await obtenerFacturaComprobantePdfAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await imprimirPdfFacturaComprobante(res.data);
    } finally {
      setBusyId(null);
    }
  }

  async function handleNc(id: string) {
    setBusyId(id);
    try {
      const res = await emitirNotaCreditoFacturaAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.cae ? `NC CAE ${res.data.cae}` : "Nota de crédito emitida.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleConsultar(id: string) {
    setBusyId(id);
    try {
      const res = await consultarFacturaComprobanteArcaAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.cae ? `CAE ${res.data.cae}` : "Consulta ARCA ok.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const esFacturas = variant === "facturas";
  const colSpan = esFacturas ? 8 : 5;

  return (
    <ClassicFilteredTableLayout
      title="FACTURA"
      subtitle={esFacturas ? "Facturas" : "Presupuestos"}
      contentWidth="full"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <div className="flex items-center gap-3">
            <FilterRowSearch className="flex-1">
              <FiltroBusquedaInput
                id={
                  esFacturas
                    ? "filtro-facturas-busqueda"
                    : "filtro-presupuestos-busqueda"
                }
                placeholder="BUSCAR POR CLIENTE, N°, CAE…"
                value={q}
                onChange={handleQChange}
                isDebouncing={isDebouncing}
                inputRef={searchRef}
              />
            </FilterRowSearch>
            <LimpiarFiltrosButton onClick={limpiarFiltros} />
            <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
              {itemsFiltrados.length.toLocaleString("es-AR")} REGISTRO
              {itemsFiltrados.length === 1 ? "" : "S"}
            </span>
          </div>
        </FilterBar>
      }
    >
      <div className="contenedor-tabla-gestion min-h-0 flex-1">
        <Table variant="compact" className="tabla-gestion-compacta w-full">
          <TableHeader>
            <TableRow>
              <TableHead>FECHA</TableHead>
              {esFacturas ? <TableHead>TIPO</TableHead> : null}
              {esFacturas ? <TableHead className="text-center">LETRA</TableHead> : null}
              <TableHead>N°</TableHead>
              <TableHead>CLIENTE</TableHead>
              <TableHead className="text-right">TOTAL</TableHead>
              {esFacturas ? <TableHead>CAE</TableHead> : null}
              <TableHead className="tabla-bloque-secundario-head-divider text-center">
                ACCIONES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsFiltrados.length === 0 ? (
              <EmptyTableRow
                colSpan={colSpan}
                message={
                  items.length === 0
                    ? "No hay comprobantes."
                    : "No hay registros con los filtros aplicados."
                }
              />
            ) : (
              itemsFiltrados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="tabular-nums">
                    {formatIsoYmdDdMmYyyyArgentina(item.fechaIso)}
                  </TableCell>
                  {esFacturas ? (
                    <TableCell>{FACTURA_TIPO_LABELS[item.tipo]}</TableCell>
                  ) : null}
                  {esFacturas ? (
                    <TableCell className="text-center">{item.letra ?? "—"}</TableCell>
                  ) : null}
                  <TableCell className="tabular-nums">
                    {item.nroComprobante || "—"}
                  </TableCell>
                  <TableCell className="uppercase">{item.cliente}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtPrecio(item.impTotal)}
                  </TableCell>
                  {esFacturas ? (
                    <TableCell className="tabular-nums">{item.cae ?? "—"}</TableCell>
                  ) : null}
                  <TableCell className="tabla-bloque-secundario-cell-divider">
                    <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="PDF"
                        aria-label={`PDF ${item.nroComprobante}`}
                        disabled={busyId === item.id}
                        onClick={() => void handlePdf(item.id)}
                      >
                        <FileText className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      {esFacturas && item.puedeNc ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Nota de crédito"
                          aria-label={`Nota de crédito ${item.nroComprobante}`}
                          disabled={busyId === item.id}
                          onClick={() => void handleNc(item.id)}
                        >
                          <Undo2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      ) : null}
                      {esFacturas &&
                      esFacturaTipoFiscal(item.tipo) &&
                      !item.cae ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Consultar ARCA"
                          aria-label={`Consultar ARCA ${item.nroComprobante}`}
                          disabled={busyId === item.id}
                          onClick={() => void handleConsultar(item.id)}
                        >
                          <RefreshCw className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ClassicFilteredTableLayout>
  );
}
