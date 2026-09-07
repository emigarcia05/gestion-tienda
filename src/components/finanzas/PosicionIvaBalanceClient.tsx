"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtPrecio } from "@/lib/format";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import {
  listarDetalleIvaCreditoComprasMercaderiaMesAction,
  listarDetalleIvaCreditoGastosMesAction,
} from "@/actions/finBalPosicionIva";
import { listarDetalleIvaDebitoMesAction } from "@/actions/finBalIvaDeb";
import type {
  DetalleLineaIvaCreditoBalance,
  DetalleLineaIvaCreditoCompraMercaderia,
} from "@/services/finBalPosicionIva.service";
import type { DetalleLineaIvaDebitoBalance } from "@/services/finBalIvaDeb.service";
import EditarIvaSaldoManualModal from "@/components/finanzas/EditarIvaSaldoManualModal";
import ConfigurarIvaComparacionPedidosControl from "@/components/finanzas/ConfigurarIvaComparacionPedidosControl";
import type { EstadoIvaComparacionPedido } from "@/actions/finBalPosicionIvaComparacionPedido";
import { toast } from "sonner";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";

const MESES_CALENDARIO: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "ENERO" },
  { valor: 2, etiqueta: "FEBRERO" },
  { valor: 3, etiqueta: "MARZO" },
  { valor: 4, etiqueta: "ABRIL" },
  { valor: 5, etiqueta: "MAYO" },
  { valor: 6, etiqueta: "JUNIO" },
  { valor: 7, etiqueta: "JULIO" },
  { valor: 8, etiqueta: "AGOSTO" },
  { valor: 9, etiqueta: "SEPTIEMBRE" },
  { valor: 10, etiqueta: "OCTUBRE" },
  { valor: 11, etiqueta: "NOVIEMBRE" },
  { valor: 12, etiqueta: "DICIEMBRE" },
];

const TH_NUM = "text-right whitespace-nowrap";
const TH_DEBITO_IMPORTE = "text-center whitespace-nowrap";
const TD_NUM = "celda-datos text-right tabular-nums";
const TD_DEBITO_IMPORTE = "celda-datos text-center tabular-nums whitespace-nowrap align-middle";

/** Botón ícono edición en tabla balance (misma familia que Balance mensual). */
const CLASE_BOTON_EDITAR_IVA_DEBITO = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!h-7 !w-7 min-h-0 !p-1 shrink-0",
);

type VistaModalPosicionIva =
  | "detalle-posicion"
  | "iva-debito-detalle"
  | "iva-credito-menu"
  | "iva-credito-gastos"
  | "iva-credito-compras";

interface Props {
  anio: number;
  esEditor: boolean;
  ivaDebitoPorMes: number[];
  ivaCreditoPorMes: number[];
  /** Índice 0 = enero; si no es null, ese mes usa saldo manual y débito/crédito se muestran vacíos. */
  saldoManualPorMes: (number | null)[];
  comparacionPedidos: EstadoIvaComparacionPedido;
}

