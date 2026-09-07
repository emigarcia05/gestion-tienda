"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Info, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import MontoArInput from "@/components/shared/MontoArInput";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import { CAMPO_PX_PROMO_FIJO } from "@/lib/descuentosListaPrecioReglasConstants";
import { fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clampPercent, roundPrecioListaTienda } from "@/lib/calculos";
import {
  montoArNumberToNormalizedString,
  montoArNormalizedStringToPesosNumber,
} from "@/lib/montoArMask";
import { actualizarListaPreciosMasivoAction } from "@/actions/listaPrecios";
import type {
  DescuentoActivoListaPrecio,
  FilaListaPrecioParaCliente,
} from "@/services/listaPrecios.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: FilaListaPrecioParaCliente | null;
  puedeEditar: boolean;
  onVerRegla: (descuento: DescuentoActivoListaPrecio) => void;
  onSuccess?: () => void;
}

const VACIO = "-";
const GRID_CLASS =
  "grid grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,2fr)] gap-x-3 gap-y-2 items-center";
const LABEL_CLASS = "font-medium text-sm text-foreground text-left";
const MONTO_CLASS = "text-sm tabular-nums text-foreground text-center";

function fmtUsdPromo(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPesos(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return VACIO;
  return `$${fmtPrecio(n)}`;
}

function dtoTotalFila(fila: FilaListaPrecioParaCliente): number {
  return clampPercent(
    fila.dtoProveedor +
      fila.dtoMarca +
      fila.dtoRubro +
      fila.dtoCantidad +
      fila.dtoFinanciero +
      fila.descEspecial
  );
}

function nominalReglaNumero(
  fila: FilaListaPrecioParaCliente,
  descuento: DescuentoActivoListaPrecio,
  hayPromo: boolean
): number | null {
  if (hayPromo) return null;
  if (descuento.tipo === "descuento") {
    return fila.pxListaProveedor * (descuento.valor / 100);
  }
  const baseTrasDto = fila.pxListaProveedor * (1 - dtoTotalFila(fila) / 100);
  return baseTrasDto * (descuento.valor / 100);
}

function fmtNominalCuenta(
  n: number | null,
  tipo: DescuentoActivoListaPrecio["tipo"]
): string {
  if (n == null) return VACIO;
  const monto = fmtPesos(n);
  if (monto === VACIO) return VACIO;
  return tipo === "descuento" ? `−${monto}` : `+${monto}`;
}

function FilaTres({
  etiqueta,
  htmlFor,
  porcentaje,
  nominal,
  className,
  etiquetaClassName,
}: {
  etiqueta: string;
  htmlFor?: string;
  porcentaje: ReactNode;
  nominal: ReactNode;
  className?: string;
  etiquetaClassName?: string;
}) {
  return (
    <>
      {htmlFor ? (
        <Label htmlFor={htmlFor} className={cn(LABEL_CLASS, etiquetaClassName, className)}>
          {etiqueta}
        </Label>
      ) : (
        <span className={cn(LABEL_CLASS, etiquetaClassName, className)}>{etiqueta}</span>
      )}
      <div className={cn("flex min-w-0 items-center justify-center", className)}>{nominal}</div>
      <div className={cn("flex min-w-0 items-center justify-center", className)}>{porcentaje}</div>
    </>
  );
}

export default function DescuentosAplicadosListaPreciosModal({
  open,
  onOpenChange,
  fila,
  puedeEditar,
  onVerRegla,
  onSuccess,
}: Props) {
  const [pxPromoFijoNorm, setPxPromoFijoNorm] = useState("");
  const [pending, setPending] = useState(false);

  const descuentosReglas = useMemo(
    () => (fila?.descuentosActivos ?? []).filter((d) => d.campo !== CAMPO_PX_PROMO_FIJO),
    [fila]
  );
  const hayPromo = fila?.pxPromoFijo != null && fila.pxPromoFijo > 0;
  const hayValorPromoInput = pxPromoFijoNorm.trim() !== "";
  const mostrarBasura = puedeEditar && (hayPromo || hayValorPromoInput);

  useEffect(() => {
    if (!open || !fila) return;
    setPxPromoFijoNorm(
      fila.pxPromoFijo != null && fila.pxPromoFijo > 0
        ? montoArNumberToNormalizedString(fila.pxPromoFijo)
        : ""
    );
  }, [open, fila]);

  async function persistirPromo(valor: number | null) {
    if (!fila || !puedeEditar) return;
    setPending(true);
    try {
      const result = await actualizarListaPreciosMasivoAction({
        ids: [fila.codExt],
        data: { pxPromoFijo: valor },
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el Px. Promo Fijo.");
        return;
      }
      toast.success(
        valor == null ? "Se quitó el Px. Promo Fijo." : "Px. Promo Fijo actualizado."
      );
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  async function handleGuardarPromo() {
    if (!fila || !puedeEditar) return;
    const norm = pxPromoFijoNorm.trim();
    const pxPromoFijo =
      norm === ""
        ? null
        : roundPrecioListaTienda(montoArNormalizedStringToPesosNumber(norm));
    const valor = pxPromoFijo != null && pxPromoFijo > 0 ? pxPromoFijo : null;
    await persistirPromo(valor);
  }

  async function handleQuitarPromo() {
    setPxPromoFijoNorm("");
    if (!hayPromo) return;
    await persistirPromo(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        className="max-w-[33.6rem]"
        title="Descuentos Aplicados"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            {puedeEditar ? (
              <Button
                type="button"
                disabled={pending || !fila}
                onClick={() => void handleGuardarPromo()}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Guardando
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            ) : null}
          </>
        }
      >
        {!fila ? (
          <p className="text-sm text-muted-foreground">Sin datos del ítem.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className={GRID_CLASS}>
              <span className="sr-only">Etiqueta</span>
              <span className="sr-only">Valor nominal</span>
              <span className="sr-only">Valor porcentual</span>

              <FilaTres
                etiqueta={fila.pxDolares ? "PX. PROMO FIJO (US$)" : "PX. PROMO FIJO"}
                htmlFor="pxPromoFijo"
                porcentaje={null}
                nominal={
                  puedeEditar ? (
                    <div className="flex w-full min-w-0 items-center justify-center gap-1">
                      <MontoArInput
                        id="pxPromoFijo"
                        placeholder={VACIO}
                        valueNormalized={pxPromoFijoNorm}
                        onValueNormalizedChange={setPxPromoFijoNorm}
                        treatEmptyNormalizedAsBlank
                        disabled={pending}
                        className="tabular-nums border-primary min-w-0 flex-1 px-3 text-center"
                      />
                      <div className="h-7 w-7 shrink-0">
                        {mostrarBasura ? (
                          <Button
                            type="button"
                            variant="primaryIcon"
                            size="icon"
                            disabled={pending}
                            onClick={() => void handleQuitarPromo()}
                            className="h-7 w-7"
                            aria-label="Quitar Px. Promo Fijo"
                            title="Quitar Px. Promo Fijo"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className={MONTO_CLASS}>
                      {hayPromo && fila.pxPromoFijo != null
                        ? fila.pxDolares
                          ? `US$ ${fmtUsdPromo(fila.pxPromoFijo)}`
                          : fmtPesos(fila.pxPromoFijo)
                        : VACIO}
                    </p>
                  )
                }
              />
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <Table variant="compact" scrollX={false}>
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <TableBody>
                  <TableRow>
                    <TableCell className="celda-datos text-left font-medium">
                      PX. LISTA
                    </TableCell>
                    <TableCell className="celda-datos celda-numero text-center">
                      {fmtPesos(fila.pxListaProveedor)}
                    </TableCell>
                    <TableCell className="celda-datos" />
                  </TableRow>
                  {descuentosReglas.map((descuento) => (
                    <TableRow key={descuento.campo}>
                      <TableCell className="celda-datos text-left font-normal">
                        {descuento.label}
                      </TableCell>
                      <TableCell className="celda-datos celda-numero text-center">
                        {fmtNominalCuenta(
                          nominalReglaNumero(fila, descuento, hayPromo),
                          descuento.tipo
                        )}
                      </TableCell>
                      <TableCell className="celda-datos celda-datos--accion-relleno-fila p-0">
                        <div className="flex h-full items-center justify-center gap-0.5">
                          <span className={cn(MONTO_CLASS, "min-w-0 truncate")}>
                            {fmtPorcentajeTabla(descuento.valor)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-7 w-7 shrink-0 rounded-sm text-primary hover:bg-primary/10 hover:text-primary"
                            )}
                            aria-label={`Ver regla de ${descuento.label}`}
                            onClick={() => onVerRegla(descuento)}
                          >
                            <Info className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="border-t-2 border-primary bg-muted">
                  <TableRow className="border-0 bg-muted hover:bg-muted">
                    <TableCell className="celda-datos text-left font-semibold">
                      PX. FINAL
                    </TableCell>
                    <TableCell className="celda-datos celda-numero text-center font-semibold">
                      {fmtPesos(fila.pxCompraFinalSinIva)}
                    </TableCell>
                    <TableCell className="celda-datos" />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
