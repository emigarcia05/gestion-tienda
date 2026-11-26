"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Info, Loader2, Trash2 } from "lucide-react";
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
import {
  CAMPO_DESC_ESPECIAL,
  CAMPO_PX_PROMO_FIJO,
} from "@/lib/descuentosListaPrecioReglasConstants";
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
const LABEL_CLASS = "font-medium text-sm text-foreground text-left shrink-0";
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

const CAMPOS_DESC_PRODUCTO = [
  "dto_marca",
  "dto_rubro",
  "dto_cantidad",
  CAMPO_DESC_ESPECIAL,
] as const;

/** Nominal de un descuento sobre PX. LISTA. Con Px. Promo Fijo no se resta. */
function nominalDescuentoAplicado(
  fila: FilaListaPrecioParaCliente,
  descuento: DescuentoActivoListaPrecio | undefined,
  pxPromo: number | null
): number {
  if (!descuento || descuento.tipo !== "descuento") return 0;
  if (pxPromo != null && pxPromo > 0) return 0;
  return nominalReglaNumero(fila, descuento, pxPromo) ?? 0;
}

/**
 * SUBTOTAL PROVEEDOR = PX. LISTA − DESC. PROV.
 * SUBTOTAL PRODUCTO = ese subtotal − marca − rubro − cantidad − específico.
 * SUBTOTAL FINANCIERO = ese subtotal − DESC. FINANCIERO.
 * PX. FINAL = subtotal financiero + CX. TRANSP.
 * Con Px. Promo Fijo la base es el promo y los descuentos no se restan.
 */
function subtotalesDescuentos(
  fila: FilaListaPrecioParaCliente,
  descuentos: DescuentoActivoListaPrecio[],
  pxPromo: number | null
): { proveedor: number; productos: number; financiero: number; pxFinal: number } {
  const hayPromo = pxPromo != null && pxPromo > 0;
  const base = hayPromo && pxPromo != null ? pxPromo : fila.pxListaProveedor;
  const porCampo = new Map(descuentos.map((d) => [d.campo, d]));
  const resta = (campo: DescuentoActivoListaPrecio["campo"]) =>
    nominalDescuentoAplicado(fila, porCampo.get(campo), pxPromo);
  const proveedor = Math.max(0, base - resta("dto_proveedor"));
  const productos = Math.max(
    0,
    CAMPOS_DESC_PRODUCTO.reduce((acc, campo) => acc - resta(campo), proveedor)
  );
  const financiero = Math.max(0, productos - resta("dto_financiero"));
  const cx = descuentos.find((d) => d.campo === "cx_transporte");
  const cxNominal =
    cx != null ? (nominalReglaNumero(fila, cx, pxPromo) ?? 0) : 0;
  return {
    proveedor,
    productos,
    financiero,
    pxFinal: financiero + cxNominal,
  };
}

