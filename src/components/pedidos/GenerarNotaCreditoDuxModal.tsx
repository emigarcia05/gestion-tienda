"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ProcesoPaso from "@/components/shared/ProcesoPaso";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { formatIsoYmdDdMmYyArgentina } from "@/lib/fechaArgentina";
import { fmtNumero } from "@/lib/format";
import { montoArSignedCentsToDisplayWithCurrency } from "@/lib/montoArMask";
import {
  obtenerSiguienteNumeroNotaCreditoAction,
  reservarSiguienteNumeroNotaCreditoAction,
} from "@/actions/pedidosHistoria";
import {
  TablaControlItemCelda,
  TablaControlItemHead,
} from "@/components/shared/TablaControlItem";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { enfocarDuxNotaCreditoTab } from "@/lib/notaCreditoDux";
import { cn } from "@/lib/utils";

export type NotaCreditoDuxItem = {
  id: string;
  codTienda: string;
  descripcionTienda: string;
  cant: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NotaCreditoDuxItem[];
  /** TOTAL PEDIDO de la NC (normalizado, admite negativo). */
  totalNc: number;
  proveedorNombre: string;
  /** FECHA FACTURA del paso anterior (`YYYY-MM-DD`). */
  fechaFacturaIso: string;
  onNotaGenerada?: () => void;
}

async function copiarDatoNc(texto: string, toastTitle: string): Promise<void> {
  const t = texto.trim();
  if (t === "") return;
  try {
    await navigator.clipboard.writeText(t);
    toast.success(toastTitle, { description: t });
    enfocarDuxNotaCreditoTab();
  } catch {
    toast.error("No se pudo copiar.");
  }
}

function DatoNcCopiable({
  label,
  value,
  toastTitle,
  ariaLabelCopiar,
  stacked = true,
}: {
  label: string;
  value: string;
  toastTitle: string;
  ariaLabelCopiar: string;
  /** `true`: label arriba, valor + copiar abajo. `false`: label a la izquierda (pie). */
  stacked?: boolean;
}) {
  const vacio = value.trim() === "";
  const copiar = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
        "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
      )}
      aria-label={ariaLabelCopiar}
      title={ariaLabelCopiar}
      disabled={vacio}
      onClick={() => void copiarDatoNc(value, toastTitle)}
    >
      <Copy className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
    </Button>
  );
  const valor = (
    <p className="min-w-0 truncate text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
      {value}
    </p>
  );

  if (stacked) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        {label.trim() === "" ? null : <ModalMicroLabel>{label}</ModalMicroLabel>}
        <div className="flex min-w-0 items-center justify-between gap-2">
          {valor}
          {copiar}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      {label.trim() === "" ? null : <ModalMicroLabel>{label}</ModalMicroLabel>}
      <div className="flex min-w-0 items-center justify-end gap-2 shrink-0">
        {valor}
        {copiar}
      </div>
    </div>
  );
}

/**
 * Checklist DUX de NC: 4 `ProcesoPaso` en una pantalla (`tituloLado="izquierda"`).
 * **OK** (a la izquierda de COD. TIENDA) copia `cod_tienda`; copiar a la derecha de CANT. pega la cantidad (entero);
 * cada copiar enfoca la pestaña DUX ya abierta (`DUX_NOTA_CREDITO_WINDOW_NAME`, sin recargar);
 * **Nota Generada** exige todos TRUE y reserva `prod_ped_ult_comp` id=3 (`X-00000-########`).
 */
