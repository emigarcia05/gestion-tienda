"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { useEffect, useMemo, useState } from "react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import GenerarPedidoToolbarButton from "@/components/pedidos/GenerarPedidoToolbarButton";
import TablaPedidoUrgente from "@/components/pedidos/TablaPedidoUrgente";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/pagination";
import type { ProductoPedidoUrgente } from "@/components/pedidos/TablaPedidoUrgente";
import CantidadPedidoUrgenteModal, {
  type ProductoPedidoUrgenteModal,
} from "@/components/pedidos/CantidadPedidoUrgenteModal";
import { toast } from "sonner";
import { upsertPedidoUrgenteMercaderiaItemAction } from "@/actions/pedidos";
import {
  ordenarMiembrosPedidoUrgentePorMenorCostoComparable,
} from "@/lib/precioComparacionPedidoUrgenteReposicion";
import PosicionIvaComparacionAutoRefresh from "@/components/pedidos/PosicionIvaComparacionAutoRefresh";
import {
  cantidadesUrgenteDesdeProductos,
  limpiarCantidadesUrgenteVisibles,
} from "@/lib/pedidoUrgenteCantidades";
import {
  MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE,
  MENSAJE_SIN_SUCURSAL_PEDIDO_URGENTE,
} from "@/lib/pedidos";

interface Props {
  filters: React.ReactNode;
  productos: ProductoPedidoUrgente[];
  proveedores: { id: string; nombre: string; prefijo: string }[];
  sucursalValida: "" | "guaymallen" | "maipu";
  /** True cuando no se puede listar (falta sucursal o el segundo filtro). */
  sinFiltros: boolean;
  /** Sucursal ya elegida (el segundo filtro puede faltar). */
  tieneSucursal: boolean;
  pedidoValida: "cualquier" | "urgente" | "reposicion" | "";
  total: number;
  totalPaginas: number;
  paginaNum: number;
  proveedor: string;
  q: string;
  /** Suma IVA saldo (Posición IVA) para elegir base de comparación entre proveedores. */
  ivaSaldoAcumuladoComparacion: number;
  /** Token inicial para auto-refresh si otra sesión modifica Posición IVA. */
  ivaComparacionRevisionToken: string;
}

const TITULO_PROVEEDOR_PRIORIDAD_COSTO = "Proveedor Con Prioridad Por Costo";
const TITULO_ALTERNATIVAS_PROVEEDOR =
  "Alternativa Por Stock o Conveniencia Logística";

type MiembroAgrupacionPedidoUrgente = NonNullable<
  ProductoPedidoUrgente["miembrosAgrupacion"]
>[number];

