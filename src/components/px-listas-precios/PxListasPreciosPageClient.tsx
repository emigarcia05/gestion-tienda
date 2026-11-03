"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  guardarPxListaCompetenciaRefAction,
  guardarPxListasCambiosAction,
  publicarPxListasPreciosDefinitivosAction,
} from "@/actions/pxListasPrecios";
import { PAGE_SIZE } from "@/lib/pagination";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import type { OpcionFiltroPxVinculado } from "@/lib/pxListasCompetenciaRef";
import type {
  ItemPxListasPreciosTabla,
  ListaPrecioPxListasColumna,
  PrecioListaPxListasCelda,
} from "@/lib/pxListasPrecios";
import {
  armarCeldaPrecioPxListas,
  celdaPxListasEnPantalla,
  claveCambioPxListas,
  precioListaMostradoDifiereDefinitivo,
} from "@/lib/pxListasPreciosCelda";
import { preciosPxListaEnterosIguales } from "@/lib/pxListasPreciosFormat";
import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";
import {
  FILTRO_ACTUALIZAR_NO,
  FILTRO_ACTUALIZAR_SI,
  hayFiltroActivoPxListas,
  MENSAJE_SIN_FILTRO_PX_LISTAS,
} from "@/lib/pxListasPreciosFiltros";

const BASE_PATH = GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas;

function codigosConCambioPendiente(
  cambios: ReadonlyMap<string, CambioPxListas>,
  refsPendientes: ReadonlyMap<string, string | null>
): Set<string> {
  const codigos = new Set<string>();
  for (const cambio of cambios.values()) codigos.add(cambio.codTienda);
  for (const cod of refsPendientes.keys()) codigos.add(cod);
  return codigos;
}

function codigosParaPublicarDesdeEdicion(
  filas: readonly ItemPxListasPreciosTabla[],
  visibles: ReadonlySet<string>
): string[] {
  return filas
    .filter(
      (item) =>
        visibles.has(item.codTienda) &&
        item.preciosPorLista.some(precioEdicionDifiereDefinitivo)
    )
    .map((item) => item.codTienda);
}

function precioEdicionDifiereDefinitivo(celda: PrecioListaPxListasCelda): boolean {
  if (celda.pxEdicion == null || !(celda.pxEdicion > 0)) return false;
  if (celda.pxDux == null || !(celda.pxDux > 0)) return true;
  return !preciosPxListaEnterosIguales(celda.pxEdicion, celda.pxDux);
}

