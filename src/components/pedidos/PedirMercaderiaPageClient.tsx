"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import GenerarPedidoToolbarButton from "@/components/pedidos/GenerarPedidoToolbarButton";
import TablaPedirMercaderia, {
  type FilaTintometricoPedir,
} from "@/components/pedidos/TablaPedirMercaderia";
import CantPedirMercaderiaModal from "@/components/pedidos/CantPedirMercaderiaModal";
import AgregarTintometricoModal from "@/components/pedidos/AgregarTintometricoModal";
import BorrarReposicionPedirModal, {
  type OpcionBorrarReposicion,
} from "@/components/pedidos/BorrarReposicionPedirModal";
import PosicionIvaComparacionAutoRefresh from "@/components/pedidos/PosicionIvaComparacionAutoRefresh";
import {
  deletePedidoTintometricoItemAction,
  setOmitirReposicionPedidoAction,
  upsertPedidoUrgenteMercaderiaItemAction,
} from "@/actions/pedidos";
import { deleteReglaReposicion } from "@/actions/reposicion";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  cantidadesUrgenteDesdeProductos,
  limpiarCantidadesUrgenteVisibles,
} from "@/lib/pedidoUrgenteCantidades";
import {
  MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE,
  MENSAJE_SIN_USUARIO_PEDIDO_MERCADERIA,
  type FiltroPedidoValor,
  type TipoPedido,
} from "@/lib/pedidos";
import type { PedidoUrgenteItem } from "@/services/listaPrecios.service";

const TIPOS_GENERAR_PEDIDO: TipoPedido[] = ["URGENTE", "TINTOMETRICO", "REPOSICION"];

