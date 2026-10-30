"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APP_ROUTES } from "@/lib/appRoutes";
import { fmtCx, hrefCxMercVend } from "@/lib/balCxMercVend";
import { cn } from "@/lib/utils";
import FacturaFiscalObligatoriaTabla from "@/components/vtas-cobros/FacturaFiscalObligatoriaTabla";
import PtoVtaFacturaTabla from "@/components/vtas-cobros/PtoVtaFacturaTabla";
import type { SumasBalIva } from "@/services/balIva.service";
import type { FacturaFiscalObligatoriaFila } from "@/services/facturaFiscalObligatoria.service";
import type { PtoVtaFacturaFila } from "@/services/ptoVtaFactura.service";
import type { SeguimientoFiscalData } from "@/services/seguimientoFiscal.service";

const BASE_PATH = APP_ROUTES.administrador.cobrosDesc.seguimientoFiscal;

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";
const ETIQUETA_SIN_TITULAR = "SIN TITULAR";

type Recomendacion = { accion: "FACTURAR" | "COBRAR"; monto: number } | null;

/** COBRO > VTAS. FISCALES → falta facturar; COBRO < VTAS. FISCALES → falta cobrar. */
function recomendacion(cobro: number, ventasFiscales: number): Recomendacion {
  const diferencia = Math.round((cobro - ventasFiscales) * 100) / 100;
  if (diferencia > 0) return { accion: "FACTURAR", monto: diferencia };
  if (diferencia < 0) return { accion: "COBRAR", monto: -diferencia };
  return null;
}

function CeldasRecomendacion({
  cobro,
  ventasFiscales,
  className,
}: {
  cobro: number;
  ventasFiscales: number;
  className?: string;
}) {
  const r = recomendacion(cobro, ventasFiscales);
  return (
    <>
      <TableCell className={cn("celda-datos text-center", className)}>
        {r?.accion ?? "—"}
      </TableCell>
      <TableCell className={cn(TD_NUM, className)}>{r ? fmtCx(r.monto) : "—"}</TableCell>
    </>
  );
}

/** Cuadrante de la matriz 2×2: barra con el nombre + contenido. */
function Cuadrante({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col gap-2" aria-label={titulo}>
      <h2 className="shrink-0 rounded-md bg-sidebar px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-sidebar-foreground">
        {titulo}
      </h2>
      <div className="contenedor-tabla-gestion min-h-0">{children}</div>
    </section>
  );
}

function FilaSaldoIva({ concepto, sumas }: { concepto: string; sumas: SumasBalIva }) {
  return (
    <TableRow>
      <TableCell className="celda-datos text-left font-medium">{concepto}</TableCell>
      <TableCell className={TD_NUM}>{fmtCx(sumas.debito)}</TableCell>
      <TableCell className={TD_NUM}>{fmtCx(sumas.credito)}</TableCell>
      <TableCell className={cn(TD_NUM, "font-semibold")}>{fmtCx(sumas.saldo)}</TableCell>
    </TableRow>
  );
}

interface Props {
  data: SeguimientoFiscalData;
  ptoVtaFactura: PtoVtaFacturaFila[];
  facturaObligatoria: FacturaFiscalObligatoriaFila[];
  esEditor: boolean;
}

export default function SeguimientoFiscalPageClient({
  data,
  ptoVtaFactura,
  facturaObligatoria,
  esEditor,
}: Props) {
  const router = useRouter();
  const { filas, filtros, periodoDefault, balanceIva } = data;
  const etiquetaMes =
    data.periodos.find((p) => p.value === filtros.periodo)?.label ?? filtros.periodo;

  function irAPeriodo(periodo: string) {
    router.push(hrefCxMercVend(BASE_PATH, periodo === periodoDefault ? {} : { periodo }));
  }

  return (
    <ClassicFilteredTableLayout
      title="Administrador"
      subtitle="Seguimiento Fiscal"
      contentWidth="full"
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
                    id="filtro-seguimiento-fiscal-fecha"
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
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:grid-rows-2">
        <Cuadrante titulo="BALANCE COBROS / FACTURAS">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>TITULAR</TableHead>
                <TableHead className="text-right">COBRO</TableHead>
                <TableHead className="text-right">VTAS. FISCALES</TableHead>
                <TableHead colSpan={2} className="text-center">
                  RECOMENDACIÓN
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <EmptyTableRow
                  colSpan={5}
                  message="No hay cobros con seguimiento fiscal ni ventas fiscales en este mes."
                />
              ) : (
                filas.map((fila) => (
                  <TableRow key={fila.titular ?? "__sin_titular__"}>
                    <TableCell
                      className={cn(
                        "celda-datos text-left font-medium",
                        fila.titular == null && "text-muted-foreground"
                      )}
                    >
                      {fila.titular ?? ETIQUETA_SIN_TITULAR}
                    </TableCell>
                    <TableCell className={TD_NUM}>{fmtCx(fila.cobro)}</TableCell>
                    <TableCell className={TD_NUM}>{fmtCx(fila.ventasFiscales)}</TableCell>
                    <CeldasRecomendacion
                      cobro={fila.cobro}
                      ventasFiscales={fila.ventasFiscales}
                      className="font-semibold"
                    />
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="celda-datos font-bold uppercase">TOTAL DEL MES</TableCell>
                <TableCell className={cn(TD_NUM, "font-bold")}>{fmtCx(data.totalCobro)}</TableCell>
                <TableCell className={cn(TD_NUM, "font-bold")}>
                  {fmtCx(data.totalVentasFiscales)}
                </TableCell>
                <CeldasRecomendacion
                  cobro={data.totalCobro}
                  ventasFiscales={data.totalVentasFiscales}
                  className="font-bold"
                />
              </TableRow>
            </TableFooter>
          </Table>
        </Cuadrante>
        <Cuadrante titulo="BALANCE IVA">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>CONCEPTO</TableHead>
                <TableHead className="text-right">DÉBITO</TableHead>
                <TableHead className="text-right">CRÉDITO</TableHead>
                <TableHead className="text-right">SALDO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <FilaSaldoIva
                concepto={`SALDO ANUAL ${balanceIva.anio}`}
                sumas={balanceIva.anual}
              />
              <FilaSaldoIva concepto={`SALDO MENSUAL ${etiquetaMes}`} sumas={balanceIva.mensual} />
            </TableBody>
          </Table>
        </Cuadrante>
        <Cuadrante titulo="FACTURA FISCAL OBLIGATORIA">
          <FacturaFiscalObligatoriaTabla filasIniciales={facturaObligatoria} esEditor={esEditor} />
        </Cuadrante>
        <Cuadrante titulo="PTOS VTAS SEGÚN TIPO FAC. & SUC.">
          <PtoVtaFacturaTabla filasIniciales={ptoVtaFactura} esEditor={esEditor} />
        </Cuadrante>
      </div>
    </ClassicFilteredTableLayout>
  );
}