function codigosConPrecioDeVentaDistinto(
  filas: readonly ItemPxListasPreciosTabla[],
  visibles: ReadonlySet<string>,
  cambios: ReadonlyMap<string, CambioPxListas>,
  refsPendientes: ReadonlyMap<string, string | null>,
  idListaGeneral: number | null
): string[] {
  const codigos: string[] = [];
  for (const item of filas) {
    if (!visibles.has(item.codTienda)) continue;
    const refPendiente = refsPendientes.has(item.codTienda)
      ? (refsPendientes.get(item.codTienda) ?? null)
      : undefined;
    const difiere = item.preciosPorLista.some((celda) =>
      precioListaMostradoDifiereDefinitivo(
        celdaPxListasEnPantalla(item, celda, cambios, refPendiente, idListaGeneral)
      )
    );
    if (difiere) codigos.push(item.codTienda);
  }
  return codigos;
}

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
  const router = useRouter();
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
  const cambiosRef = useRef(cambios);
  cambiosRef.current = cambios;
  /** REF. de GENERAL elegido en pantalla y todavía no persistido. `null` = quitar el vínculo. */
  const [refsPendientes, setRefsPendientes] = useState<Map<string, string | null>>(
    () => new Map()
  );
  const refsRef = useRef(refsPendientes);
  refsRef.current = refsPendientes;
  const itemsBdRef = useRef(itemsBd);
  itemsBdRef.current = itemsBd;
  const [guardando, setGuardando] = useState(false);
  const cantCambios = cambios.size + refsPendientes.size;
  const codigosPendientes = useMemo(
    () => codigosConCambioPendiente(cambios, refsPendientes),
    [cambios, refsPendientes]
  );
  /** Filas editadas que el listado del servidor puede dejar afuera al cambiar el filtro. */
  const [retenidos, setRetenidos] = useState<
    Map<string, ItemPxListasPreciosTabla>
  >(() => new Map());

  useEffect(() => {
    setRetenidos((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const item of itemsBd) {
        if (!codigosPendientes.has(item.codTienda)) continue;
        if (next.get(item.codTienda) !== item) {
          next.set(item.codTienda, item);
          changed = true;
        }
      }
      for (const cod of next.keys()) {
        if (!codigosPendientes.has(cod)) {
          next.delete(cod);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [itemsBd, codigosPendientes]);

  const itemsVisibles = useMemo(() => {
    if (actualizar === FILTRO_ACTUALIZAR_NO) {
      return itemsBd.filter((item) => !codigosPendientes.has(item.codTienda));
    }
    if (actualizar === FILTRO_ACTUALIZAR_SI) {
      const enPagina = new Set(itemsBd.map((item) => item.codTienda));
      const extras: ItemPxListasPreciosTabla[] = [];
      for (const [cod, item] of retenidos) {
        if (codigosPendientes.has(cod) && !enPagina.has(cod)) extras.push(item);
      }
      return extras.length > 0 ? [...extras, ...itemsBd] : itemsBd;
    }
    return itemsBd;
  }, [actualizar, itemsBd, codigosPendientes, retenidos]);

  const codigosDistintos = useMemo(() => {
    const visibles = new Set(itemsVisibles.map((item) => item.codTienda));
    return codigosConPrecioDeVentaDistinto(
      itemsVisibles,
      visibles,
      cambios,
      refsPendientes,
      idListaGeneral
    );
  }, [itemsVisibles, cambios, refsPendientes, idListaGeneral]);
  const puedeGuardar = cantCambios > 0 || codigosDistintos.length > 0;

  useEffect(() => {
    if (cantCambios === 0) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cantCambios]);

  const quitarRefPendiente = useCallback((codTienda: string) => {
    setRefsPendientes((prev) => {
      if (!prev.has(codTienda)) return prev;
      const next = new Map(prev);
      next.delete(codTienda);
      refsRef.current = next;
      return next;
    });
  }, []);

  const handleCambio = useCallback<OnCambioPxListas>((codTienda, idLista, cambio) => {
    setCambios((prev) => {
      const clave = claveCambioPxListas(codTienda, idLista);
      if (!cambio && !prev.has(clave)) return prev;
      const next = new Map(prev);
      if (cambio) next.set(clave, cambio);
      else next.delete(clave);
      cambiosRef.current = next;
      return next;
    });
    if (cambio && idListaGeneral != null && idLista === idListaGeneral) {
      quitarRefPendiente(codTienda);
    }
  }, [idListaGeneral, quitarRefPendiente]);

  const handleRefPendiente = useCallback((codTienda: string, competenciaId: string | null) => {
    const item = itemsBdRef.current.find((row) => row.codTienda === codTienda);
    const enBd = item?.competenciaIdPxListaGeneral ?? null;
    if (enBd === competenciaId) {
      quitarRefPendiente(codTienda);
      return;
    }
    if (competenciaId != null) {
      const op = item?.opcionesCompetenciaRef.find((o) => o.competenciaId === competenciaId);
      if (!op || !(op.px > 0)) {
        toast.error("No hay precio de referencia para este competidor.");
        return;
      }
    }
    setRefsPendientes((prev) => {
      const next = new Map(prev);
      next.set(codTienda, competenciaId);
      refsRef.current = next;
      return next;
    });
    if (idListaGeneral != null) handleCambio(codTienda, idListaGeneral, null);
  }, [handleCambio, idListaGeneral, quitarRefPendiente]);

  async function guardarCambios() {
    const lista = [...cambiosRef.current.values()];
    const refs = [...refsRef.current.entries()];
    const visibles = new Set(itemsVisibles.map((item) => item.codTienda));
    let filas = itemsBdRef.current;
    const hayEdicionDistinta =
      codigosParaPublicarDesdeEdicion(filas, visibles).length > 0;
    if (lista.length === 0 && refs.length === 0 && !hayEdicionDistinta) return;
    setGuardando(true);
    const errores: string[] = [];
    let guardados = 0;
    try {
      for (const [codTienda, competenciaId] of refs) {
        const res = await guardarPxListaCompetenciaRefAction({
          codTienda,
          competenciaId,
        });
        if (!res.ok) {
          errores.push(res.error);
          continue;
        }
        guardados += 1;
        setRefsPendientes((prev) => {
          if (!prev.has(codTienda)) return prev;
          const next = new Map(prev);
          next.delete(codTienda);
          refsRef.current = next;
          return next;
        });
        filas = filas.map((item) => {
          if (item.codTienda !== codTienda) return item;
          const competenciaIdPxListaGeneral = res.data.competenciaIdPxListaGeneral;
          if (!res.data.pxActualizado || idListaGeneral == null) {
            return { ...item, competenciaIdPxListaGeneral };
          }
          return {
            ...item,
            competenciaIdPxListaGeneral,
            preciosPorLista: item.preciosPorLista.map((c) =>
              c.idLista === idListaGeneral
                ? armarCeldaPrecioPxListas({
                    idLista: idListaGeneral,
                    costoCompra: item.costoCompra,
                    pxDux: c.pxDux,
                    pxEdicion: res.data.pxEdicion,
                  })
                : c
            ),
          };
        });
      }

      if (lista.length > 0) {
        const res = await guardarPxListasCambiosAction({ cambios: lista });
        if (!res.ok) {
          errores.push(res.error);
        } else {
          const okPorClave = new Map<string, number | null>();
          for (const r of res.data.resultados) {
            if (r.ok) okPorClave.set(claveCambioPxListas(r.codTienda, r.idLista), r.pxEdicion);
            else errores.push(r.error);
          }
          guardados += okPorClave.size;

          filas = filas.map((item) => {
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
          });
          setCambios((prev) => {
            const next = new Map(prev);
            for (const clave of okPorClave.keys()) next.delete(clave);
            cambiosRef.current = next;
            return next;
          });
        }
      }

      const aPublicar = codigosParaPublicarDesdeEdicion(filas, visibles);
      let publicados: Array<{ codTienda: string; idLista: number; precio: number }> = [];
      if (aPublicar.length > 0) {
        const resPub = await publicarPxListasPreciosDefinitivosAction({
          codTiendas: aPublicar,
        });
        if (!resPub.ok) {
          errores.push(resPub.error);
        } else {
          publicados = resPub.data.publicados;
          const porClave = new Map(
            publicados.map((p) => [claveCambioPxListas(p.codTienda, p.idLista), p.precio])
          );
          filas = filas.map((item) => {
            let tocado = false;
            const preciosPorLista = item.preciosPorLista.map((c) => {
              const precio = porClave.get(claveCambioPxListas(item.codTienda, c.idLista));
              if (precio == null) return c;
              tocado = true;
              return armarCeldaPrecioPxListas({
                idLista: c.idLista,
                costoCompra: item.costoCompra,
                pxDux: precio,
                pxEdicion: c.pxEdicion ?? precio,
              });
            });
            return tocado ? { ...item, preciosPorLista } : item;
          });
        }
      }

      setItemsBd(filas);
      itemsBdRef.current = filas;

      if (guardados > 0 || publicados.length > 0) router.refresh();

      if (errores.length === 0) {
        if (publicados.length > 0) {
          toast.success(
            publicados.length === 1
              ? "Precio de venta actualizado."
              : `${publicados.length} precios de venta actualizados.`
          );
        } else {
          toast.success(
            guardados === 1 ? "Cambio guardado." : `${guardados} cambios guardados.`
          );
        }
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
              label={
                codigosDistintos.length > 0
                  ? `Guardar Cambios (${codigosDistintos.length})`
                  : cantCambios > 0
                    ? `Guardar Cambios (${cantCambios})`
                    : "Guardar Cambios"
              }
              loadingLabel="Guardando…"
              loading={guardando}
              icon={<Save />}
              className="w-full justify-start"
              disabled={!puedeGuardar}
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
              items={itemsVisibles}
              listas={listas}
              puedeEditar={puedeEditar}
              categoriasMc={categoriasMc}
              idListaGeneral={idListaGeneral}
              mensajeVacio={mensajeVacio}
              cambios={cambios}
              refsPendientes={refsPendientes}
              onCambio={handleCambio}
              onRefPendiente={handleRefPendiente}
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
