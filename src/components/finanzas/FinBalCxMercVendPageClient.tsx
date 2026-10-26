"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutList, Store, Tags } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import CeldaVerComprobante from "@/components/finanzas/CeldaVerComprobante";
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
import {
  ETIQUETA_VISTA_CX_MERC_VEND,
  fmtCx,
  hrefCxMercVend,
  paramsCxMercVend,
} from "@/lib/balCxMercVend";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { VistaCxMercVend } from "@/lib/validations/balCxMercaderia";
import type { CxMercVendData } from "@/services/balCxMercaderia.service";

const BASE_PATH = APP_ROUTES.finanzas.balance.cxMercVend;

const ICONO_VISTA: Record<VistaCxMercVend, typeof Store> = {
  sucursal: Store,
  rubro: Tags,
  detalle: LayoutList,
};

const ORDEN_VISTAS: VistaCxMercVend[] = ["sucursal", "rubro", "detalle"];

interface Props {
  data: CxMercVendData;
}

export default function FinBalCxMercVendPageClient({ data }: Props) {
  const router = useRouter();
  const { filas, filtros, vista } = data;
  const params = paramsCxMercVend(filtros, data.periodoDefault);
  const [comprobanteVerId, setComprobanteVerId] = useState<string | null>(null);

  function cambiarVista(v: VistaCxMercVend) {
    router.push(
      hrefCxMercVend(BASE_PATH, paramsCxMercVend({ ...filtros, vista: v }, data.periodoDefault))
    );
  }

  /** VER de una fila resumida: detalle de ese mes (vista sucursal) o de ese rubro (vista rubro). */
  function verDetalleFila(clave: string) {
    const filtroFila = vista === "sucursal" ? { periodo: clave } : { rubro: clave };
    router.push(
      hrefCxMercVend(
        BASE_PATH,
        paramsCxMercVend({ ...filtros, ...filtroFila, vista: "detalle" }, data.periodoDefault)
      )
    );
  }

  return (
    <ClassicFilteredTableLayout
      title="FINANZAS"
      subtitle={`Cx Merc. Vend. · ${ETIQUETA_VISTA_CX_MERC_VEND[vista]}`}
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
                {ETIQUETA_VISTA_CX_MERC_VEND[v]}
              </Button>
            );
          })}
        </div>
      }
      filters={
        <FiltrosFinBalCx
          idPrefijo="cx-merc-vend"
          fechaDeshabilitada={vista === "sucursal"}
          periodos={data.periodos}
          sucursales={data.sucursales}
          grupo={{ placeholder: "RUBRO", ariaLabel: "Rubro", opciones: data.rubros }}
          placeholderBusqueda="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
          periodoDefault={data.periodoDefault}
          actual={{
            periodo: filtros.periodo,
            grupo: filtros.rubro,
            sucursal: filtros.sucursal,
            q: filtros.q,
          }}
          armarParams={({ grupo, ...f }) =>
            paramsCxMercVend({ vista, ...f, rubro: grupo }, data.periodoDefault)
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {data.resumen ? (
          <TablaResumenCxMercVend
            resumen={data.resumen}
            etiquetaFila={vista === "sucursal" ? "MES" : "RUBRO"}
            onVer={verDetalleFila}
          />
        ) : (
          <>
            <div className="contenedor-tabla-gestion min-h-0 flex-1">
              <Table variant="compact" className="tabla-gestion-compacta w-full">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">FECHA</TableHead>
                    <TableHead className="text-center">COD.</TableHead>
                    <TableHead>DESC.</TableHead>
                    <TableHead className="text-right">CX</TableHead>
                    <TableHead className="text-center">SUC</TableHead>
                    <TableHead className="text-center">ACCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.length === 0 ? (
                    <EmptyTableRow colSpan={6} message="No hay mercadería vendida para mostrar." />
                  ) : (
                    filas.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {formatIsoYmdDdMmYyyyArgentina(f.fechaIso)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {f.codItem}
                        </TableCell>
                        <TableCell className="celda-datos text-left">
                          {fmtCelda(f.descripcion)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "celda-datos celda-numero tabular-nums text-right",
                            f.esNotaCredito && "text-destructive"
                          )}
                        >
                          {fmtCx(f.cx)}
                        </TableCell>
                        <TableCell className="celda-datos text-center">
                          {f.sucursalNombre}
                        </TableCell>
                        <CeldaVerComprobante onVer={() => setComprobanteVerId(f.comprobanteVtaId)} />
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {data.total > 0 ? (
                  <TableFooter>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="celda-datos font-bold uppercase">
                        TOTAL CX
                      </TableCell>
                      <TableCell className="celda-datos celda-numero text-right font-bold tabular-nums">
                        {fmtCx(data.totalCx)}
                      </TableCell>
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
          </>
        )}
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