function nominalReglaNumero(
  fila: FilaListaPrecioParaCliente,
  descuento: DescuentoActivoListaPrecio,
  pxPromo: number | null
): number | null {
  if (descuento.tipo === "descuento") {
    return fila.pxListaProveedor * (descuento.valor / 100);
  }
  const hayPromo = pxPromo != null && pxPromo > 0;
  const base =
    hayPromo && pxPromo != null
      ? pxPromo
      : fila.pxListaProveedor * (1 - dtoTotalFila(fila) / 100);
  return base * (descuento.valor / 100);
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

const REGLA_ANULADA_CLASS = "text-muted-foreground line-through";
const HUECO_INFO_CLASS = "flex h-7 w-7 shrink-0 items-center justify-center";

function CeldaPctRegla({
  porcentaje,
  iconoSentido,
  onVerRegla,
  ariaLabelRegla,
}: {
  porcentaje: ReactNode;
  iconoSentido: ReactNode;
  onVerRegla?: () => void;
  ariaLabelRegla?: string;
}) {
  return (
    <TableCell className="celda-datos celda-datos--accion-relleno-fila p-0">
      <div className="flex h-full w-full items-center">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
          {porcentaje}
          {iconoSentido}
        </div>
        <div className={HUECO_INFO_CLASS}>
          {onVerRegla ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-sm text-primary hover:bg-primary/10 hover:text-primary"
              aria-label={ariaLabelRegla}
              onClick={onVerRegla}
            >
              <Info className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </TableCell>
  );
}

function FilaReglaAplicada({
  fila,
  descuento,
  pxPromo,
  onVerRegla,
  corte = false,
}: {
  fila: FilaListaPrecioParaCliente;
  descuento: DescuentoActivoListaPrecio;
  pxPromo: number | null;
  onVerRegla: (descuento: DescuentoActivoListaPrecio) => void;
  corte?: boolean;
}) {
  const esDescuento = descuento.tipo === "descuento";
  const hayPromo = pxPromo != null && pxPromo > 0;
  const anuladoPorPromo = hayPromo && esDescuento;
  const IconoSentido = esDescuento ? ArrowDown : ArrowUp;

  return (
    <TableRow
      className={cn(corte && "desc-aplicados-corte")}
      title={anuladoPorPromo ? "No aplicado: hay Px. Promo Fijo" : undefined}
    >
      <TableCell
        className={cn(
          "celda-datos text-left font-normal",
          anuladoPorPromo && REGLA_ANULADA_CLASS
        )}
      >
        {descuento.label}
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos celda-numero text-center",
          anuladoPorPromo && REGLA_ANULADA_CLASS
        )}
      >
        {fmtNominalCuenta(
          nominalReglaNumero(fila, descuento, pxPromo),
          descuento.tipo
        )}
      </TableCell>
      <CeldaPctRegla
        porcentaje={
          <span
            className={cn(
              MONTO_CLASS,
              "min-w-0 truncate",
              anuladoPorPromo && REGLA_ANULADA_CLASS
            )}
          >
            {fmtPorcentajeTabla(descuento.valor)}
          </span>
        }
        iconoSentido={
          <IconoSentido
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              anuladoPorPromo
                ? "text-muted-foreground"
                : esDescuento
                  ? "text-primary"
                  : "text-destructive"
            )}
            aria-hidden
          />
        }
        onVerRegla={() => onVerRegla(descuento)}
        ariaLabelRegla={`Ver regla de ${descuento.label}`}
      />
    </TableRow>
  );
}

function FilaSubtotal({
  etiqueta,
  monto,
  corte = false,
}: {
  etiqueta: string;
  monto: number | null;
  corte?: boolean;
}) {
  return (
    <TableRow className={cn("desc-aplicados-subtotal", corte && "desc-aplicados-corte")}>
      <TableCell className="celda-datos text-left font-semibold">
        {etiqueta}
      </TableCell>
      <TableCell className="celda-datos celda-numero text-center font-semibold">
        {fmtPesos(monto)}
      </TableCell>
      <TableCell className="celda-datos" />
    </TableRow>
  );
}