interface Props {
  filters: React.ReactNode;
  productos: PedidoUrgenteItem[];
  proveedores: { id: string; nombre: string; prefijo: string }[];
  sucursalValida: "" | "guaymallen" | "maipu";
  /** True cuando no se puede listar (falta sucursal o el segundo filtro). */
  sinFiltros: boolean;
  tieneSucursal: boolean;
  pedidoValida: FiltroPedidoValor;
  total: number;
  totalPaginas: number;
  paginaNum: number;
  proveedor: string;
  q: string;
  ivaSaldoAcumuladoComparacion: number;
  ivaComparacionRevisionToken: string;
  /** Tintométricos de la sucursal (y proveedor si está filtrado); van siempre arriba. */
  tintometricos: FilaTintometricoPedir[];
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
  tintometricos,
}: Props) {
  const router = useRouter();
  const [modalTintoOpen, setModalTintoOpen] = useState(false);
  const [cantPorId, setCantPorId] = useState<Record<string, string>>({});
  const [productoModal, setProductoModal] = useState<PedidoUrgenteItem | null>(null);
  const [modalCantOpen, setModalCantOpen] = useState(false);
  const [productoBorrar, setProductoBorrar] = useState<PedidoUrgenteItem | null>(null);
  const [modalBorrarOpen, setModalBorrarOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      if (productos.length === 0) {
        setCantPorId({});
        return;
      }
      setCantPorId((prev) => ({ ...prev, ...cantidadesUrgenteDesdeProductos(productos) }));
    });
  }, [productos]);

  function abrirCantidad(prod: PedidoUrgenteItem) {
    setProductoModal(prod);
    setModalCantOpen(true);
  }

  async function guardarUrgente(
    cambios: Record<string, number>,
    mensajeExito: string | null = "Cantidad guardada."
  ): Promise<boolean> {
    if (!sucursalValida) {
      toast.error("Seleccioná un usuario en el slidenav.");
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
    if (mensajeExito) toast.success(mensajeExito);
    return true;
  }

  /** `cod_ext` con cantidad URGENTE > 0 del ítem (todos los miembros si está agrupado). */
  function cambiosBorrarUrgente(prod: PedidoUrgenteItem): Record<string, number> {
    const codExts =
      prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 0
        ? prod.miembrosAgrupacion.map((m) => m.codExt)
        : [prod.id];
    const cambios: Record<string, number> = {};
    for (const ce of codExts) if (Number(cantPorId[ce] || 0) > 0) cambios[ce] = 0;
    return cambios;
  }

  function borrarItem(prod: PedidoUrgenteItem) {
    if (prod.estaVinculadoTienda && prod.reposicionRegla) {
      setProductoBorrar(prod);
      setModalBorrarOpen(true);
      return;
    }
    const cambios = cambiosBorrarUrgente(prod);
    if (Object.keys(cambios).length === 0) return;
    void guardarUrgente(cambios, "Cantidad urgente borrada.");
  }

  async function elegirBorrarReposicion(opcion: OpcionBorrarReposicion): Promise<boolean> {
    const prod = productoBorrar;
    const regla = prod?.reposicionRegla;
    if (!prod || !regla || !sucursalValida) return false;
    const cambios = cambiosBorrarUrgente(prod);
    if (Object.keys(cambios).length > 0 && !(await guardarUrgente(cambios, null))) return false;

    if (opcion === "borrar-configuracion" && (regla.tienePisoCorp || !regla.idReposicion)) {
      toast.error("No se puede borrar una configuración hecha desde REPOSICION CORP.");
      return false;
    }
    const res =
      opcion === "no-pedir"
        ? await setOmitirReposicionPedidoAction({ sucursal: sucursalValida, codTienda: prod.codTienda, omitir: true })
        : await deleteReglaReposicion({ id: regla.idReposicion });
    if (!res.ok) {
      toast.error(res.error ?? "Error al actualizar la reposición.");
      return false;
    }
    toast.success(opcion === "no-pedir" ? "No se pide en este pedido." : "Configuración de reposición borrada.");
    router.refresh();
    return true;
  }

  async function reactivarReposicion(prod: PedidoUrgenteItem) {
    if (!sucursalValida || !prod.codTienda) return;
    const res = await setOmitirReposicionPedidoAction({
      sucursal: sucursalValida,
      codTienda: prod.codTienda,
      omitir: false,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Error al actualizar la reposición.");
      return;
    }
    toast.success("La reposición vuelve a pedirse.");
    setModalCantOpen(false);
    router.refresh();
  }

  async function borrarTintometrico(fila: FilaTintometricoPedir) {
    const res = await deletePedidoTintometricoItemAction({ id: fila.id });
    if (!res.ok) {
      toast.error(res.error ?? "Error al borrar el tintométrico.");
      return;
    }
    toast.success("Tintométrico borrado.");
    router.refresh();
  }

  const actions = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (!sucursalValida) {
            toast.error("Seleccioná un usuario en el slidenav.");
            return;
          }
          setModalTintoOpen(true);
        }}
      >
        <Palette className="h-4 w-4" aria-hidden />
        Agregar Tintométrico
      </Button>
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
    </div>
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
                tieneSucursal
                  ? MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE
                  : MENSAJE_SIN_USUARIO_PEDIDO_MERCADERIA
              }
              cantPorId={cantPorId}
              onAbrirCantidad={abrirCantidad}
              onBorrar={borrarItem}
              tintometricos={tintometricos}
              onBorrarTintometrico={borrarTintometrico}
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
        sucursal={sucursalValida}
        cantPorId={cantPorId}
        ivaSaldoAcumuladoComparacion={ivaSaldoAcumuladoComparacion}
        onGuardarUrgente={guardarUrgente}
        onReactivarReposicion={reactivarReposicion}
      />
      <BorrarReposicionPedirModal
        open={modalBorrarOpen}
        onOpenChange={setModalBorrarOpen}
        descripcion={productoBorrar?.descripcion ?? ""}
        tieneUrgente={productoBorrar ? Object.keys(cambiosBorrarUrgente(productoBorrar)).length > 0 : false}
        ocultarBorrarConfig={productoBorrar?.reposicionRegla?.tienePisoCorp === true}
        onElegir={elegirBorrarReposicion}
      />
      <AgregarTintometricoModal
        open={modalTintoOpen}
        onOpenChange={setModalTintoOpen}
        sucursal={sucursalValida}
        proveedorInicial={proveedor}
        onAgregado={() => router.refresh()}
      />
    </>
  );
}
