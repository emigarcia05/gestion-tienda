"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import GenerarPedidoToolbarButton from "@/components/pedidos/GenerarPedidoToolbarButton";
import TablaPedirMercaderia from "@/components/pedidos/TablaPedirMercaderia";
import CantPedirMercaderiaModal from "@/components/pedidos/CantPedirMercaderiaModal";
import ConfigurarReposicionModal from "@/components/pedidos/ConfigurarReposicionModal";
import PosicionIvaComparacionAutoRefresh from "@/components/pedidos/PosicionIvaComparacionAutoRefresh";
import { upsertPedidoUrgenteMercaderiaItemAction } from "@/actions/pedidos";
import type { ItemReposicion } from "@/actions/reposicion";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  cantidadesUrgenteDesdeProductos,
  limpiarCantidadesUrgenteVisibles,
} from "@/lib/pedidoUrgenteCantidades";
import {
  MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE,
  MENSAJE_SIN_SUCURSAL_PEDIDO_URGENTE,
  type TipoPedido,
} from "@/lib/pedidos";
import { normalizarReposicionFormaPedido } from "@/lib/validations/reposicion";
import type { PedidoUrgenteItem } from "@/services/listaPrecios.service";

const TIPOS_GENERAR_PEDIDO: TipoPedido[] = ["URGENTE", "REPOSICION"];
/** Espera al cierre animado de un `Dialog` antes de abrir otro (no apilar modales). */
const MS_ENTRE_MODALES = 300;

interface Props {
  filters: React.ReactNode;
  productos: PedidoUrgenteItem[];
  proveedores: { id: string; nombre: string; prefijo: string }[];
  sucursalValida: "" | "guaymallen" | "maipu";
  /** True cuando no se puede listar (falta sucursal o el segundo filtro). */
  sinFiltros: boolean;
  tieneSucursal: boolean;
  pedidoValida: "cualquier" | "urgente" | "reposicion" | "";
  total: number;
  totalPaginas: number;
  paginaNum: number;
  proveedor: string;
  q: string;
  ivaSaldoAcumuladoComparacion: number;
  ivaComparacionRevisionToken: string;
}

function itemReposicionDesdeProducto(prod: PedidoUrgenteItem): ItemReposicion {
  const regla = prod.reposicionRegla;
  return {
    idListaTienda: prod.codTienda,
    codExt: prod.codExt,
    codTienda: prod.codTienda,
    descripcionTienda: prod.descripcion,
    stock: prod.stockTienda,
    idProveedor: null,
    nombreProveedor: null,
    idReposicion: regla?.idReposicion ?? null,
    formaPedir: normalizarReposicionFormaPedido(regla?.formaPedir) ?? "",
    puntoReposicion: regla?.puntoReposicion ?? 0,
    cant: regla?.cantConf ?? 0,
    cantPedidaReposicion: prod.cantReposicion,
    cantPedir: prod.cantReposicion,
    bulto: prod.bultoTienda,
  };
}

