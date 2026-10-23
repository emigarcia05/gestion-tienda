"use client";

import { useRouter } from "next/navigation";
import { CreditCard, LayoutList, Store } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import FiltrosFinBalCx from "@/components/finanzas/FiltrosFinBalCx";
import TablaResumenCxMercVend from "@/components/finanzas/TablaResumenCxMercVend";
import { Button } from "@/components/ui/button";
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
import { ETIQUETA_VISTA_CX_FIN_COBROS, paramsCxFinCobros } from "@/lib/balCxFinCobros";
import { fmtCx, hrefCxMercVend } from "@/lib/balCxMercVend";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPorcentajeTabla } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { VistaCxFinCobros } from "@/lib/validations/balCxFinanciero";
import type { CxFinCobrosData } from "@/services/balCxFinCobros.service";

const BASE_PATH = APP_ROUTES.finanzas.balance.cxFinCobros;

const ICONO_VISTA: Record<VistaCxFinCobros, typeof Store> = {
  sucursal: Store,
  forma: CreditCard,
  detalle: LayoutList,
};

const ORDEN_VISTAS: VistaCxFinCobros[] = ["sucursal", "forma", "detalle"];

const MENSAJE_VACIO = "No hay cobros con costo financiero para mostrar.";

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";

interface Props {
  data: CxFinCobrosData;
}

export default function FinBalCxFinCobrosPageClient({ data }: Props) {
  const router = useRouter();
  const { filas, filtros, vista } = data;
  const params = paramsCxFinCobros(filtros, data.periodoDefault);

  function cambiarVista(v: VistaCxFinCobros) {
    router.push(
      hrefCxMercVend(BASE_PATH, paramsCxFinCobros({ ...filtros, vista: v }, data.periodoDefault))
    );
  }

  return (
    <ClassicFilteredTableLayout
      title="FINANZAS"
      subtitle={`Cx Fin Cobros · ${ETIQUETA_VISTA_CX_FIN_COBROS[vista]}`}
      contentWidth="full"
      actions={
        <div className="flex items-center gap-2">
          {ORDEN_VISTAS.map((v) => {
            const Icono = ICONO_VISTA[v];
            return (
              <Button
                key={v}
                type="button"
                className="h-10 gap-2 px-4"
                disabled={v === vista}
                aria-current={v === vista ? "page" : undefined}
                onClick={() => cambiarVista(v)}
              >
                <Icono className="size-4 shrink-0" aria-hidden />
                {ETIQUETA_VISTA_CX_FIN_COBROS[v]}
              </Button>
            );
          })}
        </div>
      }
      filters={
        <FiltrosFinBalCx
          idPrefijo="cx-fin-cobros"
          fechaDeshabilitada={vista === "sucursal"}
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
            paramsCxFinCobros({ vista, ...f, pago: grupo }, data.periodoDefault)
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {data.resumen ? (
          <TablaResumenCxMercVend
            resumen={data.resumen}
            etiquetaFila={vista === "sucursal" ? "MES" : "FORMA DE PAGO"}
            mensajeVacio={MENSAJE_VACIO}
          />
        ) : (
          <>
            <div className="contenedor-tabla-gestion min-h-0 flex-1">
              <Table variant="compact" className="tabla-gestion-compacta w-full">
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[13%]" />
                  <col />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[7%]" />
                  <col className="w-[9%]" />
                  <col className="w-[11%]" />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.length === 0 ? (
                    <EmptyTableRow colSpan={8} message={MENSAJE_VACIO} />
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
                      <TableCell className="celda-datos" aria-hidden />
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
          </>
        )}
      </div>
    </ClassicFilteredTableLayout>
  );
}
