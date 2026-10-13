"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2 } from "lucide-react";
import {
  calcCostoComparacion,
  calcMargenManualDesdeDifPctReferencia,
  calcMargenSegunPxReferencia,
  calcPxManualDesdeDifPctReferencia,
} from "@/lib/calculos";
import { fmtPrecio } from "@/lib/format";
import { fmtMargenComparacionPct, formatPxManualEnteroMask } from "@/lib/comparacionCategoriasFormat";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  COMP_CATEGORIAS_COMPARISON_STACK_CLASS,
  COMP_CATEGORIAS_CONTENT_WIDTH,
  COMP_CATEGORIAS_PAGE_CONTENT_CLASS,
  COMP_CATEGORIAS_SELECTOR_PANEL_CLASS,
  COMP_CATEGORIAS_TABLA_PANEL_CLASS,
} from "@/lib/comparacionCategoriasLayout";
import ComparacionCategoriaSelector from "@/components/proveedores/comparacion-categorias/ComparacionCategoriaSelector";
import CrearEditarComparacionCategoriaModal, {
  type NivelComparacionCategoria,
} from "@/components/proveedores/comparacion-categorias/CrearEditarComparacionCategoriaModal";
import EliminarComparacionCategoriaModal from "@/components/proveedores/comparacion-categorias/EliminarComparacionCategoriaModal";
import CeldaDifPct from "@/components/shared/CeldaDifPct";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import type { CategoriaComparacionTree } from "@/services/categoriasComparacion.service";
import type {
  ProductoEnCategoria,
  ReferenciaCompetenciaPresentacion,
} from "@/services/categoriasComparacion.service";
import type { Rol } from "@/lib/permisos";
import { PERMISOS, puede } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import {
  getProductosPorPresentacionAction,
  quitarAsignacionPresentacionAction,
  quitarReferenciaCompetenciaAction,
} from "@/actions/comparacionCategorias";
import AsignarProductosModal from "@/components/proveedores/comparacion-categorias/AsignarProductosModal";
import ElegirReferenciaCompetenciaModal from "@/components/proveedores/comparacion-categorias/ElegirReferenciaCompetenciaModal";
import CeldaDtoExtraComparacion from "@/components/proveedores/comparacion-categorias/CeldaDtoExtraComparacion";
import CeldaDifPxRefManualComparacion from "@/components/proveedores/comparacion-categorias/CeldaDifPxRefManualComparacion";
import { toast } from "sonner";

interface Props {
  arbolInicial: CategoriaComparacionTree[];
  rol: Rol;
}

type ModalCrearEditarCatalogoState =
  | { open: false }
  | {
      open: true;
      nivel: NivelComparacionCategoria;
      modo: "crear" | "editar";
      id?: string;
      nombreInicial?: string;
      parentId?: string;
      parentNombre?: string;
    };

type ModalEliminarCatalogoState =
  | { open: false }
  | {
      open: true;
      nivel: NivelComparacionCategoria;
      id: string;
      nombre: string;
    };

function calcVariacionPct(costo: number | null, base: number | null): number | null {
  if (costo == null || costo <= 0 || base == null || base <= 0) return null;
  return ((costo - base) / base) * 100;
}

function resolveDtoExtraVivo(
  codExt: string,
  guardado: number | null,
  draft: Record<string, number | null>
): number | null {
  if (Object.prototype.hasOwnProperty.call(draft, codExt)) {
    return draft[codExt];
  }
  return guardado;
}

function resolveCostoComparacionVivo(
  producto: ProductoEnCategoria,
  dtoExtraDraft: Record<string, number | null>
): number | null {
  const dtoExtra = resolveDtoExtraVivo(
    producto.codExt,
    producto.dtoExtraComparacion,
    dtoExtraDraft
  );
  return calcCostoComparacion(producto.datosCosto, dtoExtra);
}