export default function PedirMercaderiaPageClient({
  filters,
  productos,
  proveedores,
  sucursalValida,
  sinFiltros,
  tieneSucursal,
  pedidoValida,
  total,
  totalPaginas,
  paginaNum,
  proveedor,
  q,
  ivaSaldoAcumuladoComparacion,
  ivaComparacionRevisionToken,
}: Props) {
  const [cantPorId, setCantPorId] = useState<Record<string, string>>({});
  const [productoModal, setProductoModal] = useState<PedidoUrgenteItem | null>(null);
  const [modalCantOpen, setModalCantOpen] = useState(false);
  const [itemReposicion, setItemReposicion] = useState<ItemReposicion | null>(null);
  const [modalRepoOpen, setModalRepoOpen] = useState(false);
  const timerModalRef = useRef<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (productos.length === 0) {
        setCantPorId({});
        return;
      }
      setCantPorId((prev) => ({ ...prev, ...cantidadesUrgenteDesdeProductos(productos) }));
    });
  }, [productos]);

  useEffect(
    () => () => {
      if (timerModalRef.current != null) window.clearTimeout(timerModalRef.current);
    },
    []
  );

  function abrirCantidad(prod: PedidoUrgenteItem) {
    setProductoModal(prod);
    setModalCantOpen(true);
  }

  function abrirConfigurarReposicion(prod: PedidoUrgenteItem) {
    if (!sucursalValida || !prod.codTienda) return;
    setModalCantOpen(false);
    setItemReposicion(itemReposicionDesdeProducto(prod));
    timerModalRef.current = window.setTimeout(() => setModalRepoOpen(true), MS_ENTRE_MODALES);
  }

  async function guardarUrgente(cambios: Record<string, number>): Promise<boolean> {
    if (!sucursalValida) {
      toast.error("Seleccioná una sucursal para guardar.");
      return false;
    }
    const codExts = Object.keys(cambios);
    const previos: Record<string, string> = {};
    for (const ce of codExts) previos[ce] = cantPorId[ce] ?? "";
    setCantPorId((prev) => {
      const next = { ...prev };
      for (const ce of codExts) next[ce] = cambios[ce]! > 0 ? String(cambios[ce]) : "";
      return next;
    });

    for (const ce of codExts) {
      const res = await upsertPedidoUrgenteMercaderiaItemAction({
        sucursal: sucursalValida,
        listaPrecioProveedorId: ce,
        cant: cambios[ce]!,
      });
      if (!res.ok) {
        setCantPorId((prev) => ({ ...prev, ...previos }));
        toast.error(res.error ?? "Error al guardar.");
        return false;
      }
    }
    toast.success("Cantidad guardada.");
    return true;
  }

  const actions = (
    <GenerarPedidoToolbarButton
      proveedores={proveedores}
      defaultSucursal={sucursalValida}
      defaultProveedor={proveedor}
      defaultTipos={TIPOS_GENERAR_PEDIDO}
      modulo="enviar"
      onGeneradoExito={() => {
        setCantPorId((prev) => limpiarCantidadesUrgenteVisibles(productos, prev));
      }}
    />
  );

  return (
    <>
      <PosicionIvaComparacionAutoRefresh initialToken={ivaComparacionRevisionToken} />
      <ClassicFilteredTableLayout
        title="Compras"
        subtitle="Pedir Mercadería"
        actions={actions}
        filters={filters}
      >
        <div className="flex h-full min-h-0 flex-col gap-0.5">
          <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
            <TablaPedirMercaderia
              productos={productos}
              sinFiltros={sinFiltros}
              mensajeSinFiltros={
                tieneSucursal ? MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE : MENSAJE_SIN_SUCURSAL_PEDIDO_URGENTE
              }
              cantPorId={cantPorId}
              onAbrirCantidad={abrirCantidad}
            />
          </div>
          {!sinFiltros && sucursalValida && totalPaginas > 1 ? (
            <div className="flex justify-end pt-2 shrink-0">
              <PaginacionTabla
                basePath={GP_ROUTES.pedidoMercaderia.pedirMercaderia}
                params={{ sucursal: sucursalValida, proveedor, q, pedido: pedidoValida }}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>
      <CantPedirMercaderiaModal
        open={modalCantOpen}
        onOpenChange={setModalCantOpen}
        producto={productoModal}
        cantPorId={cantPorId}
        ivaSaldoAcumuladoComparacion={ivaSaldoAcumuladoComparacion}
        onGuardarUrgente={guardarUrgente}
        onConfigurarReposicion={abrirConfigurarReposicion}
      />
      {itemReposicion && sucursalValida ? (
        <ConfigurarReposicionModal
          open={modalRepoOpen}
          onOpenChange={setModalRepoOpen}
          item={itemReposicion}
          sucursal={sucursalValida}
        />
      ) : null}
    </>
  );
}