export default function GenerarNotaCreditoDuxModal({
  open,
  onOpenChange,
  items,
  totalNc,
  proveedorNombre,
  fechaFacturaIso,
  onNotaGenerada,
}: Props) {
  const [okPorItemId, setOkPorItemId] = useState<Record<string, boolean>>({});
  const [numeroNc, setNumeroNc] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      setOkPorItemId({});
      setNumeroNc("");
    });
    void (async () => {
      const res = await obtenerSiguienteNumeroNotaCreditoAction();
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error ?? "Error al leer el correlativo de nota de crédito.");
        return;
      }
      setNumeroNc(res.data.numero);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  async function handleOkItem(item: NotaCreditoDuxItem) {
    if (okPorItemId[item.id] === true) {
      setOkPorItemId((prev) => ({ ...prev, [item.id]: false }));
      return;
    }
    try {
      await navigator.clipboard.writeText(item.codTienda);
    } catch {
      toast.error("No se pudo copiar el código de tienda.");
      return;
    }
    setOkPorItemId((prev) => ({ ...prev, [item.id]: true }));
    toast.success("Cod. Tienda Copiado", { description: item.codTienda });
    enfocarDuxNotaCreditoTab();
  }

  const todosOk =
    items.length > 0 && items.every((item) => okPorItemId[item.id] === true);

  const fechaDisplay = useMemo(() => {
    const iso = fechaFacturaIso.trim();
    if (iso === "") return "";
    return formatIsoYmdDdMmYyArgentina(iso);
  }, [fechaFacturaIso]);

  const precioUnitarioDisplay = useMemo(() => {
    const sumaCant = items.reduce((acc, it) => acc + it.cant, 0);
    if (
      sumaCant === 0 ||
      !Number.isFinite(sumaCant) ||
      !Number.isFinite(totalNc)
    ) {
      return "";
    }
    const unitario = totalNc / sumaCant;
    if (!Number.isFinite(unitario)) return "";
    return montoArSignedCentsToDisplayWithCurrency(Math.round(unitario * 100));
  }, [items, totalNc]);

  function handleNotaGenerada() {
    if (!todosOk || isPending) return;
    startTransition(async () => {
      const res = await reservarSiguienteNumeroNotaCreditoAction();
      if (!res.ok) {
        toast.error(res.error ?? "Error al asignar el correlativo de nota de crédito.");
        return;
      }
      const numero = res.data.numero;
      setNumeroNc(numero);
      try {
        await navigator.clipboard.writeText(numero);
        toast.success("Nota Generada", { description: numero });
        enfocarDuxNotaCreditoTab();
      } catch {
        toast.success("Nota Generada", {
          description: `${numero} (no se pudo copiar)`,
        });
      }
      onNotaGenerada?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        size="xl"
        className="h-[95vh] max-h-[95vh] max-w-[66rem]"
        title="Generar Nota Crédito"
        scrollBody={false}
        bodyShellClassName="h-full min-h-0"
        bodyClassName="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden"
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
              onClick={handleNotaGenerada}
              disabled={!todosOk || isPending}
              className="disabled:cursor-not-allowed"
              title={
                todosOk
                  ? "Cerrar el asistente de nota de crédito"
                  : "Marcá todos los ítems con OK"
              }
            >
              Nota Generada
            </Button>
          </>
        }
      >
        <ProcesoPaso
          numero={1}
          titulo="Completar Cabecera"
          activo
          tituloLado="izquierda"
          className="shrink-0 p-3"
        >
            <div className="grid grid-cols-3 gap-3">
              <DatoNcCopiable
                label="PROVEEDOR"
                value={proveedorNombre}
                toastTitle="Proveedor Copiado"
                ariaLabelCopiar="Copiar proveedor"
              />
              <DatoNcCopiable
                label="Nº COMPROBANTE"
                value={numeroNc}
                toastTitle="Nº Comprobante Copiado"
                ariaLabelCopiar="Copiar número de comprobante"
              />
              <DatoNcCopiable
                label="FECHA"
                value={fechaDisplay}
                toastTitle="Fecha Copiada"
                ariaLabelCopiar="Copiar fecha"
              />
            </div>
        </ProcesoPaso>

        <ProcesoPaso
          numero={2}
          titulo="Completar Detalles"
          activo
          tituloLado="izquierda"
          className="min-h-0 flex-1 overflow-hidden p-3"
        >
            <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
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
                <TableHead className="w-[16%] text-center">CANT.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <EmptyTableRow colSpan={4} message="SIN ÍTEMS." />
              ) : (
                items.map((item) => {
                  const ok = okPorItemId[item.id] === true;
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "transition-colors duration-100",
                        ok
                          ? "recepcion-fila-verificada"
                          : "recepcion-fila-activa"
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
                            onClick={() => void handleOkItem(item)}
                            className={cn(
                              TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                              "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
                            )}
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
                          <span className="tabular-nums">{fmtNumero(item.cant)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              void copiarDatoNc(
                                String(Math.round(item.cant)),
                                "Cant. Copiada"
                              )
                            }
                            className={cn(
                              TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                              "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
                            )}
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
                })
              )}
            </TableBody>
          </Table>
            </div>
        </ProcesoPaso>

        <ProcesoPaso
          numero={3}
          titulo="Px. Unitario"
          activo
          tituloLado="izquierda"
          className="shrink-0 p-3"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className={cn("min-w-0 text-sm text-foreground")}>
              En todos los item, completar este monto en la columna{" "}
              <strong className="font-semibold">Precio Unitario</strong> Con IVA
            </p>
            <DatoNcCopiable
              stacked={false}
              label=""
              value={precioUnitarioDisplay}
              toastTitle="Px. Unitario Copiado"
              ariaLabelCopiar="Copiar precio unitario"
            />
          </div>
        </ProcesoPaso>

        <ProcesoPaso
          numero={4}
          titulo="Finalizar"
          activo
          tituloLado="izquierda"
          className="shrink-0 p-3"
        >
            <p className={cn("text-sm text-foreground text-center")}>
              En la sección{" "}
              <strong className="font-semibold">Percepciones / Impuestos</strong>,
              no se debe tocar nada
            </p>
            <p className={cn("text-sm text-foreground text-center")}>
              <strong className="font-semibold">Generar</strong> la Nota de Crédito
            </p>
          </ProcesoPaso>
      </AppModal>
    </Dialog>
  );
}
