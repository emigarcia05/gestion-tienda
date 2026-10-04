"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { confirmarAjusteControlStockAction } from "@/actions/stockMovimientos";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import TablaStock from "@/components/stock/TablaStock";
import FiltrosStock from "@/components/stock/FiltrosStock";
import ImprimirStockButton from "@/components/stock/ImprimirStockButton";
import type { ControlStockData, Sucursal } from "@/actions/stock";
import type { TablaStockHandle } from "./TablaStock";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import { PAGE_SIZE } from "@/lib/pagination";
import { sucursalPreferidaLabel } from "@/lib/sucursalPreferida";
import {
  EVENTO_USUARIO_SESION,
  leerUsuarioSesion,
} from "@/lib/usuarioSesion";

const CONTROL_STOCK_VACIO: ControlStockData = {
  items: [],
  total: 0,
  totalPaginas: 0,
  marcas: [],
  rubros: [],
};

interface Props {
  data: ControlStockData;
  esEditor: boolean;
  proveedores: {
    id: string;
    nombre: string;
    coeficienteTintometrico: number;
  }[];
  sucursalValida: Sucursal | null;
  q: string;
  marca: string;
  rubro: string;
  soloNegativo: boolean;
  orden: string;
  paginaNum: number;
  paramsPagina: Record<string, string>;
}

export default function StockPageWithActions({
  data,
  esEditor: _esEditor,
  proveedores: _proveedores,
  sucursalValida,
  q,
  marca,
  rubro,
  soloNegativo,
  orden,
  paginaNum,
  paramsPagina,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const tableRef = useRef<TablaStockHandle>(null);
  const [totalFiltrados, setTotalFiltrados] = useState<number>(data.items.length);
  const [sucursalUsuario, setSucursalUsuario] = useState<Sucursal | null>(null);
  const [usuarioListo, setUsuarioListo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const syncUsuario = useCallback(() => {
    const usuario = leerUsuarioSesion();
    setSucursalUsuario(usuario?.sucursalPorDefecto ?? null);
    setUsuarioListo(true);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      syncUsuario();
    });
    window.addEventListener(EVENTO_USUARIO_SESION, syncUsuario);
    return () => window.removeEventListener(EVENTO_USUARIO_SESION, syncUsuario);
  }, [syncUsuario]);

  useEffect(() => {
    if (!usuarioListo) return;
    if (!sucursalUsuario) {
      if (sucursalValida) {
        router.replace(pathname);
      }
      return;
    }
    if (sucursalValida === sucursalUsuario) return;
    const p = new URLSearchParams();
    p.set("sucursal", sucursalUsuario);
    if (q) p.set("q", q);
    if (marca) p.set("marca", marca);
    if (rubro) p.set("rubro", rubro);
    if (soloNegativo) p.set("soloNegativo", "true");
    if (orden) p.set("orden", orden);
    if (paginaNum > 1) p.set("pagina", String(paginaNum));
    router.replace(`${pathname}?${p.toString()}`);
  }, [
    usuarioListo,
    sucursalUsuario,
    sucursalValida,
    q,
    marca,
    rubro,
    soloNegativo,
    orden,
    paginaNum,
    pathname,
    router,
  ]);

  const sucursalVisible =
    usuarioListo && sucursalUsuario && sucursalValida === sucursalUsuario
      ? sucursalUsuario
      : null;
  const tieneSucursal = sucursalVisible !== null;
  const tieneItems = data.items.length > 0;

  async function handleConfirmarAjuste() {
    const usuario = leerUsuarioSesion();
    if (!usuario || !sucursalVisible) {
      toast.error("Seleccioná un usuario en el slidenav.");
      return;
    }
    const lineas = tableRef.current?.getAjustesPendientes() ?? [];
    if (lineas.length === 0) {
      toast.error("No hay ajustes para confirmar.");
      return;
    }
    setConfirmando(true);
    const res = await confirmarAjusteControlStockAction({
      sucursalCodigo: sucursalVisible,
      personalId: usuario.idPersonal,
      lineas,
    });
    setConfirmando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    tableRef.current?.marcarAjustesConfirmados();
    toast.success(
      res.data.movimientos === 1
        ? "Se confirmó 1 ajuste de stock."
        : `Se confirmaron ${res.data.movimientos} ajustes de stock.`
    );
    router.refresh();
  }

  const actions = (
    <>
      <ToolbarActionButton
        label="Confirmar Ajuste"
        icon={<Check />}
        loading={confirmando}
        loadingLabel="Confirmando…"
        disabled={!tieneSucursal}
        onClick={() => {
          void handleConfirmarAjuste();
        }}
      />
      <ImprimirStockButton
        tableRef={tableRef}
        disabled={!tieneSucursal || !tieneItems}
      />
    </>
  );

  const filters = (
    <FiltrosStock
      data={tieneSucursal ? data : CONTROL_STOCK_VACIO}
      sucursalActual={sucursalVisible}
      qActual={q}
      marcaActual={marca}
      rubroActual={rubro}
      soloNegativoActual={soloNegativo}
      ordenActual={orden}
      totalItems={tieneSucursal ? totalFiltrados : 0}
    />
  );

  return (
    <>
      <ClassicFilteredTableLayout
        title="Stock"
        subtitle="Control Stock"
        actions={actions}
        filters={filters}
      >
        <div className="flex flex-col h-full min-h-0 gap-0.5">
          <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
            <TablaStock
              ref={tableRef}
              data={tieneSucursal ? data : CONTROL_STOCK_VACIO}
              sucursalActual={sucursalVisible}
              sucursalLabel={
                sucursalVisible ? sucursalPreferidaLabel(sucursalVisible) : ""
              }
              qActual={q}
              marcaActual={marca}
              rubroActual={rubro}
              soloNegativoActual={soloNegativo}
              onFiltradosCountChange={setTotalFiltrados}
            />
          </div>
          {tieneSucursal && data.totalPaginas > 1 && (
            <div className="flex justify-end pt-2 shrink-0">
              <PaginacionTabla
                basePath={GP_ROUTES.ayudaVendedor.controlStock}
                params={paramsPagina}
                paginaActual={paginaNum}
                totalPaginas={data.totalPaginas}
                total={data.total}
                pageSize={PAGE_SIZE}
              />
            </div>
          )}
        </div>
      </ClassicFilteredTableLayout>
    </>
  );
}