export default function PedidoUrgentePageClient({
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
  const [modalOpen, setModalOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoPedidoUrgenteModal | null>(null);
  const [modalElegirProveedorOpen, setModalElegirProveedorOpen] = useState(false);
  const [grupoParaElegirProveedor, setGrupoParaElegirProveedor] =
    useState<ProductoPedidoUrgente | null>(null);

  const miembrosElegirProveedorOrdenados = useMemo(() => {
    const m = grupoParaElegirProveedor?.miembrosAgrupacion;
    if (!m || m.length === 0) return [];
    return ordenarMiembrosPedidoUrgentePorMenorCostoComparable(m, ivaSaldoAcumuladoComparacion);
  }, [grupoParaElegirProveedor, ivaSaldoAcumuladoComparacion]);

  const { prioritarioElegirProveedor, alternativasElegirProveedor } = useMemo(() => {
    const arr = miembrosElegirProveedorOrdenados;
    if (arr.length === 0) {
      return {
        prioritarioElegirProveedor: null as MiembroAgrupacionPedidoUrgente | null,
        alternativasElegirProveedor: [] as MiembroAgrupacionPedidoUrgente[],
      };
    }
    const [prioritario, ...alternativas] = arr;
    return { prioritarioElegirProveedor: prioritario, alternativasElegirProveedor: alternativas };
  }, [miembrosElegirProveedorOrdenados]);

  useEffect(() => {
    queueMicrotask(() => {
      if (productos.length === 0) {
        setCantPorId({});
        return;
      }
      setCantPorId((prev) => {
        const fromServer = cantidadesUrgenteDesdeProductos(productos);
        const next = { ...prev };
        for (const [id, val] of Object.entries(fromServer)) {
          next[id] = val;
        }
        return next;
      });
    });
  }, [productos]);

  const actions = (
    <GenerarPedidoToolbarButton
      proveedores={proveedores}
      defaultSucursal={sucursalValida}
      defaultProveedor={proveedor}
      defaultTipos={[]}
      modulo="urgente"
      onGeneradoExito={() => {
        setCantPorId((prev) => limpiarCantidadesUrgenteVisibles(productos, prev));
      }}
    />
  );

  function productoDesdeMiembroGrupo(
    grupo: ProductoPedidoUrgente,
    miembro: NonNullable<ProductoPedidoUrgente["miembrosAgrupacion"]>[number]
  ): ProductoPedidoUrgente {
    return {
      id: miembro.codExt,
      codExt: miembro.codExt,
      prefijo: miembro.prefijo,
      descripcion: grupo.descripcion,
      pxCompraFinalSinIva: miembro.pxCompraFinalSinIva,
      ivaProveedor: miembro.ivaProveedor,
      cantPedidaUrgente: miembro.cantPedidaUrgente,
      confReposicion: grupo.confReposicion,
      cantReposicion: grupo.cantReposicion,
      estaVinculadoTienda: miembro.estaVinculadoTienda,
    };
  }

  function abrirModalCantidadDirecto(
    prod: ProductoPedidoUrgente,
    listaPrecioProveedorIdOverride?: string
  ) {
    setProductoSeleccionado({
      id: listaPrecioProveedorIdOverride ?? prod.id,
      descripcion: prod.descripcion,
    });
    setModalOpen(true);
  }

  function abrirModalCantidad(prod: ProductoPedidoUrgente) {
    if (prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 1) {
      setGrupoParaElegirProveedor(prod);
      setModalElegirProveedorOpen(true);
      return;
    }
    abrirModalCantidadDirecto(prod);
  }

  async function borrarCantidad(prod: ProductoPedidoUrgente) {
    if (!sucursalValida) {
      toast.error("Seleccioná una sucursal para guardar.");
      return;
    }
    const codExtsABorrar =
      prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 0
        ? prod.miembrosAgrupacion
            .map((m) => m.codExt)
            .filter((ce) => Number(cantPorId[ce] || 0) > 0)
        : [prod.id];
    if (codExtsABorrar.length === 0) return;

    const prevValues: Record<string, string> = {};
    for (const ce of codExtsABorrar) {
      prevValues[ce] = cantPorId[ce] ?? "";
    }
    setCantPorId((prev) => {
      const next = { ...prev };
      for (const ce of codExtsABorrar) {
        next[ce] = "";
      }
      return next;
    });

    for (const ce of codExtsABorrar) {
      const res = await upsertPedidoUrgenteMercaderiaItemAction({
        sucursal: sucursalValida,
        listaPrecioProveedorId: ce,
        cant: 0,
      });
      if (!res.ok) {
        setCantPorId((prev) => {
          const next = { ...prev };
          for (const c of codExtsABorrar) {
            next[c] = prevValues[c] ?? "";
          }
          return next;
        });
        toast.error(res.error ?? "Error al borrar.");
        return;
      }
    }
    toast.success(codExtsABorrar.length > 1 ? "Ítems borrados." : "Ítem borrado.");
  }

  async function confirmarCantidad(cantidad: number) {
    if (!productoSeleccionado) return;
    if (!sucursalValida) {
      toast.error("Seleccioná una sucursal para guardar.");
      return;
    }
    const id = productoSeleccionado.id;
    const prevValue = cantPorId[id];
    setCantPorId((prev) => ({ ...prev, [id]: cantidad > 0 ? String(cantidad) : "" }));

    const res = await upsertPedidoUrgenteMercaderiaItemAction({
      sucursal: sucursalValida,
      listaPrecioProveedorId: id,
      cant: cantidad,
    });
    if (!res.ok) {
      setCantPorId((prev) => ({ ...prev, [id]: prevValue ?? "" }));
      toast.error(res.error ?? "Error al guardar.");
      return;
    }
    toast.success("Ítem guardado.");
  }

  return (
    <>
      <PosicionIvaComparacionAutoRefresh initialToken={ivaComparacionRevisionToken} />
      <ClassicFilteredTableLayout
        title="Mercadería"
        subtitle="Cant. Pedida"
        subtitleSecondary="Urgente"
        actions={actions}
        filters={filters}
    >
      <div className="flex h-full min-h-0 flex-col gap-0.5">
        <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
          <TablaPedidoUrgente
            productos={productos}
            sinFiltros={sinFiltros}
            mensajeSinSucursal={
              tieneSucursal
                ? MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE
                : MENSAJE_SIN_SUCURSAL_PEDIDO_URGENTE
            }
            cantPorId={cantPorId}
            onRowDoubleClick={abrirModalCantidad}
            onRowDeleteClick={borrarCantidad}
          />
        </div>
        {!sinFiltros && sucursalValida && totalPaginas > 1 ? (
          <div className="flex justify-end pt-2 shrink-0">
            <PaginacionTabla
              basePath={GP_ROUTES.pedidoMercaderia.confPedido.urgente}
              params={{
                sucursal: sucursalValida,
                proveedor,
                q,
                pedido: pedidoValida,
              }}
              paginaActual={paginaNum}
              totalPaginas={totalPaginas}
              total={total}
              pageSize={PAGE_SIZE}
            />
          </div>
        ) : null}
        <CantidadPedidoUrgenteModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          producto={productoSeleccionado}
          onConfirmar={confirmarCantidad}
        />
        <Dialog
          open={modalElegirProveedorOpen}
          onOpenChange={(open) => {
            setModalElegirProveedorOpen(open);
            if (!open) setGrupoParaElegirProveedor(null);
          }}
        >
          <AppModal
            title="Elegir Proveedor"
            size="md"
            actions={
              <div className="flex w-full justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalElegirProveedorOpen(false);
                    setGrupoParaElegirProveedor(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-3 text-sm text-foreground">
              {prioritarioElegirProveedor ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-center text-sm font-semibold text-foreground leading-tight">
                      {TITULO_PROVEEDOR_PRIORIDAD_COSTO}
                    </h3>
                    <ul className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      <li key={prioritarioElegirProveedor.codExt} className="bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                              <span className="font-semibold text-foreground">
                                {prioritarioElegirProveedor.prefijo?.trim() || "Proveedor 1"}
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            className="btn-primario-gestion shrink-0"
                            onClick={() => {
                              const g = grupoParaElegirProveedor;
                              setModalElegirProveedorOpen(false);
                              setGrupoParaElegirProveedor(null);
                              if (!g) return;
                              abrirModalCantidadDirecto(
                                productoDesdeMiembroGrupo(g, prioritarioElegirProveedor)
                              );
                            }}
                          >
                            SELECCIONAR PROVEEDOR
                          </Button>
                        </div>
                      </li>
                    </ul>
                  </div>
                  {alternativasElegirProveedor.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-center text-sm font-semibold text-foreground leading-tight">
                        {TITULO_ALTERNATIVAS_PROVEEDOR}
                      </h3>
                      <ul className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                        {alternativasElegirProveedor.map((m, altIdx) => (
                          <li key={m.codExt} className="bg-card">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                                  <span className="font-semibold text-foreground">
                                    {m.prefijo?.trim() || `Proveedor ${altIdx + 2}`}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                className="btn-primario-gestion shrink-0"
                                onClick={() => {
                                  const g = grupoParaElegirProveedor;
                                  setModalElegirProveedorOpen(false);
                                  setGrupoParaElegirProveedor(null);
                                  if (!g) return;
                                  abrirModalCantidadDirecto(productoDesdeMiembroGrupo(g, m));
                                }}
                              >
                                SELECCIONAR PROVEEDOR
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </AppModal>
        </Dialog>
      </div>
    </ClassicFilteredTableLayout>
    </>
  );
}
