"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  listarPendientesTransfDepositosAction,
  listarSucursalesTransfDepositosAction,
  marcarTransferidoTransfDepositosAction,
  type PendienteTransfDepositoItemDto,
  type Sucursal,
  type SucursalTransfDepositoOptionDto,
} from "@/actions/stock";
import { fmtNumero } from "@/lib/format";
import { enfocarDuxTransferenciaDepositosTab } from "@/lib/transfDepositosControl";
import {
  TablaControlItemCelda,
  TablaControlItemHead,
} from "@/components/shared/TablaControlItem";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Código de sucursal del usuario (origen de las filas). */
  origenCodigo: Sucursal | null;
  /** Destino de la página (si hay): precarga el lote pendiente en la tabla. */
  destinoCodigo: Sucursal | null;
  onTransferido?: () => void;
}

const BOTON_COPIAR_CELDA_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
);

async function copiarDatoTransf(texto: string, toastTitle: string): Promise<void> {
  const t = texto.trim();
  if (t === "") return;
  try {
    await navigator.clipboard.writeText(t);
    toast.success(toastTitle, { description: t });
    enfocarDuxTransferenciaDepositosTab();
  } catch {
    toast.error("No se pudo copiar.");
  }
}

/**
 * Modal **Generar Transf.**: dos selectores **SUC. ORIGEN** (sucursal del usuario)
 * y **SUC. DESTINO** (`sucursales` distintas, con `deposito` no vacío);
 * al abrir, si la página ya tiene destino, precarga el lote pendiente en la tabla
 * (reabrir el modal sin haber pulsado Transferido muestra los mismos ítems);
 * al elegir destino abre (o enfoca) transferencia de depósitos en DUX;
 * tabla Control de ítem / COD. TIENDA (**OK** a la izquierda del código) / DESCRIPCIÓN / CANTIDAD (copiar a la derecha);
 * cada copiar (y OK) enfoca la pestaña DUX ya abierta sin recargar;
 * checklist local hasta **Transferido**, que borra el lote.
 * Cabecera del modal (selectores) y `thead` fijos; scroll solo en `.contenedor-tabla-gestion`.
 */
