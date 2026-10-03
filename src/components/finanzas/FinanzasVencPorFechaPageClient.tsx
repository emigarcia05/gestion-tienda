"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { obtenerMovimientoTesoreriaPorIdAction } from "@/actions/tesoreriaMovimientos";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import {
  TablaFlujoDeFondo,
  TablaFlujoDeFondoDetalleDia,
  TablaFlujoDeFondoIngresosCaja,
  TituloSeccionDetalleDia,
  type FilaFlujoDeFondoVista,
} from "@/components/finanzas/TablaFlujoDeFondo";
import AppModal from "@/components/shared/AppModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  formatFechaLargaNotaPedidoArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type {
  FlujoFondoIngresoCajaFila,
  TesoreriaMovimientoFila,
} from "@/services/tesoreriaMovimientos.service";
import type { FlujoFondoDetalleDiaFila } from "@/services/vencimientosPorFecha.service";

export interface FinanzasVencPorFechaPageClientProps {
  detallesPorDia: Record<string, FlujoFondoDetalleDiaFila[]>;
  ingresosPorDia: Record<string, FlujoFondoIngresoCajaFila[]>;
  proveedoresConVencimientos: string[];
  /** Filas del periodo ya calculadas en servidor (slice de la página actual). */
  filas: FilaFlujoDeFondoVista[];
  paginaActual: number;
  totalPaginas: number;
  total: number;
}