/** Base VAR: tilde manual o, si no hay, el costo más bajo entre los productos comparados. */
function resolveCostoBaseVar(
  productos: ProductoEnCategoria[],
  baseItemId: string | null,
  dtoExtraDraft: Record<string, number | null>
): { costoBase: number | null; baseIdEfectivo: string | null } {
  if (baseItemId) {
    const manual = productos.find((p) => p.id === baseItemId);
    const px = manual ? resolveCostoComparacionVivo(manual, dtoExtraDraft) : null;
    if (px != null && px > 0) {
      return { costoBase: px, baseIdEfectivo: baseItemId };
    }
  }

  let baseIdEfectivo: string | null = null;
  let costoBase: number | null = null;
  for (const p of productos) {
    const px = resolveCostoComparacionVivo(p, dtoExtraDraft);
    if (px == null || px <= 0) continue;
    if (costoBase == null || px < costoBase) {
      costoBase = px;
      baseIdEfectivo = p.id;
    }
  }
  return { costoBase, baseIdEfectivo };
}

type SeleccionCascadaComparacion = {
  categoriaId: string | null;
  subcategoriaId: string | null;
  presentacionId: string | null;
};

/** Si un nivel tiene una sola opción, la selecciona en cascada (categoría → subcategoría → presentación). */
function resolverSeleccionCascadaUnica(
  arbol: CategoriaComparacionTree[],
  categoriaId: string | null,
  subcategoriaId: string | null,
  presentacionId: string | null
): SeleccionCascadaComparacion {
  let catId = categoriaId;
  let subId = subcategoriaId;
  let presId = presentacionId;

  if (!catId && arbol.length === 1) {
    catId = arbol[0].id;
  }

  if (catId && !subId) {
    const categoria = arbol.find((c) => c.id === catId);
    if (categoria?.subcategorias.length === 1) {
      subId = categoria.subcategorias[0].id;
    }
  }

  if (catId && subId && !presId) {
    const categoria = arbol.find((c) => c.id === catId);
    const subcategoria = categoria?.subcategorias.find((s) => s.id === subId);
    if (subcategoria?.presentaciones.length === 1) {
      presId = subcategoria.presentaciones[0].id;
    }
  }

  return { categoriaId: catId, subcategoriaId: subId, presentacionId: presId };
}