export default function GenerarTransfDepositosModal({
  open,
  onOpenChange,
  origenCodigo,
  destinoCodigo,
  onTransferido,
}: Props) {
  const [sucursales, setSucursales] = useState<SucursalTransfDepositoOptionDto[]>(
    []
  );
  const [sucOrigenId, setSucOrigenId] = useState<string | null>(null);
  const [sucDestinoId, setSucDestinoId] = useState<string | null>(null);
  const [items, setItems] = useState<PendienteTransfDepositoItemDto[]>([]);
  const [okPorCodTienda, setOkPorCodTienda] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const origenes = useMemo(() => {
    return sucursales.filter(
      (s) => s.tieneDeposito || s.codigo === origenCodigo
    );
  }, [sucursales, origenCodigo]);

  const destinos = useMemo(
    () =>
      sucursales.filter((s) => s.tieneDeposito && s.id !== sucOrigenId),
    [sucursales, sucOrigenId]
  );

  const cargarItems = useCallback(
    async (origenId: string, destinoId: string) => {
      const res = await listarPendientesTransfDepositosAction({
        sucOrigenId: origenId,
        sucDestinoId: destinoId,
      });
      if (!res.ok) {
        setError(res.error);
        setItems([]);
        setOkPorCodTienda({});
        return;
      }
      setError(null);
      setItems(res.data);
      setOkPorCodTienda({});
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      setItems([]);
      setOkPorCodTienda({});
      setSucOrigenId(null);
      setSucDestinoId(null);
    });

    (async () => {
      const res = await listarSucursalesTransfDepositosAction();
      if (cancelled) return;
      if (!res.ok) {
        setLoading(false);
        setError(res.error);
        return;
      }
      setSucursales(res.data);
      const origen = origenCodigo
        ? res.data.find((s) => s.codigo === origenCodigo)
        : undefined;
      if (!origen) {
        setLoading(false);
        setError("Sucursal origen no encontrada.");
        return;
      }
      setSucOrigenId(origen.id);

      const destino =
        destinoCodigo && destinoCodigo !== origenCodigo
          ? res.data.find(
              (s) =>
                s.codigo === destinoCodigo &&
                s.tieneDeposito &&
                s.id !== origen.id
            )
          : undefined;
      if (destino) {
        setSucDestinoId(destino.id);
        await cargarItems(origen.id, destino.id);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, origenCodigo, destinoCodigo, cargarItems]);

  function handleOrigenChange(value: string) {
    const next = value === "none" ? null : value;
    setSucOrigenId(next);
    setSucDestinoId(null);
    setItems([]);
    setOkPorCodTienda({});
    setError(null);
  }

  function handleDestinoChange(value: string) {
    const next = value === "none" ? null : value;
    setSucDestinoId(next);
    if (!sucOrigenId || !next) {
      setItems([]);
      setOkPorCodTienda({});
      setError(null);
      return;
    }
    enfocarDuxTransferenciaDepositosTab();
    setLoading(true);
    startTransition(async () => {
      await cargarItems(sucOrigenId, next);
      setLoading(false);
    });
  }

  async function handleOkItem(codTienda: string) {
    if (okPorCodTienda[codTienda] === true) {
      setOkPorCodTienda((prev) => ({ ...prev, [codTienda]: false }));
      return;
    }
    try {
      await navigator.clipboard.writeText(codTienda);
    } catch {
      toast.error("No se pudo copiar el código de tienda.");
      return;
    }
    setOkPorCodTienda((prev) => ({ ...prev, [codTienda]: true }));
    toast.success("Cod. Tienda Copiado", { description: codTienda });
    enfocarDuxTransferenciaDepositosTab();
  }

  const todosOk =
    items.length > 0 && items.every((item) => okPorCodTienda[item.codTienda] === true);
  const puedeMarcar =
    sucOrigenId !== null &&
    sucDestinoId !== null &&
    todosOk &&
    !loading;

  function handleTransferido() {
    if (
      !sucOrigenId ||
      !sucDestinoId ||
      items.length === 0 ||
      !todosOk
    ) {
      return;
    }
    startTransition(async () => {
      const res = await marcarTransferidoTransfDepositosAction({
        sucOrigenId,
        sucDestinoId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${res.data.borrados} transferencia${res.data.borrados !== 1 ? "s" : ""} marcada${res.data.borrados !== 1 ? "s" : ""} como transferida${res.data.borrados !== 1 ? "s" : ""}.`
      );
      setItems([]);
      setOkPorCodTienda({});
      onTransferido?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="xl"
        className="h-[85vh] max-h-[85vh] max-w-[54rem]"
        title="Generar Transf."
        scrollBody={false}
        bodyClassName="flex min-h-0 flex-1 flex-col gap-4"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={handleTransferido}
              disabled={!puedeMarcar || isPending}
              className="disabled:cursor-not-allowed"
              title={
                puedeMarcar
                  ? "Borrar el lote de esta transferencia"
                  : "Marcá todos los ítems con OK"
              }
            >
              Transferido
            </Button>
          </>
        }
      >
        <div className="flex shrink-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel align="center">SUC. ORIGEN</ModalMicroLabel>
              <Select
                value={sucOrigenId ?? "none"}
                onValueChange={handleOrigenChange}
                disabled={isPending}
              >
                <SelectTrigger
                  id="filtro-transf-origen-modal"
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Sucursal origen"
                >
                  <SelectValue placeholder="SUC. ORIGEN" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="none">SUC. ORIGEN</SelectItem>
                  {origenes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel align="center">SUC. DESTINO</ModalMicroLabel>
              <Select
                value={sucDestinoId ?? "none"}
                onValueChange={handleDestinoChange}
                disabled={!sucOrigenId || isPending}
              >
                <SelectTrigger
                  id="filtro-transf-destino-modal"
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Sucursal destino"
                >
                  <SelectValue placeholder="SUC. DESTINO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="none">SUC. DESTINO</SelectItem>
                  {destinos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div
          className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1"
          style={{ height: "auto" }}
        >
          {loading ? (
            <p className="text-sm text-foreground py-6 text-center">Cargando…</p>
          ) : null}

          {!loading && error ? (
            <p className="text-sm text-destructive py-6 text-center">{error}</p>
          ) : null}

          {!loading && !error && sucDestinoId === null ? (
            <p className="text-sm text-foreground py-6 text-center">
              Seleccioná una sucursal destino.
            </p>
          ) : null}

          {!loading &&
          !error &&
          sucDestinoId !== null &&
          items.length === 0 ? (
            <p className="text-sm text-foreground py-6 text-center">
              No hay transferencias pendientes hacia esta sucursal.
            </p>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <Table
              variant="compact"
              className="tabla-recepcion-pedido"
              scrollX={false}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TablaControlItemHead className="w-[8%] min-w-12" />
                  <TableHead className="w-[26%]">COD. TIENDA</TableHead>
                  <TableHead className="w-[50%]">DESCRIPCIÓN</TableHead>
                  <TableHead className="w-[16%] text-center">
                    CANTIDAD A TRANSFERIR
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const ok = okPorCodTienda[item.codTienda] === true;
                  return (
                    <TableRow
                      key={item.codTienda}
                      className={cn(
                        "transition-colors duration-100",
                        ok ? "recepcion-fila-verificada" : "recepcion-fila-pendiente"
                      )}
                    >
                      <TablaControlItemCelda
                        verificado={ok}
                        placeholderTitle="Verificá con OK: copia el Cod. Tienda y marca el ítem."
                        className="w-[8%] min-w-12"
                      />
                      <TableCell className="celda-datos w-[26%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleOkItem(item.codTienda)}
                            disabled={isPending}
                            className={BOTON_COPIAR_CELDA_CLASS}
                            aria-label={
                              ok
                                ? "Desmarcar ítem"
                                : "OK, copiar código de tienda"
                            }
                            title={
                              ok ? "Desmarcar ítem" : "OK — copiar Cod. Tienda"
                            }
                          >
                            <Check
                              className={TABLE_ROW_ACTION_ICON_CLASS}
                              aria-hidden
                            />
                          </Button>
                          <span className="tabular-nums">{item.codTienda}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="celda-datos min-w-0 w-[50%] truncate"
                        title={item.descripcionTienda}
                      >
                        {item.descripcionTienda}
                      </TableCell>
                      <TableCell className="celda-datos w-[16%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="tabular-nums">
                            {fmtNumero(item.cantidad)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              void copiarDatoTransf(
                                String(Math.round(item.cantidad)),
                                "Cant. Copiada"
                              )
                            }
                            disabled={isPending}
                            className={BOTON_COPIAR_CELDA_CLASS}
                            aria-label="Copiar cantidad"
                            title="Copiar cantidad"
                          >
                            <Copy
                              className={TABLE_ROW_ACTION_ICON_CLASS}
                              aria-hidden
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
