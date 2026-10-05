"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
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
import type { RegistrarStockMovimientosResult } from "@/services/stockMovimientos.service";

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
  paginaNum,
  paramsPagina,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const tableRef = useRef<TablaStockHandle>(null);
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
    try {
      const response = await fetch("/api/stock/ajustes", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalCodigo: sucursalVisible,
          personalId: usuario.idPersonal,
          lineas,
        }),
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const okPayload =
        payload !== null &&
        typeof payload === "object" &&
        "ok" in payload &&
        (payload as { ok: unknown }).ok === true &&
        "data" in payload;
      if (!response.ok || !okPayload) {
        const errMsg =
          payload !== null &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "No se pudo confirmar el ajuste.";
        toast.error(errMsg);
        return;
      }
      const data = (payload as { data: RegistrarStockMovimientosResult }).data;
      tableRef.current?.marcarAjustesConfirmados();
      toast.success(
        data.movimientos === 1
          ? "Se confirmó 1 ajuste de stock."
          : `Se confirmaron ${data.movimientos} ajustes de stock.`
      );
      router.refresh();
    } catch (e) {
      console.error("[StockPageWithActions.confirmarAjuste]", e);
      toast.error("No se pudo confirmar el ajuste. Recargá la página.");
    } finally {
      setConfirmando(false);
    }
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
