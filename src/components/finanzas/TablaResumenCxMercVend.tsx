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
import { fmtCx } from "@/lib/balCxMercVend";
import { cn } from "@/lib/utils";
import type { ResumenCxMercVend } from "@/services/balCxMercaderia.service";

interface Props {
  resumen: ResumenCxMercVend;
  /** Encabezado de la columna de filas (`MES` / `RUBRO` / `FORMA DE PAGO`). */
  etiquetaFila: string;
  mensajeVacio?: string;
}

const TD_NUM = "celda-datos celda-numero tabular-nums text-right";

/** Matriz filas × sucursales de Cx Merc. Vend. y Cx Fin Cobros. */
export default function TablaResumenCxMercVend({
  resumen,
  etiquetaFila,
  mensajeVacio = "No hay mercadería vendida para mostrar.",
}: Props) {
  const { columnas, filas, totales } = resumen;
  const pctFila = 18;
  const pctTotal = 14;
  const pctSuc = columnas.length > 0 ? (100 - pctFila - pctTotal) / columnas.length : 0;
  const colSpan = 2 + columnas.length;

  return (
    <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
      <Table variant="compact" scrollX={false} className="tabla-gestion-compacta w-full table-fixed">
        <colgroup>
          <col style={{ width: `${pctFila}%` }} />
          <col style={{ width: `${pctTotal}%` }} />
          {columnas.map((c) => (
            <col key={c.value} style={{ width: `${pctSuc}%` }} />
          ))}
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
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
