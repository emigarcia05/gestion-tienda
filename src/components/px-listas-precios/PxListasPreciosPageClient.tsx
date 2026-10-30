"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import FiltrosPxListasPrecios from "@/components/px-listas-precios/FiltrosPxListasPrecios";
import TablaPxListasPrecios, {
  type OnCambioPxListas,
} from "@/components/px-listas-precios/TablaPxListasPrecios";
import { guardarPxListasCambiosAction } from "@/actions/pxListasPrecios";
import { PAGE_SIZE } from "@/lib/pagination";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import type { OpcionFiltroPxVinculado } from "@/lib/pxListasCompetenciaRef";
import type { ItemPxListasPreciosTabla, ListaPrecioPxListasColumna } from "@/lib/pxListasPrecios";
import {
  armarCeldaPrecioPxListas,
  claveCambioPxListas,
} from "@/lib/pxListasPreciosCelda";
import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";
import {
  hayFiltroActivoPxListas,
  MENSAJE_SIN_FILTRO_PX_LISTAS,
} from "@/lib/pxListasPreciosFiltros";

const BASE_PATH = GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas;

interface Props {
  items: ItemPxListasPreciosTabla[];
  total: number;
  totalPaginas: number;
  listas: ListaPrecioPxListasColumna[];
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  subRubros: Array<{ subRubro: string }>;
  opcionesPxVinculado: OpcionFiltroPxVinculado[];
  rol: Rol;
  q: string;
  rubro: string;
  marca: string;
  subRubro: string;
  actualizar: string;
  pxVinculado: string;
  paginaNum: number;
}

export default function PxListasPreciosPageClient({
  items,
  total,
  totalPaginas,
  listas,
  categoriasMc,
  idListaGeneral,
  marcas,
  rubros,
  subRubros,
  opcionesPxVinculado,
  rol,
  q,
  rubro,
  marca,
  subRubro,
  actualizar,
  pxVinculado,
  paginaNum,
}: Props) {
  const puedeEditar = puede(rol, PERMISOS.cxPxTienda.acceso);
  const hayFiltro = hayFiltroActivoPxListas({
    q,
    rubro,
    marca,
    subRubro,
    pxVinculado,
    actualizar,
  });
  const mensajeVacio = hayFiltro
    ? "NO HAY PRODUCTOS."
    : MENSAJE_SIN_FILTRO_PX_LISTAS;

  /** Filas como están en la BD (se resincronizan con cada respuesta del servidor). */
  const [itemsBd, setItemsBd] = useState(items);
  useEffect(() => {
    setItemsBd(items);
  }, [items]);

  /** Cambios sin guardar; sobreviven a cambios de filtro / página hasta **Guardar Cambios**. */
  const [cambios, setCambios] = useState<Map<string, CambioPxListas>>(() => new Map());
  const [guardando, setGuardando] = useState(false);
  const cantCambios = cambios.size;

  useEffect(() => {
    if (cantCambios === 0) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cantCambios]);

  const handleCambio = useCallback<OnCambioPxListas>((codTienda, idLista, cambio) => {
    setCambios((prev) => {
      const clave = claveCambioPxListas(codTienda, idLista);
      if (!cambio && !prev.has(clave)) return prev;
      const next = new Map(prev);
      if (cambio) next.set(clave, cambio);
      else next.delete(clave);
      return next;
    });
  }, []);

  const handleItemChange = useCallback((updated: ItemPxListasPreciosTabla) => {
    setItemsBd((prev) =>
      prev.map((item) => (item.codTienda === updated.codTienda ? updated : item))
    );
  }, []);

  async function guardarCambios() {
    const lista = [...cambios.values()];
    if (lista.length === 0) return;
    setGuardando(true);
    try {
      const res = await guardarPxListasCambiosAction({ cambios: lista });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const okPorClave = new Map<string, number | null>();
      const errores: string[] = [];
      for (const r of res.data.resultados) {
        if (r.ok) okPorClave.set(claveCambioPxListas(r.codTienda, r.idLista), r.pxEdicion);
        else errores.push(r.error);
      }

      setItemsBd((prev) =>
        prev.map((item) => {
          let tocado = false;
          let quitarRef = false;
          const preciosPorLista = item.preciosPorLista.map((c) => {
            const clave = claveCambioPxListas(item.codTienda, c.idLista);
            if (!okPorClave.has(clave)) return c;
            tocado = true;
            if (idListaGeneral != null && c.idLista === idListaGeneral) quitarRef = true;
            return armarCeldaPrecioPxListas({
              idLista: c.idLista,
              costoCompra: item.costoCompra,
              pxDux: c.pxDux,
              pxEdicion: okPorClave.get(clave) ?? null,
            });
          });
          if (!tocado) return item;
          return {
            ...item,
            preciosPorLista,
            ...(quitarRef ? { competenciaIdPxListaGeneral: null } : {}),
          };
        })
      );
      setCambios((prev) => {
        const next = new Map(prev);
        for (const clave of okPorClave.keys()) next.delete(clave);
        return next;
      });

      if (errores.length === 0) {
        toast.success(
          okPorClave.size === 1 ? "Cambio guardado." : `${okPorClave.size} cambios guardados.`
        );
      } else {
        toast.error(
          `${errores.length} cambio(s) no se guardaron (siguen marcados).`,
          { description: [...new Set(errores)].join(" · ") }
        );
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="Px Listas"
        actions={
          puedeEditar ? (
            <ToolbarActionButton
              label={cantCambios > 0 ? `Guardar Cambios (${cantCambios})` : "Guardar Cambios"}
              loadingLabel="Guardando…"
              loading={guardando}
              icon={<Save />}
              className="w-full justify-start"
              disabled={cantCambios === 0}
              onClick={() => void guardarCambios()}
            />
          ) : undefined
        }
        filters={
          <FiltrosPxListasPrecios
            marcas={marcas.map((m) => m.marca)}
            rubros={rubros.map((r) => r.rubro)}
            subRubros={subRubros.map((s) => s.subRubro)}
            opcionesPxVinculado={opcionesPxVinculado}
            qActual={q}
            marcaActual={marca}
            rubroActual={rubro}
            subRubroActual={subRubro}
            actualizarActual={actualizar}
            pxVinculadoActual={pxVinculado}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-0.5">
          <div className="contenedor-tabla-gestion flex-1 min-h-0">
            <TablaPxListasPrecios
              items={itemsBd}
              listas={listas}
              puedeEditar={puedeEditar}
              categoriasMc={categoriasMc}
              idListaGeneral={idListaGeneral}
              mensajeVacio={mensajeVacio}
              cambios={cambios}
              onCambio={handleCambio}
              onItemChange={handleItemChange}
            />
          </div>
          {totalPaginas > 1 ? (
            <div className="flex shrink-0 justify-end pt-2">
              <PaginacionTabla
                basePath={BASE_PATH}
                params={{ q, rubro, marca, subRubro, actualizar, pxVinculado }}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>
    </div>
  );
}
