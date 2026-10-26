"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminarAjusteBalIvaAction } from "@/actions/balIva";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import AjusteSaldoBalIvaControl from "@/components/finanzas/AjusteSaldoBalIvaControl";
import CeldaVerComprobante from "@/components/finanzas/CeldaVerComprobante";
import PedidoHistoriaLecturaModal from "@/components/pedidos/PedidoHistoriaLecturaModal";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { APP_ROUTES } from "@/lib/appRoutes";
import { fmtCx, hrefCxMercVend } from "@/lib/balCxMercVend";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type {
  BalanceIvaData,
  ComprobanteOrigenBalIva,
  FilaBalanceIva,
} from "@/services/balIva.service";

const BASE_PATH = APP_ROUTES.finanzas.balance.balanceIva;

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";

interface Props {
  data: BalanceIvaData;
  esEditor: boolean;
}

function celdaImporte(n: number) {
  return n === 0 ? "" : fmtCx(n);
}

function claseImporte(n: number) {
  return cn(TD_NUM, n < 0 && "text-destructive");
}

export default function FinBalBalanceIvaPageClient({ data, esEditor }: Props) {
  const router = useRouter();
  const { filas, filtros, periodoDefault } = data;
  const [comprobanteVer, setComprobanteVer] = useState<ComprobanteOrigenBalIva>(null);
  const [ajusteParaEliminar, setAjusteParaEliminar] = useState<FilaBalanceIva | null>(null);
  const [eliminando, setEliminando] = useState(false);

  function irAPeriodo(periodo: string) {
    router.push(hrefCxMercVend(BASE_PATH, periodo === periodoDefault ? {} : { periodo }));
  }

  async function handleConfirmarBorrado() {
    if (!ajusteParaEliminar) return;
    setEliminando(true);
    try {
      const res = await eliminarAjusteBalIvaAction({ id: ajusteParaEliminar.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ajuste borrado.");
      setAjusteParaEliminar(null);
      router.refresh();
    } finally {
      setEliminando(false);
    }
  }

  return (
    <ClassicFilteredTableLayout
      title="FINANZAS"
      subtitle="Balance IVA"
      contentWidth="full"
      actions={esEditor ? <AjusteSaldoBalIvaControl onCreado={() => router.refresh()} /> : undefined}
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <FilterRowSelection>
            <FilaFiltrosDesplegables columnas={5}>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtros.periodo !== periodoDefault}
                onLimpiar={() => irAPeriodo(periodoDefault)}
              >
                <Select value={filtros.periodo} onValueChange={irAPeriodo}>
                  <SelectTrigger
                    id="filtro-balance-iva-fecha"
                    className={SELECT_TRIGGER_FILTER_CLASS}
                    aria-label="Fecha"
                  >
                    <SelectValue placeholder="FECHA" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro max-h-60"
                  >
                    {data.periodos.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-2 gap-2")}>
                <LimpiarFiltrosButton onClick={() => irAPeriodo(periodoDefault)} />
              </div>
            </FilaFiltrosDesplegables>
          </FilterRowSelection>
        </FilterBar>
      }
    >
      <div className="contenedor-tabla-gestion min-h-0 flex-1">
        <Table variant="compact" className="tabla-gestion-compacta w-full">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">FECHA</TableHead>
              <TableHead>MOVIMIENTO</TableHead>
              <TableHead>DESCRIPCIÓN</TableHead>
              <TableHead className="text-right">DÉBITO</TableHead>
              <TableHead className="text-right">CRÉDITO</TableHead>
              <TableHead className="text-right">SALDO</TableHead>
              <TableHead className="text-center">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/35 hover:bg-muted/35">
              <TableCell className="celda-datos" aria-hidden />
              <TableCell className="celda-datos font-medium uppercase">SALDO ANTERIOR</TableCell>
              <TableCell className="celda-datos" aria-hidden />
              <TableCell className="celda-datos" aria-hidden />
              <TableCell className="celda-datos" aria-hidden />
              <TableCell className={cn(claseImporte(data.saldoInicial), "font-medium")}>
                {fmtCx(data.saldoInicial)}
              </TableCell>
              <TableCell className="celda-datos" aria-hidden />
            </TableRow>
            {filas.length === 0 ? (
              <EmptyTableRow colSpan={7} message="No hay movimientos de IVA en este mes." />
            ) : (
              filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="celda-datos text-center tabular-nums">
                    {formatIsoYmdDdMmYyyyArgentina(f.fechaIso)}
                  </TableCell>
                  <TableCell className="celda-datos text-left">{f.movimiento}</TableCell>
                  <TableCell className="celda-datos text-left">{f.descripcion}</TableCell>
                  <TableCell className={claseImporte(f.debito)}>{celdaImporte(f.debito)}</TableCell>
                  <TableCell className={claseImporte(f.credito)}>{celdaImporte(f.credito)}</TableCell>
                  <TableCell className={claseImporte(f.saldo)}>{fmtCx(f.saldo)}</TableCell>
                  {f.esAjuste && esEditor ? (
                    <TableCell className="celda-datos p-0">
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Borrar ajuste"
                          title="Borrar ajuste"
                          onClick={() => setAjusteParaEliminar(f)}
                        >
                          <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  ) : (
                    <CeldaVerComprobante
                      onVer={f.comprobante ? () => setComprobanteVer(f.comprobante) : undefined}
                    />
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="celda-datos font-bold uppercase">
                TOTAL DEL MES
              </TableCell>
              <TableCell className={cn(claseImporte(data.totalDebito), "font-bold")}>
                {fmtCx(data.totalDebito)}
              </TableCell>
              <TableCell className={cn(claseImporte(data.totalCredito), "font-bold")}>
                {fmtCx(data.totalCredito)}
              </TableCell>
              <TableCell className={cn(claseImporte(data.saldoFinal), "font-bold")}>
                {fmtCx(data.saldoFinal)}
              </TableCell>
              <TableCell className="celda-datos" aria-hidden />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <FacturaComprobanteDetalleModal
        open={comprobanteVer?.tipo === "venta"}
        onOpenChange={(open) => {
          if (!open) setComprobanteVer(null);
        }}
        comprobanteId={comprobanteVer?.tipo === "venta" ? comprobanteVer.comprobanteVtaId : null}
      />
      <PedidoHistoriaLecturaModal
        variante="compra"
        open={comprobanteVer?.tipo === "compra"}
        onOpenChange={(open) => {
          if (!open) setComprobanteVer(null);
        }}
        pedidoHistoriaId={comprobanteVer?.tipo === "compra" ? comprobanteVer.pedidoHistoriaId : null}
      />
      <Dialog
        open={ajusteParaEliminar != null}
        onOpenChange={(open) => (!open && !eliminando ? setAjusteParaEliminar(null) : null)}
      >
        {ajusteParaEliminar ? (
          <AppModal
            title="CONFIRMAR BORRADO"
            size="sm"
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={eliminando}
                  onClick={() => setAjusteParaEliminar(null)}
                >
                  Cancelar
                </Button>
                <Button type="button" disabled={eliminando} onClick={() => void handleConfirmarBorrado()}>
                  {eliminando ? "Borrando..." : "Borrar"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground">
                ¿Querés borrar este ajuste de saldo? Esta acción no se puede deshacer.
              </p>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {formatIsoYmdDdMmYyyyArgentina(ajusteParaEliminar.fechaIso)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>{ajusteParaEliminar.debito !== 0 ? "DÉBITO" : "CRÉDITO"}</ModalMicroLabel>
                <p className="text-sm tabular-nums text-foreground">
                  {fmtCx(ajusteParaEliminar.debito !== 0 ? ajusteParaEliminar.debito : ajusteParaEliminar.credito)}
                </p>
              </div>
            </div>
          </AppModal>
        ) : null}
      </Dialog>
    </ClassicFilteredTableLayout>
  );
}