export default function ComparacionCategoriasClient({ arbolInicial, rol }: Props) {
  const router = useRouter();
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(null);
  const [selectedSubcategoriaId, setSelectedSubcategoriaId] = useState<string | null>(null);
  const [selectedPresentacionId, setSelectedPresentacionId] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoEnCategoria[]>([]);
  const [referenciasCompetencia, setReferenciasCompetencia] = useState<
    ReferenciaCompetenciaPresentacion[]
  >([]);
  const [referenciaActivaId, setReferenciaActivaId] = useState<string | null>(null);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [modalAsignar, setModalAsignar] = useState(false);
  const [modalReferencia, setModalReferencia] = useState(false);
  const [quitarReferenciaPendingId, setQuitarReferenciaPendingId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [baseItemId, setBaseItemId] = useState<string | null>(null);
  const [difPxRefManualDraft, setDifPxRefManualDraft] = useState<Record<string, number | null>>({});
  const [dtoExtraDraft, setDtoExtraDraft] = useState<Record<string, number | null>>({});
  const [crearEditarCatalogo, setCrearEditarCatalogo] = useState<ModalCrearEditarCatalogoState>({
    open: false,
  });
  const [eliminarCatalogo, setEliminarCatalogo] = useState<ModalEliminarCatalogoState>({
    open: false,
  });

  const puedeEditar = puede(rol, PERMISOS.comparacionCategorias.editar);

  const categoriaSeleccionada = useMemo(
    () => arbolInicial.find((c) => c.id === selectedCategoriaId) ?? null,
    [arbolInicial, selectedCategoriaId]
  );

  const subcategoriaSeleccionada = useMemo(
    () => categoriaSeleccionada?.subcategorias.find((s) => s.id === selectedSubcategoriaId) ?? null,
    [categoriaSeleccionada, selectedSubcategoriaId]
  );

  const { costoBase: costoBaseVar, baseIdEfectivo: baseIdEfectivoVar } = useMemo(
    () => resolveCostoBaseVar(productos, baseItemId, dtoExtraDraft),
    [productos, baseItemId, dtoExtraDraft]
  );

  const hayBaseVar = costoBaseVar != null;

  const limpiarSeleccionProductos = useCallback(() => {
    setProductos([]);
    setReferenciasCompetencia([]);
    setReferenciaActivaId(null);
    setBaseItemId(null);
    setDifPxRefManualDraft({});
    setDtoExtraDraft({});
  }, []);

  const onSuccessCatalogoRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleEliminarCatalogoSuccess = useCallback(
    (nivel: NivelComparacionCategoria, id: string) => {
      setEliminarCatalogo({ open: false });
      if (nivel === "categoria" && selectedCategoriaId === id) {
        setSelectedCategoriaId(null);
        setSelectedSubcategoriaId(null);
        setSelectedPresentacionId(null);
        limpiarSeleccionProductos();
      } else if (nivel === "subcategoria" && selectedSubcategoriaId === id) {
        setSelectedSubcategoriaId(null);
        setSelectedPresentacionId(null);
        limpiarSeleccionProductos();
      } else if (nivel === "presentacion" && selectedPresentacionId === id) {
        setSelectedPresentacionId(null);
        limpiarSeleccionProductos();
      }
      onSuccessCatalogoRefresh();
    },
    [
      limpiarSeleccionProductos,
      onSuccessCatalogoRefresh,
      selectedCategoriaId,
      selectedPresentacionId,
      selectedSubcategoriaId,
    ]
  );

  const loadProductos = useCallback(async (presentacionId: string) => {
    setLoadingProductos(true);
    try {
      const res = await getProductosPorPresentacionAction(presentacionId);
      if (res.ok && res.data) {
        setProductos(res.data.productos);
        setReferenciasCompetencia(res.data.referenciasCompetencia);
        setReferenciaActivaId((prev) => {
          const refs = res.data.referenciasCompetencia;
          if (refs.length === 0) return null;
          if (prev && refs.some((r) => r.id === prev)) return prev;
          return refs[0]?.id ?? null;
        });
        setBaseItemId(null);
        setDifPxRefManualDraft({});
        setDtoExtraDraft({});
      } else {
        setProductos([]);
        setReferenciasCompetencia([]);
        setReferenciaActivaId(null);
        setBaseItemId(null);
        setDifPxRefManualDraft({});
        setDtoExtraDraft({});
        if (!res.ok) toast.error(res.error);
      }
    } finally {
      setLoadingProductos(false);
    }
  }, []);

  const aplicarSeleccionCascada = useCallback(
    (categoriaId: string | null, subcategoriaId: string | null, presentacionId: string | null) => {
      const next = resolverSeleccionCascadaUnica(
        arbolInicial,
        categoriaId,
        subcategoriaId,
        presentacionId
      );
      setSelectedCategoriaId(next.categoriaId);
      setSelectedSubcategoriaId(next.subcategoriaId);
      setSelectedPresentacionId(next.presentacionId);
      if (next.presentacionId) {
        void loadProductos(next.presentacionId);
      } else {
        limpiarSeleccionProductos();
      }
    },
    [arbolInicial, limpiarSeleccionProductos, loadProductos]
  );

  useEffect(() => {
    const next = resolverSeleccionCascadaUnica(
      arbolInicial,
      selectedCategoriaId,
      selectedSubcategoriaId,
      selectedPresentacionId
    );
    if (
      next.categoriaId === selectedCategoriaId &&
      next.subcategoriaId === selectedSubcategoriaId &&
      next.presentacionId === selectedPresentacionId
    ) {
      return;
    }
    setSelectedCategoriaId(next.categoriaId);
    setSelectedSubcategoriaId(next.subcategoriaId);
    setSelectedPresentacionId(next.presentacionId);
    if (next.presentacionId && next.presentacionId !== selectedPresentacionId) {
      void loadProductos(next.presentacionId);
    } else if (!next.presentacionId && selectedPresentacionId) {
      limpiarSeleccionProductos();
    }
    // Solo re-cascada al cambiar el árbol (p. ej. tras crear ítem o refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- no reaccionar a cada click manual
  }, [arbolInicial]);

  const handleSelectCategoria = useCallback(
    (id: string) => {
      aplicarSeleccionCascada(id, null, null);
    },
    [aplicarSeleccionCascada]
  );

  const handleSelectSubcategoria = useCallback(
    (id: string) => {
      aplicarSeleccionCascada(selectedCategoriaId, id, null);
    },
    [aplicarSeleccionCascada, selectedCategoriaId]
  );

  const handleSelectPresentacion = useCallback(
    (id: string) => {
      setSelectedPresentacionId(id);
      setBaseItemId(null);
      setDifPxRefManualDraft({});
      setDtoExtraDraft({});
      void loadProductos(id);
    },
    [loadProductos]
  );

  const toggleBaseItem = useCallback((itemId: string) => {
    setBaseItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const onAsignarSuccess = useCallback(() => {
    setModalAsignar(false);
    if (selectedPresentacionId) void loadProductos(selectedPresentacionId);
  }, [selectedPresentacionId, loadProductos]);

  const onReferenciaSuccess = useCallback(
    (nuevaReferencia: ReferenciaCompetenciaPresentacion) => {
      setModalReferencia(false);
      setReferenciasCompetencia((prev) => {
        if (prev.some((r) => r.id === nuevaReferencia.id)) return prev;
        const clave = `${nuevaReferencia.codTienda}:${nuevaReferencia.competenciaId}`;
        if (prev.some((r) => `${r.codTienda}:${r.competenciaId}` === clave)) return prev;
        return [...prev, nuevaReferencia];
      });
      setReferenciaActivaId(nuevaReferencia.id);
      if (selectedPresentacionId) void loadProductos(selectedPresentacionId);
    },
    [selectedPresentacionId, loadProductos]
  );

  const handleQuitarReferencia = useCallback(
    async (refCompId: string) => {
      if (quitarReferenciaPendingId != null) return;
      setQuitarReferenciaPendingId(refCompId);
      try {
        const res = await quitarReferenciaCompetenciaAction(refCompId);
        if (!res.ok) {
          toast.error(res.error ?? "Error al quitar la referencia.");
          return;
        }
        setReferenciasCompetencia((prev) => {
          const next = prev.filter((r) => r.id !== refCompId);
          setReferenciaActivaId((activa) => {
            if (activa !== refCompId) return activa;
            return next[0]?.id ?? null;
          });
          return next;
        });
        toast.success("Referencia de competencia quitada.");
      } finally {
        setQuitarReferenciaPendingId(null);
      }
    },
    [quitarReferenciaPendingId]
  );

  const handleQuitarFila = useCallback(
    async (itemId: string) => {
      if (!selectedPresentacionId || removingItemId != null) return;
      setRemovingItemId(itemId);
      try {
        const res = await quitarAsignacionPresentacionAction([itemId]);
        if (!res.ok) {
          toast.error(res.error ?? "Error al quitar la fila.");
          return;
        }
        setProductos((prev) => prev.filter((p) => p.id !== itemId));
        setBaseItemId((prev) => (prev === itemId ? null : prev));
      } finally {
        setRemovingItemId(null);
      }
    },
    [removingItemId, selectedPresentacionId]
  );

  const referenciaActiva = useMemo(
    () => referenciasCompetencia.find((r) => r.id === referenciaActivaId) ?? null,
    [referenciasCompetencia, referenciaActivaId]
  );

  const pxReferenciaMargen = referenciaActiva?.pxMostrar ?? null;

  const columnasTabla = puedeEditar ? 11 : 10;

  const resolveDifPxRefManualVivo = useCallback(
    (codExt: string, difGuardado: number | null): number | null => {
      if (Object.prototype.hasOwnProperty.call(difPxRefManualDraft, codExt)) {
        return difPxRefManualDraft[codExt];
      }
      return difGuardado ?? 0;
    },
    [difPxRefManualDraft]
  );

  const handleDifPxRefManualDraft = useCallback((codExt: string, difPxRefManual: number | null) => {
    setDifPxRefManualDraft((prev) => ({ ...prev, [codExt]: difPxRefManual }));
  }, []);

  const handleDifPxRefManualDraftEnd = useCallback((codExt: string) => {
    setDifPxRefManualDraft((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, codExt)) return prev;
      const next = { ...prev };
      delete next[codExt];
      return next;
    });
  }, []);

  const handleDifPxRefManualSaved = useCallback(
    (codExt: string, difPxRefManual: number | null) => {
      setProductos((prev) =>
        prev.map((p) =>
          p.codExt === codExt ? { ...p, difPxRefManualComparacion: difPxRefManual } : p
        )
      );
      handleDifPxRefManualDraftEnd(codExt);
    },
    [handleDifPxRefManualDraftEnd]
  );

  const handleDtoExtraDraft = useCallback((codExt: string, dtoExtra: number | null) => {
    setDtoExtraDraft((prev) => ({ ...prev, [codExt]: dtoExtra }));
  }, []);

  const handleDtoExtraDraftEnd = useCallback((codExt: string) => {
    setDtoExtraDraft((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, codExt)) return prev;
      const next = { ...prev };
      delete next[codExt];
      return next;
    });
  }, []);

  const handleDtoExtraSaved = useCallback(
    (codExt: string, dtoExtra: number | null) => {
      setProductos((prev) =>
        prev.map((p) => {
          if (p.codExt !== codExt) return p;
          const pxCompraFinalSinIva = calcCostoComparacion(p.datosCosto, dtoExtra);
          return { ...p, dtoExtraComparacion: dtoExtra, pxCompraFinalSinIva };
        })
      );
      handleDtoExtraDraftEnd(codExt);
    },
    [handleDtoExtraDraftEnd]
  );

  return (
    <>
      <ClassicFilteredTableLayout
        title="Productos"
        subtitle="Análisis Cat."
        contentWidth={COMP_CATEGORIAS_CONTENT_WIDTH}
        contentClassName={COMP_CATEGORIAS_PAGE_CONTENT_CLASS}
      >
        <div className={COMP_CATEGORIAS_COMPARISON_STACK_CLASS}>
          <div className={COMP_CATEGORIAS_SELECTOR_PANEL_CLASS}>
            <ComparacionCategoriaSelector
              arbol={arbolInicial}
              selectedCategoriaId={selectedCategoriaId}
              selectedSubcategoriaId={selectedSubcategoriaId}
              selectedPresentacionId={selectedPresentacionId}
              loadingReferencia={loadingProductos}
              referenciasCompetencia={referenciasCompetencia}
              referenciaActivaId={referenciaActivaId}
              puedeEditarCatalogo={puedeEditar}
              puedeEditarReferencia={puedeEditar}
              quitarReferenciaPendingId={quitarReferenciaPendingId}
              onSelectCategoria={handleSelectCategoria}
              onSelectSubcategoria={handleSelectSubcategoria}
              onSelectPresentacion={handleSelectPresentacion}
              onSelectReferenciaActiva={setReferenciaActivaId}
              onNuevoCategoria={() =>
                setCrearEditarCatalogo({ open: true, nivel: "categoria", modo: "crear" })
              }
              onNuevoSubcategoria={() =>
                categoriaSeleccionada &&
                setCrearEditarCatalogo({
                  open: true,
                  nivel: "subcategoria",
                  modo: "crear",
                  parentId: categoriaSeleccionada.id,
                  parentNombre: categoriaSeleccionada.nombre,
                })
              }
              onNuevoPresentacion={() =>
                subcategoriaSeleccionada &&
                setCrearEditarCatalogo({
                  open: true,
                  nivel: "presentacion",
                  modo: "crear",
                  parentId: subcategoriaSeleccionada.id,
                  parentNombre: subcategoriaSeleccionada.nombre,
                })
              }
              onEditarCategoria={(id, nombre) =>
                setCrearEditarCatalogo({
                  open: true,
                  nivel: "categoria",
                  modo: "editar",
                  id,
                  nombreInicial: nombre,
                })
              }
              onEliminarCategoria={(id, nombre) =>
                setEliminarCatalogo({ open: true, nivel: "categoria", id, nombre })
              }
              onEditarSubcategoria={(id, nombre) =>
                categoriaSeleccionada &&
                setCrearEditarCatalogo({
                  open: true,
                  nivel: "subcategoria",
                  modo: "editar",
                  id,
                  nombreInicial: nombre,
                  parentId: categoriaSeleccionada.id,
                  parentNombre: categoriaSeleccionada.nombre,
                })
              }
              onEliminarSubcategoria={(id, nombre) =>
                setEliminarCatalogo({ open: true, nivel: "subcategoria", id, nombre })
              }
              onEditarPresentacion={(id, nombre) =>
                subcategoriaSeleccionada &&
                setCrearEditarCatalogo({
                  open: true,
                  nivel: "presentacion",
                  modo: "editar",
                  id,
                  nombreInicial: nombre,
                  parentId: subcategoriaSeleccionada.id,
                  parentNombre: subcategoriaSeleccionada.nombre,
                })
              }
              onEliminarPresentacion={(id, nombre) =>
                setEliminarCatalogo({ open: true, nivel: "presentacion", id, nombre })
              }
              onAgregarReferencia={() => setModalReferencia(true)}
              onQuitarReferencia={(refCompId) => void handleQuitarReferencia(refCompId)}
            />
          </div>

          <Card className={cn("flex flex-col gap-0 pt-0", COMP_CATEGORIAS_TABLA_PANEL_CLASS)}>
            <CardContent className="flex-1 min-h-0 overflow-hidden py-0 pb-3 px-0">
              {loadingProductos ? (
                <p className="text-sm text-muted-foreground py-4 px-4">Cargando productos…</p>
              ) : !selectedPresentacionId ? (
                <p className="text-sm text-muted-foreground py-4 px-4">
                  Elegí Categoría, Subcategoría y Presentación para ver o asignar productos.
                </p>
              ) : (
                <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
                  <Table variant="compact" scrollX>
                    <colgroup>
                      <col className="w-[3%]" />
                      <col className="w-[7%]" />
                      <col className={puedeEditar ? "w-[32%]" : "w-[40%]"} />
                      <col className="w-[6%]" />
                      <col className="w-[8%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      <col className="w-[8%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      {puedeEditar && <col className="w-[8%]" />}
                    </colgroup>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-center">TILDE</TableHead>
                        <TableHead className="text-center">PROVEEDOR</TableHead>
                        <TableHead>DESCRIPCIÓN</TableHead>
                        <TableHead className="text-center">DTO. EXTRA</TableHead>
                        <TableHead className="text-right">COSTO</TableHead>
                        <TableHead className="text-center">VAR</TableHead>
                        <TableHead className="text-center tabla-bloque-secundario-head-divider">
                          MARG. SEG. REF.
                        </TableHead>
                        <TableHead className="text-center tabla-bloque-secundario-head">
                          PX. CALC.
                        </TableHead>
                        <TableHead className="text-center tabla-bloque-secundario-head">
                          DIF % REF. MAN.
                        </TableHead>
                        <TableHead className="text-center tabla-bloque-secundario-head">
                          MARG. CALC.
                        </TableHead>
                        {puedeEditar && (
                          <TableHead className="text-center p-0 align-middle">
                            <div className="flex h-full min-h-0 w-full items-center justify-center p-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                                  "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
                                )}
                                onClick={() => setModalAsignar(true)}
                                title="Asignar productos"
                                aria-label="Asignar productos a esta categoría"
                              >
                                <Plus className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                            </div>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productos.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={columnasTabla} className="p-0">
                            <TableEmptyState
                              message="No hay productos asignados. Usá el botón + del encabezado para agregar ítems de lista de precios."
                              placement="panel"
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        productos.map((p) => {
                          const esBaseTilde = baseItemId === p.id;
                          const esBaseVar = p.id === baseIdEfectivoVar;
                          const costoVivo = resolveCostoComparacionVivo(p, dtoExtraDraft);
                          const variacionPct = !hayBaseVar
                            ? null
                            : esBaseVar
                              ? 0
                              : calcVariacionPct(costoVivo, costoBaseVar);
                          const margenPxReferencia = calcMargenSegunPxReferencia(
                            pxReferenciaMargen,
                            costoVivo
                          );
                          const difGuardado = p.difPxRefManualComparacion;
                          const difPxRefManual = resolveDifPxRefManualVivo(
                            p.codExt,
                            difGuardado
                          );
                          const pxManual = calcPxManualDesdeDifPctReferencia(
                            difPxRefManual,
                            pxReferenciaMargen
                          );
                          const margenManual = calcMargenManualDesdeDifPctReferencia(
                            difPxRefManual,
                            pxReferenciaMargen,
                            costoVivo
                          );

                          return (
                            <TableRow key={p.id} className="hover:bg-transparent">
                              <TableCell className="celda-datos text-center">
                                <label className="inline-flex cursor-pointer items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={esBaseTilde}
                                    onChange={() => toggleBaseItem(p.id)}
                                    className="h-4 w-4 rounded border-input accent-primary"
                                    aria-label={`Usar ${p.descripcionProveedor} como base de comparación`}
                                  />
                                </label>
                              </TableCell>
                              <TableCell className="celda-datos text-center">
                                {p.proveedorPrefijo ? (
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {p.proveedorPrefijo}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="celda-datos min-w-0 truncate">
                                {p.descripcionProveedor}
                              </TableCell>
                              <TableCell className="celda-datos text-center">
                                <CeldaDtoExtraComparacion
                                  codExt={p.codExt}
                                  dtoExtra={p.dtoExtraComparacion}
                                  puedeEditar={puedeEditar}
                                  onDraftChange={(valor) => handleDtoExtraDraft(p.codExt, valor)}
                                  onDraftEnd={() => handleDtoExtraDraftEnd(p.codExt)}
                                  onSaved={(valor) => handleDtoExtraSaved(p.codExt, valor)}
                                />
                              </TableCell>
                              <TableCell className="celda-datos celda-numero text-right">
                                {costoVivo != null ? `$${fmtPrecio(costoVivo)}` : "—"}
                              </TableCell>
                              <TableCell className="celda-datos text-center">
                                {variacionPct != null ? (
                                  <CeldaDifPct pct={variacionPct} />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="celda-datos text-center tabular-nums tabla-bloque-secundario-cell-divider">
                                {margenPxReferencia != null ? (
                                  fmtMargenComparacionPct(margenPxReferencia)
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="celda-datos text-center tabular-nums tabla-bloque-secundario-cell">
                                {pxManual != null ? (
                                  formatPxManualEnteroMask(pxManual)
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="celda-datos text-center tabla-bloque-secundario-cell">
                                <CeldaDifPxRefManualComparacion
                                  codExt={p.codExt}
                                  difPxRefManual={difPxRefManual}
                                  difPxRefManualGuardado={difGuardado}
                                  puedeEditar={puedeEditar}
                                  onDraftChange={(valor) =>
                                    handleDifPxRefManualDraft(p.codExt, valor)
                                  }
                                  onDraftEnd={() => handleDifPxRefManualDraftEnd(p.codExt)}
                                  onSaved={(valor) =>
                                    handleDifPxRefManualSaved(p.codExt, valor)
                                  }
                                />
                              </TableCell>
                              <TableCell className="celda-datos text-center tabular-nums tabla-bloque-secundario-cell">
                                {margenManual != null ? (
                                  fmtMargenComparacionPct(margenManual)
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              {puedeEditar && (
                                <TableCell className="celda-datos celda-datos--accion-relleno-fila text-center">
                                  <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                      onClick={() => handleQuitarFila(p.id)}
                                      disabled={removingItemId === p.id}
                                      title="Quitar producto"
                                    >
                                      {removingItemId === p.id ? (
                                        <Loader2
                                          className={cn(TABLE_ROW_ACTION_ICON_CLASS, "animate-spin")}
                                          aria-hidden
                                        />
                                      ) : (
                                        <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ClassicFilteredTableLayout>

      {puedeEditar && selectedPresentacionId && (
        <>
          <AsignarProductosModal
            open={modalAsignar}
            onOpenChange={setModalAsignar}
            presentacionId={selectedPresentacionId}
            onSuccess={onAsignarSuccess}
          />
          <ElegirReferenciaCompetenciaModal
            open={modalReferencia}
            onOpenChange={setModalReferencia}
            presentacionId={selectedPresentacionId}
            onSuccess={onReferenciaSuccess}
          />
        </>
      )}

      {crearEditarCatalogo.open && (
        <CrearEditarComparacionCategoriaModal
          open={crearEditarCatalogo.open}
          onOpenChange={(next) => !next && setCrearEditarCatalogo({ open: false })}
          nivel={crearEditarCatalogo.nivel}
          modo={crearEditarCatalogo.modo}
          id={crearEditarCatalogo.id}
          nombreInicial={crearEditarCatalogo.nombreInicial}
          parentId={crearEditarCatalogo.parentId}
          parentNombre={crearEditarCatalogo.parentNombre}
          onSuccess={() => {
            setCrearEditarCatalogo({ open: false });
            onSuccessCatalogoRefresh();
          }}
        />
      )}

      {eliminarCatalogo.open && (
        <EliminarComparacionCategoriaModal
          open={eliminarCatalogo.open}
          onOpenChange={(next) => !next && setEliminarCatalogo({ open: false })}
          nivel={eliminarCatalogo.nivel}
          id={eliminarCatalogo.id}
          nombre={eliminarCatalogo.nombre}
          onSuccess={() =>
            handleEliminarCatalogoSuccess(eliminarCatalogo.nivel, eliminarCatalogo.id)
          }
        />
      )}
    </>
  );
}