function FilaDescPxPromoFijo({
  pxLista,
  pxPromo,
}: {
  pxLista: number;
  pxPromo: number;
}) {
  const monto = Math.max(0, pxLista - pxPromo);
  const pct = pxLista > 0 ? (monto / pxLista) * 100 : null;

  return (
    <TableRow>
      <TableCell className="celda-datos text-left font-normal">
        DESC. PX. PROMO FIJO
      </TableCell>
      <TableCell className="celda-datos celda-numero text-center">
        {fmtNominalCuenta(monto, "descuento")}
      </TableCell>
      <CeldaPctRegla
        porcentaje={
          <span className={cn(MONTO_CLASS, "min-w-0 truncate")}>
            {pct == null ? VACIO : fmtPorcentajeTabla(pct)}
          </span>
        }
        iconoSentido={
          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        }
      />
    </TableRow>
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
  const reglaProveedor = useMemo(
    () => descuentosReglas.find((d) => d.campo === "dto_proveedor") ?? null,
    [descuentosReglas]
  );
  const reglasProducto = useMemo(
    () =>
      CAMPOS_DESC_PRODUCTO.flatMap((campo) => {
        const regla = descuentosReglas.find((d) => d.campo === campo);
        return regla ? [regla] : [];
      }),
    [descuentosReglas]
  );
  const reglaFinanciera = useMemo(
    () => descuentosReglas.find((d) => d.campo === "dto_financiero") ?? null,
    [descuentosReglas]
  );
  const reglaTransporte = useMemo(
    () => descuentosReglas.find((d) => d.campo === "cx_transporte") ?? null,
    [descuentosReglas]
  );
  const hayPromoPersistido = fila?.pxPromoFijo != null && fila.pxPromoFijo > 0;
  const pxPromoVista = useMemo(() => {
    const norm = pxPromoFijoNorm.trim();
    if (norm === "") return null;
    const n = roundPrecioListaTienda(
      montoArNormalizedStringToPesosNumber(norm)
    );
    return n > 0 ? n : null;
  }, [pxPromoFijoNorm]);
  const hayValorPromoInput = pxPromoFijoNorm.trim() !== "";
  const mostrarBasura = puedeEditar && (hayPromoPersistido || hayValorPromoInput);
  const subtotales =
    fila == null ? null : subtotalesDescuentos(fila, descuentosReglas, pxPromoVista);

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
    if (!hayPromoPersistido) return;
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
          <div className="flex flex-col">
            <p
              className="text-center text-sm font-medium text-foreground"
              title={fila.descripcion}
            >
              {fila.descripcion}
            </p>

            <div className="flex items-center justify-center py-5">
              <div className="flex w-[70%] items-center justify-center gap-3">
                <Label htmlFor="pxPromoFijo" className={LABEL_CLASS}>
                  {fila.pxDolares ? "PX. PROMO FIJO (US$)" : "PX. PROMO FIJO"}
                </Label>
                {puedeEditar ? (
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
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
                  <p className={cn(MONTO_CLASS, "text-foreground")}>
                    {hayPromoPersistido && fila.pxPromoFijo != null
                      ? fila.pxDolares
                        ? `US$ ${fmtUsdPromo(fila.pxPromoFijo)}`
                        : fmtPesos(fila.pxPromoFijo)
                      : VACIO}
                  </p>
                )}
              </div>
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
                  {pxPromoVista != null ? (
                    <FilaDescPxPromoFijo
                      pxLista={fila.pxListaProveedor}
                      pxPromo={pxPromoVista}
                    />
                  ) : null}
                  {reglaProveedor ? (
                    <FilaReglaAplicada
                      fila={fila}
                      descuento={reglaProveedor}
                      pxPromo={pxPromoVista}
                      onVerRegla={onVerRegla}
                      corte
                    />
                  ) : null}
                  <FilaSubtotal
                    etiqueta="SUBTOTAL CON DESC. PROVEEDOR"
                    monto={subtotales?.proveedor ?? null}
                    corte
                  />
                  {reglasProducto.map((descuento, indice) => (
                    <FilaReglaAplicada
                      key={descuento.campo}
                      fila={fila}
                      descuento={descuento}
                      pxPromo={pxPromoVista}
                      onVerRegla={onVerRegla}
                      corte={indice === 0}
                    />
                  ))}
                  <FilaSubtotal
                    etiqueta="SUBTOTAL CON DESC. PRODUCTO"
                    monto={subtotales?.productos ?? null}
                    corte
                  />
                  {reglaFinanciera ? (
                    <FilaReglaAplicada
                      fila={fila}
                      descuento={reglaFinanciera}
                      pxPromo={pxPromoVista}
                      onVerRegla={onVerRegla}
                      corte
                    />
                  ) : null}
                  <FilaSubtotal
                    etiqueta="SUBTOTAL CON DESC. FINANCIERO"
                    monto={subtotales?.financiero ?? null}
                    corte
                  />
                  {reglaTransporte ? (
                    <FilaReglaAplicada
                      fila={fila}
                      descuento={reglaTransporte}
                      pxPromo={pxPromoVista}
                      onVerRegla={onVerRegla}
                      corte
                    />
                  ) : null}
                </TableBody>
                <TableFooter className="border-t-2 border-primary bg-muted">
                  <TableRow className="border-0 bg-muted hover:bg-muted">
                    <TableCell className="celda-datos text-left font-semibold">
                      PX. FINAL
                    </TableCell>
                    <TableCell className="celda-datos celda-numero text-center font-semibold">
                      {fmtPesos(subtotales?.pxFinal ?? null)}
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
