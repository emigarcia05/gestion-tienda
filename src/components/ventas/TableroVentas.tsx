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
import type {
  ComparacionVentas,
  TableroVentasDatos,
  TableroVentasMontos,
  TableroVentasParticipacion,
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
    <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase leading-tight tracking-wide">
      {muestraFlecha ? <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
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
    <div className="finanzas-resumen-tarjeta min-h-16">
      <span className="text-base font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold tabular-nums leading-none">{pesos(montos.ventas)}</span>
      <LineaComparacion comparacion={montos.comparacion} referencia={referencia} />
      <span className="text-base font-semibold uppercase leading-tight tracking-wide">
        {textoCobrado(montos.pctCobrado)}
      </span>
    </div>
  );
}

function BarraParticipacion({ pct, tono }: { pct: number; tono: "mes" | "anio" }) {
  const ancho = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-3 min-w-0 flex-1 rounded-sm bg-muted" aria-hidden>
        <div
          className={tono === "mes" ? "h-full rounded-sm bg-primary" : "h-full rounded-sm bg-accent2"}
          style={{ width: `${ancho}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

function BarrasParticipacion({ filas }: { filas: TableroVentasParticipacion[] }) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <h3 className="text-center text-xs font-bold uppercase tracking-wide">Participación</h3>
      <div className="flex items-center justify-center gap-4">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
          Mes
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent2" aria-hidden />
          Año
        </span>
      </div>
      {filas.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Sin ventas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((fila) => (
            <li key={fila.id} className="flex min-w-0 items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs font-semibold" title={fila.nombre}>
                {fila.nombre}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <BarraParticipacion pct={fila.pctMes} tono="mes" />
                <BarraParticipacion pct={fila.pctAnio} tono="anio" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricasVentas({ montos }: { montos: { dia: TableroVentasMontos; mes: TableroVentasMontos } }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TarjetaPeriodo label="Día" montos={montos.dia} referencia="ayer" />
      <TarjetaPeriodo label="Mes" montos={montos.mes} referencia="el mes anterior" />
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
            <div className="flex min-w-0 flex-col gap-3">
              <MetricasVentas montos={datos.globales} />
              <GraficoMesesTablero series={datos.seriesMeses} />
            </div>
            <BarrasParticipacion filas={datos.participacionSucursales} />
          </div>
        </section>
      </div>
    </ClassicFilteredTableLayout>
  );
}