export default function FinanzasVencPorFechaPageClient({
  detallesPorDia,
  ingresosPorDia,
  proveedoresConVencimientos,
  filas,
  paginaActual,
  totalPaginas,
  total,
}: FinanzasVencPorFechaPageClientProps) {
  const [detalleIsoYmd, setDetalleIsoYmd] = useState<string | null>(null);
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [detalleVencimientoFila, setDetalleVencimientoFila] = useState<FlujoFondoDetalleDiaFila | null>(
    null
  );
  const [detalleIngresoMovimiento, setDetalleIngresoMovimiento] =
    useState<TesoreriaMovimientoFila | null>(null);
  const [loadingDetalleIngreso, setLoadingDetalleIngreso] = useState(false);
  const detalleFilas = useMemo(() => {
    if (!detalleIsoYmd) return [];
    const base = detallesPorDia[detalleIsoYmd] ?? [];
    if (!filtroProveedor) return base;
    return base.filter((f) => f.proveedor === filtroProveedor);
  }, [detalleIsoYmd, detallesPorDia, filtroProveedor]);
  const ingresosFilas = useMemo(() => {
    if (!detalleIsoYmd) return [];
    return ingresosPorDia[detalleIsoYmd] ?? [];
  }, [detalleIsoYmd, ingresosPorDia]);
  const detalleFechaLarga = useMemo(() => {
    if (!detalleIsoYmd) return "";
    const [yy, mm, dd] = detalleIsoYmd.split("-").map(Number);
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
    return formatFechaLargaNotaPedidoArgentina(new Date(yy, mm - 1, dd));
  }, [detalleIsoYmd]);

  const filasVista = filas;
  const montoVencimientoPorDia = useMemo(() => {
    if (!filtroProveedor) {
      return Object.fromEntries(filas.map((fila) => [fila.isoYmd, fila.vencimientoDelDia]));
    }
    const porDia: Record<string, number> = {};
    for (const fila of filas) {
      const detalleDia = detallesPorDia[fila.isoYmd] ?? [];
      porDia[fila.isoYmd] = detalleDia
        .filter((d) => d.proveedor === filtroProveedor)
        .reduce((s, d) => s + d.monto, 0);
    }
    return porDia;
  }, [detallesPorDia, filas, filtroProveedor]);

  function detalleCategoriaMovimiento(fila: TesoreriaMovimientoFila): string {
    if (fila.catMovimiento !== "COBRO") return fila.categoriaEtiqueta;
    const partes = [fila.pagoNombre, fila.entidadNombre, fila.cuotaEtiqueta].filter(
      (v) => v.trim().length > 0
    );
    if (partes.length === 0) return fila.categoriaEtiqueta;
    return `${fila.categoriaEtiqueta}: ${partes.join(" - ")}`;
  }

  async function handleVerIngresoMovimiento(movimientoId: string) {
    if (loadingDetalleIngreso) return;
    setLoadingDetalleIngreso(true);
    try {
      const res = await obtenerMovimientoTesoreriaPorIdAction({ id: movimientoId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDetalleIngresoMovimiento(res.data);
    } finally {
      setLoadingDetalleIngreso(false);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ClassicFilteredTableLayout
        title="Finanzas"
        subtitle="Flujo De Fondo"
        className="min-h-0 flex-1"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroProveedor)}
                  onLimpiar={() => setFiltroProveedor("")}
                >
                  <Select
                    value={filtroProveedor ?? ""}
                    onValueChange={(valor) => setFiltroProveedor(valor)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="PROVEEDOR" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {proveedoresConVencimientos.map((proveedor) => (
                        <SelectItem key={proveedor} value={proveedor}>
                          {proveedor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-4")}>
                  <LimpiarFiltrosButton onClick={() => setFiltroProveedor("")} />
                </div>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>
        }
      >
        <div className="flex flex-1 min-h-0 flex-col gap-2 pb-4">
          <TablaFlujoDeFondo
            filas={filasVista}
            montoVencimientoPorDia={montoVencimientoPorDia}
            onVerDia={setDetalleIsoYmd}
          />

          {totalPaginas > 1 ? (
            <div className="flex shrink-0 justify-end pt-2">
              <PaginacionTabla
                basePath="/finanzas/venc-por-fecha"
                params={{}}
                paginaActual={paginaActual}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>

      <Dialog open={detalleIsoYmd !== null} onOpenChange={(open) => !open && setDetalleIsoYmd(null)}>
        <AppModal
          title={
            detalleFechaLarga ? (
              <span className="flex flex-col items-center gap-1 text-center">
                <span>Detalle Del Día</span>
                <span className="text-sm font-normal text-primary-foreground/95">{detalleFechaLarga}</span>
              </span>
            ) : (
              "Detalle Del Día"
            )
          }
          size="xl"
          padding="sm"
          scrollBody={false}
          className="h-[85vh] max-w-[min(72rem,calc(100%-2rem))]"
          actions={
            <Button type="button" variant="outline" onClick={() => setDetalleIsoYmd(null)}>
              Cerrar
            </Button>
          }
        >
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
            <section className="flex min-h-0 min-w-0 flex-col gap-2">
              <TituloSeccionDetalleDia>Vencimientos</TituloSeccionDetalleDia>
              <TablaFlujoDeFondoDetalleDia
                filas={detalleFilas}
                llenarAlto
                fechaDdMmAa
                onVerDetalle={setDetalleVencimientoFila}
              />
            </section>
            <section className="flex min-h-0 min-w-0 flex-col gap-2">
              <TituloSeccionDetalleDia>Ingresos</TituloSeccionDetalleDia>
              <TablaFlujoDeFondoIngresosCaja
                filas={ingresosFilas}
                onVerMovimiento={(id) => void handleVerIngresoMovimiento(id)}
              />
            </section>
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={detalleVencimientoFila != null}
        onOpenChange={(open) => (!open ? setDetalleVencimientoFila(null) : null)}
      >
        {detalleVencimientoFila ? (
          <AppModal
            title="DETALLE VENCIMIENTO"
            size="sm"
            actions={
              <Button type="button" variant="outline" onClick={() => setDetalleVencimientoFila(null)}>
                Cerrar
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA DEVENGADO</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {formatIsoYmdDdMmYyyyArgentina(detalleVencimientoFila.fechaDevengadaIso)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA VENCIMIENTO</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {formatIsoYmdDdMmYyyyArgentina(detalleVencimientoFila.fechaVencimientoIso)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>PROVEEDOR</ModalMicroLabel>
                <p className="text-sm text-foreground">{detalleVencimientoFila.proveedor}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>DETALLE</ModalMicroLabel>
                <p className="text-sm text-foreground">{detalleVencimientoFila.detalle}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>MONTO</ModalMicroLabel>
                <p className="text-sm tabular-nums text-foreground">
                  ${fmtPrecio(detalleVencimientoFila.monto)}
                </p>
              </div>
            </div>
          </AppModal>
        ) : null}
      </Dialog>

      <Dialog
        open={detalleIngresoMovimiento != null}
        onOpenChange={(open) => (!open ? setDetalleIngresoMovimiento(null) : null)}
      >
        {detalleIngresoMovimiento ? (
          <AppModal
            title="DETALLE MOVIMIENTO"
            size="md"
            actions={
              <Button type="button" variant="outline" onClick={() => setDetalleIngresoMovimiento(null)}>
                Cerrar
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA REGISTRO</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {formatIsoYmdDdMmYyyyArgentina(detalleIngresoMovimiento.fechaRegistroIso)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>SUCURSAL</ModalMicroLabel>
                <p className="text-sm text-foreground">{fmtCelda(detalleIngresoMovimiento.sucursalNombre)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>TIPO</ModalMicroLabel>
                <p className="text-sm text-foreground">{fmtCelda(detalleIngresoMovimiento.tipoEtiqueta)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CATEGORÍA</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {detalleCategoriaMovimiento(detalleIngresoMovimiento)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>USUARIO</ModalMicroLabel>
                <p className="text-sm text-foreground">{fmtCelda(detalleIngresoMovimiento.usuarioNombre)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>MONTO</ModalMicroLabel>
                <p className="text-sm tabular-nums text-foreground">
                  ${fmtPrecio(detalleIngresoMovimiento.monto)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA ACREDITACIÓN</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {formatIsoYmdDdMmYyyyArgentina(detalleIngresoMovimiento.fechaAcreditacionIso)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CX FINANCIERO</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {detalleIngresoMovimiento.costoFinanciero == null
                    ? ""
                    : `${detalleIngresoMovimiento.costoFinanciero.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}%`}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>MONTO A ACREDITAR</ModalMicroLabel>
                <p className="text-sm tabular-nums text-foreground">
                  ${fmtPrecio(detalleIngresoMovimiento.montoAcreditado)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CUENTA A ACREDITAR</ModalMicroLabel>
                <p className="text-sm text-foreground">{fmtCelda(detalleIngresoMovimiento.cajaEtiqueta)}</p>
              </div>
            </div>
          </AppModal>
        ) : null}
      </Dialog>
    </div>
  );
}
