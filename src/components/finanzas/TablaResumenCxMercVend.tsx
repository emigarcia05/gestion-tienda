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
import CeldaVerComprobante from "@/components/finanzas/CeldaVerComprobante";
import { fmtCx } from "@/lib/balCxMercVend";
import { cn } from "@/lib/utils";
import type { ResumenCxMercVend } from "@/services/balCxMercaderia.service";

interface Props {
  resumen: ResumenCxMercVend;
  /** Encabezado de la columna de filas (`MES` / `RUBRO` / `FORMA DE PAGO`). */
  etiquetaFila: string;
  mensajeVacio?: string;
  /** Columna **ACCIONES** con VER por fila (abre el detalle de esa fila); deshabilitado sin movimientos. */
  onVer?: (clave: string) => void;
}

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";

/** Matriz filas × sucursales de Cx Merc. Vend. y Cx Fin Cobros. */
export default function TablaResumenCxMercVend({
  resumen,
  etiquetaFila,
  mensajeVacio = "No hay mercadería vendida para mostrar.",
  onVer,
}: Props) {
  const { columnas, filas, totales } = resumen;
  const pctFila = 18;
  const pctTotal = 14;
  const pctAcciones = onVer ? 8 : 0;
  const pctSuc =
    columnas.length > 0 ? (100 - pctFila - pctTotal - pctAcciones) / columnas.length : 0;
  const colSpan = 2 + columnas.length + (onVer ? 1 : 0);

  return (
    <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
      <Table variant="compact" scrollX={false} className="tabla-gestion-compacta w-full table-fixed">
        <colgroup>
          <col style={{ width: `${pctFila}%` }} />
          <col style={{ width: `${pctTotal}%` }} />
          {columnas.map((c) => (
            <col key={c.value} style={{ width: `${pctSuc}%` }} />
          ))}
          {onVer ? <col style={{ width: `${pctAcciones}%` }} /> : null}
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{etiquetaFila}</TableHead>
            <TableHead className="text-right">TOTAL</TableHead>
            {columnas.map((c) => (
              <TableHead key={c.value} className="text-right">
                {c.label}
              </TableHead>
            ))}
            {onVer ? <TableHead className="text-center">ACCIONES</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <EmptyTableRow colSpan={colSpan} message={mensajeVacio} />
          ) : (
            filas.map((f) => {
              const conMovimiento = Object.keys(f.porSucursal).length > 0;
              return (
                <TableRow key={f.clave}>
                  <TableCell className="celda-datos font-medium">{f.etiqueta}</TableCell>
                  <TableCell className={cn(TD_NUM, "celda-destacado")}>
                    {conMovimiento ? fmtCx(f.total) : ""}
                  </TableCell>
                  {columnas.map((c) => {
                    const v = f.porSucursal[c.value];
                    return (
                      <TableCell key={c.value} className={TD_NUM}>
                        {v === undefined ? "" : fmtCx(v)}
                      </TableCell>
                    );
                  })}
                  {onVer ? (
                    <CeldaVerComprobante
                      onVer={conMovimiento ? () => onVer(f.clave) : undefined}
                      titulo="Ver comprobantes"
                      tituloDeshabilitado="Sin movimientos"
                    />
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
        {filas.length > 0 ? (
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="celda-datos font-bold uppercase">TOTAL</TableCell>
              <TableCell className={cn(TD_NUM, "font-bold")}>{fmtCx(totales.total)}</TableCell>
              {columnas.map((c) => (
                <TableCell key={c.value} className={cn(TD_NUM, "font-bold")}>
                  {fmtCx(totales.porSucursal[c.value] ?? 0)}
                </TableCell>
              ))}
              {onVer ? <TableCell className="celda-datos" aria-hidden /> : null}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
