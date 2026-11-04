import Link from "next/link";
import { Wallet } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import { Button } from "@/components/ui/button";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPrecio } from "@/lib/format";
import { hrefCuentaCorrienteCliente } from "@/lib/facturacionRoutes";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { TableroVentasDatos, TableroVentasMontos } from "@/services/tableroVentas.service";

const TITULO_SECCION_CLASS =
  "rounded-md bg-sidebar px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-sidebar-foreground";

function pesos(n: number): string {
  return `$${fmtPrecio(n)}`;
}

function MetricasVentas({ montos }: { montos: { dia: TableroVentasMontos; mes: TableroVentasMontos } }) {
  const celdas = [
    { label: "Ventas del día", valor: montos.dia.ventas },
    { label: "Cobrado del día", valor: montos.dia.cobrado },
    { label: "Ventas del mes", valor: montos.mes.ventas },
    { label: "Cobrado del mes", valor: montos.mes.cobrado },
  ];
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-center text-xs font-bold uppercase tracking-wide">Ventas</h3>
      <div className="grid grid-cols-2 gap-3">
        {celdas.map((celda) => (
          <div key={celda.label} className="finanzas-resumen-tarjeta min-h-16">
            <span className="text-[10px] font-semibold uppercase tracking-wide">{celda.label}</span>
            <span className="text-sm font-semibold tabular-nums">{pesos(celda.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TableroVentas({
  datos,
  error,
}: {
  datos: TableroVentasDatos;
  error?: string;
}) {
  const tituloSucursal = datos.sucursalNombre
    ? `Ventas sucursal · ${datos.sucursalNombre}`
    : "Ventas sucursal";

  return (
    <ClassicFilteredTableLayout title="Ventas" subtitle="Tablero" contentWidth="full">
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <section className="flex flex-col gap-3" aria-label={tituloSucursal}>
          <h2 className={TITULO_SECCION_CLASS}>{tituloSucursal}</h2>
          <div className="grid grid-cols-2 gap-4">
            <MetricasVentas montos={datos.sucursal} />
            <div className="flex min-h-0 flex-col gap-3">
              <h3 className="text-center text-xs font-bold uppercase tracking-wide">
                Clientes con saldos vencidos
              </h3>
              <div className="contenedor-tabla-gestion max-h-80 min-h-0 overflow-auto">
                <Table>
                  <colgroup>
                    <col style={{ width: "62%" }} />
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Saldo vencido</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.clientesVencidos.length === 0 ? (
                      <EmptyTableRow colSpan={3} message="No hay clientes con saldo vencido." />
                    ) : (
                      datos.clientesVencidos.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="truncate" title={cliente.nombre}>
                            {cliente.nombre}
                          </TableCell>
                          <TableCell className="tabular-nums">{pesos(cliente.saldoVencido)}</TableCell>
                          <TableCell>
                            <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              >
                                <Link
                                  href={hrefCuentaCorrienteCliente(cliente.id)}
                                  title="Cuenta corriente"
                                  aria-label={`Cuenta corriente de ${cliente.nombre}`}
                                >
                                  <Wallet className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3" aria-label="Ventas globales">
          <h2 className={TITULO_SECCION_CLASS}>Ventas globales</h2>
          <div className="grid grid-cols-2 gap-4">
            <MetricasVentas montos={datos.globales} />
            <div aria-hidden />
          </div>
        </section>
      </div>
    </ClassicFilteredTableLayout>
  );
}
