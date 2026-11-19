"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ModalTablaConFiltros, { type ColumnaModalTabla } from "@/components/shared/ModalTablaConFiltros";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { FiltroIndividualContainer } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarProductosTiendaPorDescripcionAction } from "@/actions/productosTienda";
import type { ProductoTiendaRowBusqueda } from "@/services/productosTienda.service";
import { Check } from "lucide-react";
import { toast } from "sonner";

const EMPTY: { items: ProductoTiendaRowBusqueda[]; total: number } = { items: [], total: 0 };

function parseCantRecibidaDraft(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || t === "-") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i === 0 ? null : i;
}

function parseCantidadVario(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) return null;
  return n;
}

function sanitizeEnteroConSignoInput(raw: string, maxDigits = 6): string {
  const t = raw.replace(/[^\d-]/g, "");
  const neg = t.startsWith("-");
  const digits = t.replace(/-/g, "").slice(0, maxDigits);
  if (neg) return digits === "" ? "-" : `-${digits}`;
  return digits;
}

export default function AgregarProductosModal({
  open,
  onOpenChange,
  onAgregar,
  onAgregarVario,
  initialBusqueda = "",
  proveedorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgregar: (row: ProductoTiendaRowBusqueda, cantRecibida: number) => Promise<void> | void;
  /**
   * Recepción de Compra: alta descriptiva. No mueve stock.
   * Si no viene, la fila no se muestra (p. ej. transferencia).
   */
  onAgregarVario?: (descripcion: string, cantidad: number) => Promise<void> | void;
  initialBusqueda?: string;
  /** Recepción de Compra: solo ítems vinculados a este proveedor. */
  proveedorId?: string;
}) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cantRecibida, setCantRecibida] = useState<string>("");
  const [descVario, setDescVario] = useState("");
  const [cantVario, setCantVario] = useState("");

  const fetch = useCallback(
    async (q: string) => {
      setLoading(true);
      setErrorMsg(null);
      const res = await buscarProductosTiendaPorDescripcionAction({
        q,
        take: 100,
        ...(proveedorId ? { proveedorId } : {}),
      });
      if (!res.ok) {
        setLoading(false);
        setData(EMPTY);
        setErrorMsg(res.error ?? "Error al buscar productos.");
        return;
      }
      setData({ items: res.data.items, total: res.data.total });
      setLoading(false);
    },
    [proveedorId]
  );

  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: initialBusqueda,
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      if (!open) return;
      void fetch(value);
    },
  });

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setData(EMPTY);
      setErrorMsg(null);
      setCantRecibida("");
      setDescVario("");
      setCantVario("");
      setQ(initialBusqueda);
      void fetch(initialBusqueda);
    });
  }, [open, fetch, initialBusqueda, setQ]);

  const columns: ColumnaModalTabla<ProductoTiendaRowBusqueda>[] = useMemo(
    () => [
      {
        key: "descripcionTienda",
        label: "DESCRIPCIÓN TIENDA",
        className: "py-2 px-3 text-xs",
        render: (r) => r.descripcionTienda,
      },
    ],
    []
  );

  const cantRecibidaValida = parseCantRecibidaDraft(cantRecibida) != null;
  const descVarioLimpia = descVario.trim();
  const cantVarioNum = parseCantidadVario(cantVario);
  const varioValido = descVarioLimpia.length > 0 && cantVarioNum != null;

  async function confirmarVario() {
    if (!onAgregarVario || !varioValido || cantVarioNum == null) {
      toast.error("Completá la descripción y una cantidad entera mayor a 0.");
      return;
    }
    await onAgregarVario(descVarioLimpia.slice(0, 500), cantVarioNum);
  }

  const filterContent = (
    <div className="flex w-full flex-col gap-2">
      {onAgregarVario ? (
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_10rem_2.5rem] items-center gap-2">
          <span className="shrink-0 text-sm font-semibold text-foreground">PROD. VARIO</span>
          <Input
            id="agregar-productos-vario-descripcion"
            placeholder="DESCRIPCION ITEM"
            aria-label="Descripción del ítem vario"
            value={descVario}
            maxLength={500}
            onChange={(e) => setDescVario(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmarVario();
              }
            }}
            className="h-10 w-full min-w-0 input-filtro-unificado"
          />
          <Input
            type="text"
            inputMode="numeric"
            placeholder="CANTIDAD"
            aria-label="Cantidad del ítem vario"
            value={cantVario}
            onChange={(e) => setCantVario(e.target.value.replace(/\D/g, "").slice(0, 7))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmarVario();
              }
            }}
            className="h-10 w-full min-w-0 text-center tabular-nums input-filtro-unificado"
          />
          <Button
            type="button"
            variant="default"
            size="icon-lg"
            aria-label="Agregar producto vario"
            disabled={!varioValido}
            onClick={() => void confirmarVario()}
          >
            <Check aria-hidden />
          </Button>
        </div>
      ) : null}
      <div className="grid w-full grid-cols-[1fr_10rem] items-center gap-2">
        <div className="min-w-0">
          <FiltroBusquedaInput
            id="agregar-productos-filtro"
            placeholder="BUSCAR POR DESCRIPCIÓN..."
            value={q}
            onChange={handleQChange}
            isDebouncing={isDebouncing || loading}
            inputRef={ref}
          />
        </div>
        <FiltroIndividualContainer
          className="min-w-0 w-full"
          activo={!!cantRecibida.trim()}
          onLimpiar={() => setCantRecibida("")}
        >
          <Input
            type="text"
            inputMode="numeric"
            placeholder="CANT."
            aria-label="Cant. Recibida (nuevo ítem)"
            value={cantRecibida}
            onChange={(e) => setCantRecibida(sanitizeEnteroConSignoInput(e.target.value))}
            className="h-10 w-full min-w-0 text-center tabular-nums input-filtro-unificado"
          />
        </FiltroIndividualContainer>
      </div>
      {errorMsg && <span className="text-xs text-destructive">{errorMsg}</span>}
    </div>
  );

  return (
    <ModalTablaConFiltros<ProductoTiendaRowBusqueda>
      open={open}
      onClose={() => onOpenChange(false)}
      title="Agregar Productos"
      subtitle={undefined}
      filterContent={filterContent}
      columns={columns}
      rows={data.items}
      getRowId={(r) => r.id}
      loading={loading}
      emptyMessage="SIN RESULTADOS"
      count={data.total}
      selectionMode="singleConfirm"
      showSingleConfirmCheckbox
      confirmSingleLabel="AGREGAR PRODUCTO"
      confirmSingleDisabled={!cantRecibidaValida}
      onConfirmSingle={async (row) => {
        const cant = parseCantRecibidaDraft(cantRecibida);
        if (cant == null) {
          toast.error("Ingresá una Cant. Recibida distinta de 0.");
          throw new Error("Cantidad inválida");
        }
        await onAgregar(row, cant);
      }}
      onRowDoubleClick={undefined}
    />
  );
}

