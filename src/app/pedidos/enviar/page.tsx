import { getEnviarPedidoData, getEnviarPedidoTablaData } from "@/actions/pedidos";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { redirect } from "next/navigation";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltrosEnviarPedido from "@/components/pedidos/FiltrosEnviarPedido";
import GenerarPedidoToolbarButton from "@/components/pedidos/GenerarPedidoToolbarButton";
import {
  parseTiposParam,
  type SucursalPedido,
  type TipoPedido,
} from "@/lib/pedidos";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getPosicionIvaComparacionRevisionToken } from "@/services/finBalPosicionIvaComparacionRevision.service";
import PosicionIvaComparacionAutoRefresh from "@/components/pedidos/PosicionIvaComparacionAutoRefresh";

export const dynamic = "force-dynamic";

const MENSAJE_SIN_ITEMS_GLOBAL = "No hay ítems con cantidad a pedir.";
const MENSAJE_SIN_ITEMS_FILTRADO =
  "No hay ítems para generar el pedido con los filtros seleccionados.";
const COL_WIDTHS_PCT = [12, 12, 18, 48, 10] as const;

interface Props {
  searchParams: Promise<{
    sucursal?: string;
    proveedor?: string;
    tipo?: string;
    q?: string;
  }>;
}

export default async function EnviarPedidoPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) redirect(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);

  const { sucursal = "", proveedor = "", tipo = "", q = "" } = await searchParams;
  const sucursalesPedido = await prisma.sucursal.findMany({
    where: { pedido: true, codigo: { in: ["guaymallen", "maipu"] } },
    select: { codigo: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const sucursalesDisponibles = sucursalesPedido.map((s) => ({
    value: s.codigo as SucursalPedido,
    label: s.nombre.toUpperCase(),
  }));
  const codigosHabilitados = new Set(sucursalesPedido.map((s) => s.codigo));
  const sucursalValida: SucursalPedido | "" =
    (sucursal === "maipu" || sucursal === "guaymallen") && codigosHabilitados.has(sucursal)
      ? (sucursal as SucursalPedido)
      : "";
  const tiposValidos: TipoPedido[] = parseTiposParam(tipo);
  const qNorm = q.trim();

  const hayFiltroActivo =
    !!sucursalValida || !!proveedor.trim() || tiposValidos.length > 0 || !!qNorm;

  const [datosIniciales, tablaData, ivaComparacionRevisionToken] = await Promise.all([
    getEnviarPedidoData({
      sucursal: sucursalValida || undefined,
      tipos: tiposValidos.length > 0 ? tiposValidos : undefined,
    }),
    getEnviarPedidoTablaData({
      sucursal: sucursalValida,
      proveedor,
      tipos: tiposValidos,
      q: qNorm,
    }),
    getPosicionIvaComparacionRevisionToken(),
  ]);

  const { proveedores } = datosIniciales;
  const { items: itemsTabla } = tablaData;

  const filters = (
    <FiltrosEnviarPedido
      sucursal={sucursalValida}
      proveedor={proveedor}
      tipos={tiposValidos}
      proveedores={proveedores}
      sucursales={sucursalesDisponibles}
      q={qNorm}
    />
  );

  const actions = (
    <GenerarPedidoToolbarButton
      proveedores={proveedores}
      defaultSucursal={sucursalValida}
      defaultProveedor={proveedor}
      defaultTipos={tiposValidos}
      modulo="enviar"
    />
  );

  return (
    <>
      <PosicionIvaComparacionAutoRefresh initialToken={ivaComparacionRevisionToken} />
      <ClassicFilteredTableLayout
        title="Compras"
        subtitle="Generar Pedido"
        actions={actions}
        filters={filters}
      >
      <div className="flex h-full min-h-0 flex-col gap-0">
        <Card className="card-tabla-envoltorio">
          <CardContent className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
            <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
              <Table
                variant="compact"
                scrollX={false}
                className="tabla-gestion-compacta w-full table-fixed"
              >
                <colgroup>
                  {COL_WIDTHS_PCT.map((pct, i) => (
                    <col key={i} style={{ width: `${pct}%` }} />
                  ))}
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>TIPO PEDIDO</TableHead>
                    <TableHead>SUCURSAL</TableHead>
                    <TableHead className="min-w-0">PROVEEDOR</TableHead>
                    <TableHead className="min-w-0">DESCRIPCIÓN</TableHead>
                    <TableHead>CANT. PEDIR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsTabla.length === 0 ? (
                    <EmptyTableRow
                      colSpan={5}
                      message={
                        hayFiltroActivo ? MENSAJE_SIN_ITEMS_FILTRADO : MENSAJE_SIN_ITEMS_GLOBAL
                      }
                    />
                  ) : (
                    itemsTabla.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="celda-datos text-center">
                          {item.tipoPedido || ""}
                        </TableCell>
                        <TableCell className="celda-datos text-center">
                          {(item.sucursal || "").toUpperCase()}
                        </TableCell>
                        <TableCell className="celda-datos min-w-0 text-center text-xs">
                          <span className="line-clamp-2" title={item.proveedor || undefined}>
                            {item.proveedor || ""}
                          </span>
                        </TableCell>
                        <TableCell className="celda-datos min-w-0 text-foreground">
                          {item.descripcion || ""}
                        </TableCell>
                        <TableCell className="celda-datos celda-numero text-right">
                          {item.cantPedir.toLocaleString("es-AR")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      </ClassicFilteredTableLayout>
    </>
  );
}