function celdaMontoPesos(pesos: number) {
  if (pesos === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <>${fmtPrecio(pesos)}</>;
}

export default function PosicionIvaBalanceClient({
  anio,
  esEditor,
  ivaDebitoPorMes,
  ivaCreditoPorMes,
  saldoManualPorMes,
  comparacionPedidos,
}: Props) {
  const router = useRouter();
  const [mesModalSaldoManual, setMesModalSaldoManual] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mesDetalle, setMesDetalle] = useState<number | null>(null);
  const [vista, setVista] = useState<VistaModalPosicionIva>("detalle-posicion");
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [filasDebito, setFilasDebito] = useState<DetalleLineaIvaDebitoBalance[]>([]);
  const [filasGasto, setFilasGasto] = useState<DetalleLineaIvaCreditoBalance[]>([]);
  const [filasCompra, setFilasCompra] = useState<DetalleLineaIvaCreditoCompraMercaderia[]>([]);

  const hayMesConSaldoManual = useMemo(
    () => saldoManualPorMes.some((x) => x !== null),
    [saldoManualPorMes],
  );

  const filasPosicionIva = useMemo(() => {
    return MESES_CALENDARIO.map((m) => {
      const ix = m.valor - 1;
      const debito = ivaDebitoPorMes[ix] ?? 0;
      const credito = ivaCreditoPorMes[ix] ?? 0;
      const saldoCalculado = debito - credito;
      const manual = saldoManualPorMes[ix] ?? null;
      const usaManual = manual !== null;
      const saldoMostrado = usaManual ? manual : saldoCalculado;
      return {
        mes: m.valor,
        etiquetaMes: m.etiqueta,
        ix,
        debito,
        credito,
        usaManual,
        saldoMostrado,
      };
    });
  }, [ivaDebitoPorMes, ivaCreditoPorMes, saldoManualPorMes]);

  const sumaIvaSaldoAnual = useMemo(
    () => filasPosicionIva.reduce((a, row) => a + row.saldoMostrado, 0),
    [filasPosicionIva],
  );

  const sumaDebitoAnual = useMemo(
    () => ivaDebitoPorMes.reduce((a, n) => a + (n ?? 0), 0),
    [ivaDebitoPorMes],
  );
  const sumaCreditoAnual = useMemo(
    () => ivaCreditoPorMes.reduce((a, n) => a + (n ?? 0), 0),
    [ivaCreditoPorMes],
  );

  const etiquetaMesDetalle =
    mesDetalle != null ? MESES_CALENDARIO.find((x) => x.valor === mesDetalle)?.etiqueta ?? "" : "";

  const tituloModal =
    mesDetalle == null
      ? "Detalle Posición IVA"
      : vista === "detalle-posicion"
        ? `Detalle Posición IVA · ${etiquetaMesDetalle} ${anio}`
        : vista === "iva-debito-detalle"
          ? `Detalle IVA Débito - ${etiquetaMesDetalle} ${anio}`
          : vista === "iva-credito-menu"
            ? `Detalle IVA Crédito · ${etiquetaMesDetalle} ${anio}`
            : vista === "iva-credito-gastos"
              ? `Detalle IVA Crédito - Gastos - ${etiquetaMesDetalle} ${anio}`
              : `Detalle IVA Crédito - Compras Mercadería - ${etiquetaMesDetalle} ${anio}`;

  const abrirMenuMes = useCallback((mes: number) => {
    setMesDetalle(mes);
    setVista("detalle-posicion");
    setFilasDebito([]);
    setFilasGasto([]);
    setFilasCompra([]);
    setCargandoDetalle(false);
    setModalOpen(true);
  }, []);

  const volver = useCallback(() => {
    if (vista === "iva-debito-detalle") {
      setVista("detalle-posicion");
      setFilasDebito([]);
      setCargandoDetalle(false);
      return;
    }
    if (vista === "iva-credito-menu") {
      setVista("detalle-posicion");
      return;
    }
    if (vista === "iva-credito-gastos" || vista === "iva-credito-compras") {
      setVista("iva-credito-menu");
      setFilasGasto([]);
      setFilasCompra([]);
      setCargandoDetalle(false);
    }
  }, [vista]);

  const abrirCreditoMenu = useCallback(() => {
    setVista("iva-credito-menu");
  }, []);

  const abrirDetalleDebito = useCallback(async () => {
    if (mesDetalle == null) return;
    setVista("iva-debito-detalle");
    setCargandoDetalle(true);
    setFilasDebito([]);
    try {
      const r = await listarDetalleIvaDebitoMesAction({ mes: mesDetalle, anio });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cargar el detalle.");
        setFilasDebito([]);
        setVista("detalle-posicion");
        return;
      }
      setFilasDebito(r.data);
    } finally {
      setCargandoDetalle(false);
    }
  }, [anio, mesDetalle]);

  const abrirDetalleGastos = useCallback(async () => {
    if (mesDetalle == null) return;
    setVista("iva-credito-gastos");
    setCargandoDetalle(true);
    setFilasGasto([]);
    try {
      const r = await listarDetalleIvaCreditoGastosMesAction({ mes: mesDetalle, anio });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cargar el detalle.");
        setFilasGasto([]);
        return;
      }
      setFilasGasto(r.data);
    } finally {
      setCargandoDetalle(false);
    }
  }, [anio, mesDetalle]);

  const abrirDetalleCompras = useCallback(async () => {
    if (mesDetalle == null) return;
    setVista("iva-credito-compras");
    setCargandoDetalle(true);
    setFilasCompra([]);
    try {
      const r = await listarDetalleIvaCreditoComprasMercaderiaMesAction({ mes: mesDetalle, anio });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cargar el detalle.");
        setFilasCompra([]);
        return;
      }
      setFilasCompra(r.data);
    } finally {
      setCargandoDetalle(false);
    }
  }, [anio, mesDetalle]);

  function cerrarModal(open: boolean) {
    setModalOpen(open);
    if (!open) {
      setMesDetalle(null);
      setVista("detalle-posicion");
      setFilasDebito([]);
      setFilasGasto([]);
      setFilasCompra([]);
      setCargandoDetalle(false);
    }
  }

  const handleComparacionActualizada = useCallback(() => {
    router.refresh();
  }, [router]);

  const toolbarActions = (
    <ConfigurarIvaComparacionPedidosControl
      puedeEditar={esEditor}
      estadoInicial={comparacionPedidos}
      onActualizado={handleComparacionActualizada}
    />
  );

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Finanzas"
        subtitle="Posición de IVA"
        contentWidth="full"
        actions={toolbarActions}
      >
        <div className="flex flex-1 min-h-0 flex-col pb-4">
          <div className="contenedor-tabla-gestion flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
              <div data-slot="table-container" className="relative w-full min-w-0 max-w-full">
                <Table
                  data-slot="table"
                  className="w-full caption-bottom text-sm tabla-gestion-compacta table-fixed"
                >
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-0">MES</TableHead>
                      <TableHead className={cn(TH_DEBITO_IMPORTE, "min-w-0 font-medium")}>
                        IVA DÉBITO
                      </TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>IVA CRÉDITO</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>IVA SALDO</TableHead>
                      <TableHead className="text-center whitespace-nowrap min-w-0 px-2 font-medium">
                        ACCIONES
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasPosicionIva.map((row) => (
                      <TableRow
                        key={row.mes}
                        className="cursor-pointer select-none hover:bg-muted/50"
                        tabIndex={0}
                        role="button"
                        title="Clic para ver detalle del mes"
                        onClick={() => abrirMenuMes(row.mes)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            abrirMenuMes(row.mes);
                          }
                        }}
                      >
                        <TableCell className="celda-datos min-w-0 whitespace-nowrap font-medium">
                          {row.etiquetaMes} {anio}
                        </TableCell>
                        <TableCell className={TD_DEBITO_IMPORTE}>
                          {row.usaManual ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            celdaMontoPesos(row.debito)
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(TD_NUM, "min-w-0", !row.usaManual && "celda-destacado")}
                        >
                          {row.usaManual ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            celdaMontoPesos(row.credito)
                          )}
                        </TableCell>
                        <TableCell className={cn(TD_NUM, "min-w-0")}>
                          <span
                            className={cn(
                              "tabular-nums",
                              row.usaManual && "font-medium text-foreground",
                            )}
                          >
                            {celdaMontoPesos(row.saldoMostrado)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="celda-datos min-w-0 px-2 py-1.5 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {esEditor ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={CLASE_BOTON_EDITAR_IVA_DEBITO}
                                title="Editar IVA saldo manual"
                                aria-label="Editar IVA saldo manual"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMesModalSaldoManual(row.mes);
                                }}
                              >
                                <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t border-border bg-muted/35 hover:bg-muted/35 font-medium">
                      <TableCell className="celda-datos min-w-0 whitespace-nowrap uppercase tracking-wide">
                        TOTALES
                      </TableCell>
                      <TableCell className={TD_DEBITO_IMPORTE}>
                        {hayMesConSaldoManual ? (
                          <span className="text-muted-foreground font-normal">—</span>
                        ) : (
                          celdaMontoPesos(sumaDebitoAnual)
                        )}
                      </TableCell>
                      <TableCell className={cn(TD_NUM, "min-w-0")}>
                        {hayMesConSaldoManual ? (
                          <span className="text-muted-foreground font-normal">—</span>
                        ) : (
                          celdaMontoPesos(sumaCreditoAnual)
                        )}
                      </TableCell>
                      <TableCell className={cn(TD_NUM, "min-w-0")}>
                        {celdaMontoPesos(sumaIvaSaldoAnual)}
                      </TableCell>
                      <TableCell className="celda-datos min-w-0 px-2 py-1.5" aria-hidden />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </ClassicFilteredTableLayout>

      <Dialog open={modalOpen} onOpenChange={cerrarModal}>
        <AppModal
          title={tituloModal}
          size={
            vista === "detalle-posicion" || vista === "iva-credito-menu" ? "sm" : "xl"
          }
          className={
            vista === "detalle-posicion" || vista === "iva-credito-menu"
              ? undefined
              : "max-w-4xl"
          }
          padding="sm"
          scrollBody
          actions={
            <div className="flex w-full flex-wrap justify-end gap-2">
              {vista !== "detalle-posicion" ? (
                <Button type="button" variant="outline" onClick={volver}>
                  Volver
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => cerrarModal(false)}>
                Cerrar
              </Button>
            </div>
          }
        >
          <div
            className={cn(
              vista === "detalle-posicion" || vista === "iva-credito-menu"
                ? "min-h-0"
                : "min-h-[12rem]",
            )}
          >
            {vista === "detalle-posicion" ? (
              <div className="flex flex-col gap-2 py-2">
                <Button type="button" className="w-full" onClick={() => void abrirDetalleDebito()}>
                  IVA DÉBITO
                </Button>
                <Button type="button" className="w-full" onClick={abrirCreditoMenu}>
                  IVA CRÉDITO
                </Button>
              </div>
            ) : vista === "iva-credito-menu" ? (
              <div className="flex flex-col gap-2 py-2">
                <Button type="button" className="w-full" onClick={() => void abrirDetalleGastos()}>
                  GASTO
                </Button>
                <Button type="button" className="w-full" onClick={() => void abrirDetalleCompras()}>
                  COMPRA MERCADERÍA
                </Button>
              </div>
            ) : cargandoDetalle ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                Cargando…
              </div>
            ) : vista === "iva-debito-detalle" ? (
              <div className="rounded-md border border-border overflow-hidden">
                <Table className="text-sm tabla-gestion-compacta">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-0 whitespace-nowrap">FECHA</TableHead>
                      <TableHead className="min-w-0">DENOMINACIÓN SOCIAL</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>MONTO</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>IVA DÉBITO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasDebito.length === 0 ? (
                      <EmptyTableRow
                        colSpan={4}
                        message="No hay comprobantes de IVA débito para este mes."
                      />
                    ) : (
                      filasDebito.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="celda-datos whitespace-nowrap tabular-nums">
                            {formatIsoYmdDdMmYyyyArgentina(f.fechaEmisionIso)}
                          </TableCell>
                          <TableCell className="celda-datos min-w-0">{f.denominacionReceptor}</TableCell>
                          <TableCell className={cn(TD_NUM, "celda-destacado")}>
                            {celdaMontoPesos(f.impTotal)}
                          </TableCell>
                          <TableCell className={TD_NUM}>
                            {celdaMontoPesos(f.impIva)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : vista === "iva-credito-gastos" ? (
              <div className="rounded-md border border-border overflow-hidden">
                <Table className="text-sm tabla-gestion-compacta">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-0 whitespace-nowrap">FECHA</TableHead>
                      <TableHead className="min-w-0">GASTO</TableHead>
                      <TableHead className="min-w-0">SUCURSAL</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>MONTO</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>IVA CRÉDITO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasGasto.length === 0 ? (
                      <EmptyTableRow
                        colSpan={5}
                        message="No hay imputaciones con IVA crédito en este mes."
                      />
                    ) : (
                      filasGasto.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="celda-datos whitespace-nowrap tabular-nums">
                            {formatIsoYmdDdMmYyyyArgentina(f.fechaDevengoIso)}
                          </TableCell>
                          <TableCell className="celda-datos min-w-0">{f.gastoNombre}</TableCell>
                          <TableCell className="celda-datos min-w-0">{f.sucursalNombre}</TableCell>
                          <TableCell className={cn(TD_NUM, "celda-destacado")}>
                            {celdaMontoPesos(f.monto)}
                          </TableCell>
                          <TableCell className={TD_NUM}>{celdaMontoPesos(f.ivaCredito)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table className="text-sm tabla-gestion-compacta">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-0 whitespace-nowrap">FECHA</TableHead>
                      <TableHead className="min-w-0">PROVEEDOR</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>MONTO</TableHead>
                      <TableHead className={cn(TH_NUM, "min-w-0")}>IVA CRÉDITO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasCompra.length === 0 ? (
                      <EmptyTableRow
                        colSpan={4}
                        message="No hay facturas de compra de mercadería en este mes."
                      />
                    ) : (
                      filasCompra.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="celda-datos whitespace-nowrap tabular-nums">
                            {formatIsoYmdDdMmYyyyArgentina(f.fechaIso)}
                          </TableCell>
                          <TableCell className="celda-datos min-w-0">{f.proveedorNombre}</TableCell>
                          <TableCell className={cn(TD_NUM, "celda-destacado")}>
                            {celdaMontoPesos(f.monto)}
                          </TableCell>
                          <TableCell className={TD_NUM}>{celdaMontoPesos(f.ivaCredito)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </AppModal>
      </Dialog>

      <EditarIvaSaldoManualModal
        open={mesModalSaldoManual != null}
        onOpenChange={(open) => {
          if (!open) setMesModalSaldoManual(null);
        }}
        mes={mesModalSaldoManual ?? 1}
        anio={anio}
        saldoCalculado={
          mesModalSaldoManual != null
            ? (ivaDebitoPorMes[mesModalSaldoManual - 1] ?? 0) -
              (ivaCreditoPorMes[mesModalSaldoManual - 1] ?? 0)
            : 0
        }
        saldoManual={
          mesModalSaldoManual != null ? saldoManualPorMes[mesModalSaldoManual - 1] ?? null : null
        }
      />
    </div>
  );
}
