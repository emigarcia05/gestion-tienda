"use client";

import { Fragment } from "react";
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
import type { SeguimientoFiscalData } from "@/services/seguimientoFiscal.service";

const BASE_PATH = APP_ROUTES.administrador.cobrosDesc.seguimientoFiscal;

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";
const ETIQUETA_SIN_PTO_VTA = "SIN PTO. VTA.";

interface Props {
  data: SeguimientoFiscalData;
}

export default function SeguimientoFiscalPageClient({ data }: Props) {
  const router = useRouter();
  const { grupos, filtros, periodoDefault } = data;

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
      <div className="contenedor-tabla-gestion min-h-0 flex-1">
        <Table variant="compact" className="tabla-gestion-compacta w-full">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[14%]" />
            <col />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>TITULAR</TableHead>
              <TableHead className="text-center">PTOS. VTA.</TableHead>
              <TableHead>FORMA DE PAGO</TableHead>
              <TableHead>ENTIDAD</TableHead>
              <TableHead className="text-right">CANT.</TableHead>
              <TableHead className="text-right">MONTO COBRADO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.length === 0 ? (
              <EmptyTableRow
                colSpan={6}
                message="No hay cobros con seguimiento fiscal en este mes."
              />
            ) : (
              grupos.map((grupo) => {
                const titular = grupo.titular ?? ETIQUETA_SIN_PTO_VTA;
                return (
                  <Fragment key={grupo.titular ?? "__sin_pto_vta__"}>
                    {grupo.formas.map((forma, i) => (
                      <TableRow key={forma.clave}>
                        {i === 0 ? (
                          <>
                            <TableCell
                              rowSpan={grupo.formas.length}
                              className={cn(
                                "celda-datos text-left font-medium",
                                grupo.titular == null && "text-muted-foreground"
                              )}
                            >
                              {titular}
                            </TableCell>
                            <TableCell
                              rowSpan={grupo.formas.length}
                              className="celda-datos text-center tabular-nums"
                            >
                              {grupo.ptosVenta.length > 0 ? grupo.ptosVenta.join(", ") : "—"}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className="celda-datos text-left">{forma.formaNombre}</TableCell>
                        <TableCell className="celda-datos text-left">
                          {forma.entidadNombre || "—"}
                        </TableCell>
                        <TableCell className={TD_NUM}>{forma.cantidad}</TableCell>
                        <TableCell className={TD_NUM}>{fmtCx(forma.monto)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/35 hover:bg-muted/35">
                      <TableCell colSpan={4} className="celda-datos font-bold uppercase">
                        TOTAL {titular}
                      </TableCell>
                      <TableCell className={cn(TD_NUM, "font-bold")}>
                        {grupo.formas.reduce((acc, f) => acc + f.cantidad, 0)}
                      </TableCell>
                      <TableCell className={cn(TD_NUM, "font-bold")}>
                        {fmtCx(grupo.total)}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="celda-datos font-bold uppercase">
                TOTAL DEL MES
              </TableCell>
              <TableCell className={cn(TD_NUM, "font-bold")}>{fmtCx(data.total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </ClassicFilteredTableLayout>
  );
}
