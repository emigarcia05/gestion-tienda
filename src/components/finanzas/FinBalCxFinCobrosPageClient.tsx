"use client";

import { useState } from "react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import CeldaVerComprobante from "@/components/finanzas/CeldaVerComprobante";
import FiltrosFinBalCx from "@/components/finanzas/FiltrosFinBalCx";
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
import { paramsCxFinCobros } from "@/lib/balCxFinCobros";
import { fmtCx } from "@/lib/balCxMercVend";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPorcentajeTabla } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { CxFinCobrosData } from "@/services/balCxFinCobros.service";

const BASE_PATH = APP_ROUTES.finanzas.balance.cxFinCobros;

const MENSAJE_VACIO = "No hay cobros con costo financiero para mostrar.";

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";

interface Props {
  data: CxFinCobrosData;
}

export default function FinBalCxFinCobrosPageClient({ data }: Props) {
  const { filas, filtros } = data;
  const params = paramsCxFinCobros(filtros, data.periodoDefault);
  const [comprobanteVerId, setComprobanteVerId] = useState<string | null>(null);

  return (
    <ClassicFilteredTableLayout
      title="FINANZAS"
      subtitle="Cx Fin Cobros"
      contentWidth="full"
      filters={
        <FiltrosFinBalCx
          idPrefijo="cx-fin-cobros"
          fechaDeshabilitada={false}
          periodos={data.periodos}
          sucursales={data.sucursales}
          grupo={{
            placeholder: "FORMA DE PAGO",
            ariaLabel: "Forma de pago",
            opciones: data.formasPago,
          }}
          placeholderBusqueda="BUSCAR POR CLIENTE..."
          periodoDefault={data.periodoDefault}
          actual={{
            periodo: filtros.periodo,
            grupo: filtros.pago,
            sucursal: filtros.sucursal,
            q: filtros.q,
          }}
          armarParams={({ grupo, ...f }) =>
            paramsCxFinCobros({ ...f, pago: grupo }, data.periodoDefault)
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col />
              <col className="w-[17%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">FECHA</TableHead>
                <TableHead className="text-center">COMPROBANTE</TableHead>
                <TableHead>CLIENTE</TableHead>
                <TableHead>FORMA DE PAGO</TableHead>
                <TableHead className="text-right">COBRADO</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">CX</TableHead>
                <TableHead className="text-center">SUC</TableHead>
                <TableHead className="text-center">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <EmptyTableRow colSpan={9} message={MENSAJE_VACIO} />
              ) : (
                filas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {formatIsoYmdDdMmYyyyArgentina(f.fechaIso)}
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {fmtCelda(f.comprobante)}
                    </TableCell>
                    <TableCell className="celda-datos text-left">{fmtCelda(f.cliente)}</TableCell>
                    <TableCell className="celda-datos text-left">{f.formaPago}</TableCell>
                    <TableCell className={cn(TD_NUM, f.esDevolucion && "text-destructive")}>
                      {fmtCx(f.cobrado)}
                    </TableCell>
                    <TableCell className={TD_NUM}>{fmtPorcentajeTabla(f.costoPct)}</TableCell>
                    <TableCell className={cn(TD_NUM, f.esDevolucion && "text-destructive")}>
                      {fmtCx(f.cx)}
                    </TableCell>
                    <TableCell className="celda-datos text-center">{f.sucursalNombre}</TableCell>
                    <CeldaVerComprobante onVer={() => setComprobanteVerId(f.comprobanteVtaId)} />
                  </TableRow>
                ))
              )}
            </TableBody>
            {data.total > 0 ? (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="celda-datos font-bold uppercase">
                    TOTAL CX
                  </TableCell>
                  <TableCell className={cn(TD_NUM, "font-bold")}>{fmtCx(data.totalCx)}</TableCell>
                  <TableCell colSpan={2} className="celda-datos" aria-hidden />
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
        {data.totalPaginas > 1 ? (
          <div className="flex justify-end pt-2 shrink-0">
            <PaginacionTabla
              basePath={BASE_PATH}
              params={params}
              paginaActual={filtros.pagina}
              totalPaginas={data.totalPaginas}
              total={data.total}
              pageSize={PAGE_SIZE}
            />
          </div>
        ) : null}
      </div>
      <FacturaComprobanteDetalleModal
        open={comprobanteVerId != null}
        onOpenChange={(open) => {
          if (!open) setComprobanteVerId(null);
        }}
        comprobanteId={comprobanteVerId}
      />
    </ClassicFilteredTableLayout>
  );
}
