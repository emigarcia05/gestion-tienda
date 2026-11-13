import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Wallet } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { hrefCuentaCorrienteCliente } from "@/lib/facturacionRoutes";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
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
  TableroPendienteLinea,
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
    if (referencia === "ayer") return "Sin ventas ayer";
    if (referencia === "el promedio") return "Sin promedio";
    return "Sin ventas el mes anterior";
  }
  return `${comparacion.pct}% que ${referencia}`;
}

function LineaComparacion({
  comparacion,
  referencia,
  className,
}: {
  comparacion: ComparacionVentas;
  referencia: string;
  className?: string;
}) {
  const Icono = comparacion.sentido === "menos" ? ArrowDown : ArrowUp;
  const muestraFlecha = comparacion.sentido === "menos" || comparacion.sentido === "mas";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 text-[0.65rem] font-semibold uppercase leading-tight tracking-wide",
        className
      )}
    >
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
      <LineaComparacion
        comparacion={montos.comparacionPromedio}
        referencia="el promedio"
        className="mb-[0.35rem]"
      />
      <span className="text-[0.7rem] font-semibold uppercase leading-tight tracking-wide">
        {textoCobrado(montos.pctCobrado)}
      </span>
    </div>
  );
}

const RECUADRO_PENDIENTE_CLASS =
  "flex min-h-0 flex-col gap-1 overflow-hidden rounded-md border border-border bg-card p-2";

function hrefPedirMercaderiaPendiente(linea: TableroPendienteLinea, sucursal: string): string | null {
  const sep = linea.id.indexOf(":");
  if (sep <= 0) return null;
  if (sucursal !== "guaymallen" && sucursal !== "maipu") return null;
  const params = new URLSearchParams({
    sucursal,
    proveedor: linea.id.slice(0, sep),
    pedido: "todos",
  });
  return `${GP_ROUTES.pedidoMercaderia.pedirMercaderia}?${params.toString()}`;
}

function hrefComprasEmitidasPendiente(linea: TableroPendienteLinea, sucursal: string): string | null {
  if (sucursal !== "guaymallen" && sucursal !== "maipu") return null;
  const proveedorId = linea.id.trim();
  if (!proveedorId) return null;
  const params = new URLSearchParams({ sucursal, proveedor: proveedorId });
  return `${GP_ROUTES.pedidoMercaderia.recepcionPedido}?${params.toString()}`;
}
function ListaPendientes({
  titulo,
  lineas,
  hrefDe,
  enlaceNombre,
}: {
  titulo: string;
  lineas: TableroPendienteLinea[];
  hrefDe?: (linea: TableroPendienteLinea) => string | null;
  enlaceNombre: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-1">
      <p className="shrink-0 text-center text-[10px] font-bold uppercase tracking-wide">{titulo}</p>
      <ul className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-auto">
        {lineas.length === 0 ? (
          <li className="text-center text-xs text-muted-foreground">Sin pendientes</li>
        ) : (
          lineas.map((linea) => {
            const href = hrefDe?.(linea) ?? null;
            return (
              <li key={linea.id} className="flex w-full min-w-0 items-center justify-center gap-1">
                <span className="truncate text-center text-xs font-semibold" title={linea.etiqueta}>
                  {linea.etiqueta}
                </span>
                {href ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="tablero-grafico-filtro w-fit min-w-0 shrink-0"
                  >
                    <Link
                      href={href}
                      title={`Ir a ${enlaceNombre}`}
                      aria-label={`${enlaceNombre} de ${linea.etiqueta}`}
                    >
                      <ExternalLink aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function PendientesSucursalTablero({
  envios,
  generacion,
  recepcion,
  sucursalCodigo,
}: {
  envios: number;
  generacion: TableroPendienteLinea[];
  recepcion: TableroPendienteLinea[];
  sucursalCodigo: string | null;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,4fr)] gap-2 overflow-hidden">
      <div className={cn(RECUADRO_PENDIENTE_CLASS, "flex-row items-center justify-center gap-3")}>
        <h3 className="text-xs font-bold uppercase tracking-wide">Envios pendientes</h3>
        <p className="text-xl font-bold tabular-nums leading-none">{envios}</p>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="tablero-grafico-filtro w-fit min-w-0"
        >
          <Link
            href={GP_ROUTES.envios.programados}
            title="Ir a Envios"
            aria-label="Ir a Envios"
          >
            <ExternalLink aria-hidden />
          </Link>
        </Button>
      </div>
      <div className={RECUADRO_PENDIENTE_CLASS}>
        <h3 className="shrink-0 text-center text-xs font-bold uppercase tracking-wide">
          Pedidos pendientes
        </h3>
        <div className="h-px w-full shrink-0 bg-primary/40" aria-hidden />
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-3">
          <ListaPendientes
            titulo="Pendiente emision"
            lineas={generacion}
            hrefDe={
              sucursalCodigo
                ? (linea) => hrefPedirMercaderiaPendiente(linea, sucursalCodigo)
                : undefined
            }
            enlaceNombre="Pedir Mercadería"
          />
          <div className="h-full w-px bg-primary/40" aria-hidden />
          <ListaPendientes
            titulo="Pendiente de recepción"
            lineas={recepcion}
            enlaceNombre="Compras emitidas"
            hrefDe={
              sucursalCodigo
                ? (linea) => hrefComprasEmitidasPendiente(linea, sucursalCodigo)
                : undefined
            }
          />
        </div>
      </div>
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
            <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
              <MetricasVentas montos={datos.sucursal} />
              <PendientesSucursalTablero
                envios={datos.enviosPendientesHoy}
                generacion={datos.pedidosGeneracion}
                recepcion={datos.pedidosRecepcion}
                sucursalCodigo={datos.sucursalCodigo}
              />
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
            <div className="flex min-h-0 min-w-0 flex-col gap-2">
              <MetricasVentas montos={datos.globales} />
              <ParticipacionTablero filas={datos.participacionSucursales} />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col">
              <GraficoMesesTablero series={datos.seriesMeses} seriesDias={datos.seriesDias} />
            </div>
          </div>
        </section>
        )}
      </div>
    </ClassicFilteredTableLayout>
  );
}
