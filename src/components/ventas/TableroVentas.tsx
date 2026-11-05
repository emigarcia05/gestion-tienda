import Link from "next/link";
import { ArrowDown, ArrowUp, Wallet } from "lucide-react";
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
import GraficoMesesTablero from "@/components/ventas/GraficoMesesTablero";
import ParticipacionTablero from "@/components/ventas/ParticipacionTablero";
import type { VistaTablero } from "@/lib/usuarios";
import type {
  ComparacionVentas,
  TableroVentasDatos,
  TableroVentasMontos,
} from "@/services/tableroVentas.service";

const TITULO_SECCION_CLASS =
  "rounded-md bg-sidebar px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-sidebar-foreground";

function pesos(n: number): string {
  return `$${fmtPrecio(n)}`;
}

function textoComparacion(comparacion: ComparacionVentas, referencia: string): string {
  if (comparacion.sentido === "igual") return `Igual que ${referencia}`;
  if (comparacion.sentido === "sin_base") {
    return referencia === "ayer" ? "Sin ventas ayer" : "Sin ventas el mes anterior";
  }
  return `${comparacion.pct}% que ${referencia}`;
}

function LineaComparacion({
  comparacion,
  referencia,
}: {
  comparacion: ComparacionVentas;
  referencia: string;
}) {
  const Icono = comparacion.sentido === "menos" ? ArrowDown : ArrowUp;
  const muestraFlecha = comparacion.sentido === "menos" || comparacion.sentido === "mas";
  return (
    <span className="mb-[0.35rem] inline-flex items-center justify-center gap-1 text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
      {muestraFlecha ? <Icono className="h-2.5 w-2.5 shrink-0" aria-hidden /> : null}
      {textoComparacion(comparacion, referencia)}
    </span>
  );
}

function textoCobrado(pct: number | null): string {
  if (pct == null) return "Cobros sin ventas";
  return `${pct}% cobrado`;
}

function TarjetaPeriodo({
  label,
  montos,
  referencia,
}: {
  label: string;
  montos: TableroVentasMontos;
  referencia: string;
}) {
  return (
    <div className="finanzas-resumen-tarjeta py-[0.35rem]">
      <span className="mb-[0.35rem] text-[0.7rem] font-semibold uppercase leading-tight tracking-wide">
        {label}
      </span>
      <span className="text-[1.05rem] font-bold tabular-nums leading-none">{pesos(montos.ventas)}</span>
      <LineaComparacion comparacion={montos.comparacion} referencia={referencia} />
      <span className="text-[0.7rem] font-semibold uppercase leading-tight tracking-wide">
        {textoCobrado(montos.pctCobrado)}
      </span>
    </div>
  );
}

function MetricasVentas({ montos }: { montos: { dia: TableroVentasMontos; mes: TableroVentasMontos } }) {
  return (
    <div className="grid w-full shrink-0 grid-cols-2 gap-3">
      <TarjetaPeriodo label="Día" montos={montos.dia} referencia="ayer" />
      <TarjetaPeriodo label="Mes" montos={montos.mes} referencia="el mes anterior" />
    </div>
  );
}

export default function TableroVentas({
  datos,
  error,
  vista = "gerente",
}: {
  datos: TableroVentasDatos;
  error?: string;
  /** `vendedor` oculta Ventas globales. */
  vista?: VistaTablero;
}) {
  const tituloSucursal = datos.sucursalNombre
    ? `Ventas sucursal · ${datos.sucursalNombre}`
    : "Ventas sucursal";

  return (
    <ClassicFilteredTableLayout title="Ventas" subtitle="Tablero" contentWidth="full">
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
        <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label={tituloSucursal}>
          <h2 className={TITULO_SECCION_CLASS}>{tituloSucursal}</h2>
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 gap-4">
            <div className="flex min-h-0 min-w-0 flex-col gap-2">
              <MetricasVentas montos={datos.sucursal} />
              <GraficoMesesTablero series={datos.seriesMeses} />
            </div>
            <div className="flex min-h-0 flex-col">
              <div className="contenedor-tabla-gestion min-h-0 flex-1" aria-label="Clientes con saldos vencidos">
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
        {vista === "vendedor" ? null : (
        <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Ventas globales">
          <h2 className={TITULO_SECCION_CLASS}>Ventas globales</h2>
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 gap-4">
            <div className="flex min-h-0 items-center">
              <MetricasVentas montos={datos.globales} />
            </div>
            <ParticipacionTablero filas={datos.participacionSucursales} />
          </div>
        </section>
        )}
      </div>
    </ClassicFilteredTableLayout>
  );
}
