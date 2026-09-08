"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactElement,
} from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  guardarPxListaCompetenciaRefAction,
  guardarPxListaMargenEdicionAction,
  guardarPxListaPrecioEdicionAction,
} from "@/actions/pxListasPrecios";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import PxListaEnteroInput from "@/components/shared/PxListaEnteroInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calcPxListaDesdeMargenSinIvaPct,
} from "@/lib/calculos";
import {
  parsePorcentajeCentNormalized,
  porcentajeCentFromNumber,
} from "@/lib/porcentajeCentMask";
import { PX_LISTAS_COMP_REF_NINGUNO } from "@/lib/pxListasCompetenciaRef";
import {
  margenDesdePrecioDux,
  armarCeldaPrecioPxListas,
  celdaRequiereActualizar,
} from "@/lib/pxListasPreciosCelda";
import {
  parsePxListaEnteroNormalized,
  pxListaEnteroFromNumber,
} from "@/lib/pxListaEnteroMask";
import {
  fmtPxListaTabla,
  MARGEN_PX_LISTA_MAX_CENTS,
  margenesPorcUtilidadDifieren,
  preciosPxListaEnterosIguales,
  roundPxListaEntero,
} from "@/lib/pxListasPreciosFormat";
import type {
  ItemPxListasPreciosTabla,
  ListaPrecioPxListasColumna,
  PrecioListaPxListasCelda,
} from "@/lib/pxListasPrecios";
import { resolverCategoriaMargenPxListas } from "@/lib/pxListasPreciosCategoria";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import { cn } from "@/lib/utils";

interface Props {
  items: ItemPxListasPreciosTabla[];
  listas: ListaPrecioPxListasColumna[];
  puedeEditar: boolean;
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
  mensajeVacio: string;
}

type DraftCeldaPxListas = {
  px: number | null;
  margen: number | null;
};

const PX_LISTAS_PCT_DESCRIPCION = 42;
const PX_LISTAS_PCT_CATEGORIA_MC = 8;
/** Resto de la grilla (listas: REF en GENERAL + PX + PORC.); 40 % UX. */
const PX_LISTAS_PCT_LISTAS = 40;
/** Ancho mínimo por subcolumna de lista (scroll horizontal). */
const PX_LISTAS_MIN_ANCHO_SUBCOL_REM = 2.75;
/** Ancho mínimo de la columna REF (competidor) en 1 - GENERAL. */
const PX_LISTAS_MIN_ANCHO_REF_REM = 5.5;

function actualizarCeldaEnItem(
  item: ItemPxListasPreciosTabla,
  idLista: number,
  patch: Partial<PrecioListaPxListasCelda>
): ItemPxListasPreciosTabla {
  const preciosPorLista = item.preciosPorLista.map((c) => {
    if (c.idLista !== idLista) return c;
    const merged = { ...c, ...patch };
    return {
      ...merged,
      requiereActualizar: celdaRequiereActualizar(merged),
    };
  });
  return { ...item, preciosPorLista };
}

function aplicarDraftCelda(
  celda: PrecioListaPxListasCelda,
  draft: DraftCeldaPxListas | undefined
): PrecioListaPxListasCelda {
  if (!draft) return celda;
  return {
    ...celda,
    pxEfectivo: draft.px,
    margenPct: draft.margen,
  };
}

const INPUT_PX_LISTA_CLASS =
  "h-[calc(var(--tabla-body-row-min-height)-0.5rem)] min-w-0 max-h-full text-xs tabular-nums";

const INPUT_MARGEN_PX_LISTA_CLASS =
  "h-[calc(var(--tabla-body-row-min-height)-0.5rem)] min-w-0 max-h-full text-xs tabular-nums";

function CeldaPxLista({
  codTienda,
  idLista,
  costoCompra,
  celda,
  puedeEditar,
  onDraft,
  onSaved,
}: {
  codTienda: string;
  idLista: number;
  costoCompra: number;
  celda: PrecioListaPxListasCelda;
  puedeEditar: boolean;
  onDraft: (idLista: number, px: number | null) => void;
  onSaved: (idLista: number, patch: Partial<PrecioListaPxListasCelda>) => void;
}) {
  const pxPersistido = celda.pxEfectivo;
  const [draftLocal, setDraftLocal] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const pxAlIniciarRef = useRef<number | null>(null);
  const tieneEdicion = celda.pxEdicion != null;

  const pxVista = fmtPxListaTabla(pxPersistido);
  const draft =
    draftLocal ??
    pxListaEnteroFromNumber(pxPersistido);

  function aplicarDraftEnVivo(next: string) {
    setDraftLocal(next);
    if (next.trim() === "") {
      onDraft(idLista, null);
      return;
    }
    const px = parsePxListaEnteroNormalized(next);
    if (px !== undefined) {
      onDraft(idLista, px);
    }
  }

  function commit() {
    if (draft.trim() === "") {
      if (!tieneEdicion) {
        onDraft(idLista, null);
        pxAlIniciarRef.current = null;
        setDraftLocal(null);
        return;
      }

      startTransition(async () => {
        const res = await guardarPxListaPrecioEdicionAction({
          codTienda,
          idLista,
          pxEdicion: null,
        });
        if (res.ok) {
          onSaved(
            idLista,
            armarCeldaPrecioPxListas({
              idLista,
              costoCompra,
              pxDux: celda.pxDux,
              pxEdicion: null,
            })
          );
        } else {
          toast.error(res.error);
        }
        pxAlIniciarRef.current = null;
        setDraftLocal(null);
      });
      return;
    }

    const px = parsePxListaEnteroNormalized(draft);
    if (px === undefined) {
      toast.error("Precio inválido.");
      setDraftLocal(null);
      onDraft(idLista, null);
      pxAlIniciarRef.current = null;
      return;
    }

    const pxInicial = pxAlIniciarRef.current;
    if (
      pxInicial != null &&
      preciosPxListaEnterosIguales(px, pxInicial)
    ) {
      onDraft(idLista, null);
      pxAlIniciarRef.current = null;
      setDraftLocal(null);
      return;
    }

    startTransition(async () => {
      const res = await guardarPxListaPrecioEdicionAction({
        codTienda,
        idLista,
        pxEdicion: px,
      });
      if (res.ok) {
        onSaved(
          idLista,
          armarCeldaPrecioPxListas({
            idLista,
            costoCompra,
            pxDux: celda.pxDux,
            pxEdicion: res.data.pxEdicion,
          })
        );
      } else {
        toast.error(res.error);
        onDraft(idLista, null);
        setDraftLocal(null);
      }
      pxAlIniciarRef.current = null;
      setDraftLocal(null);
    });
  }

  if (!puedeEditar) {
    return (
      <Input
        type="text"
        readOnly
        value={pxVista}
        placeholder="—"
        className={cn(
          INPUT_PX_LISTA_CLASS,
          "w-full cursor-default border-primary tabular-nums",
          tieneEdicion && "px-lista-input--edicion"
        )}
        aria-label="Precio (solo lectura)"
        title="Solo lectura"
      />
    );
  }

  return (
    <PxListaEnteroInput
      valueNormalized={draft}
      onValueNormalizedChange={(next) => {
        if (draftLocal === null) {
          setDraftLocal(pxListaEnteroFromNumber(pxPersistido));
        }
        if (pxAlIniciarRef.current === null) {
          pxAlIniciarRef.current =
            celda.pxEfectivo != null ? roundPxListaEntero(celda.pxEfectivo) : null;
        }
        aplicarDraftEnVivo(next);
      }}
      onCommit={commit}
      disabled={saving}
      className={cn(
        INPUT_PX_LISTA_CLASS,
        "w-full border-primary",
        tieneEdicion && "px-lista-input--edicion"
      )}
      aria-label="Precio calculado"
      title="Editar precio"
    />
  );
}

function CeldaMargenLista({
  codTienda,
  idLista,
  costoCompra,
  celda,
  puedeEditar,
  onDraft,
  onSaved,
}: {
  codTienda: string;
  idLista: number;
  costoCompra: number;
  celda: PrecioListaPxListasCelda;
  puedeEditar: boolean;
  onDraft: (idLista: number, margen: number | null) => void;
  onSaved: (idLista: number, patch: Partial<PrecioListaPxListasCelda>) => void;
}) {
  const margenPersistido = celda.margenPct;
  const [draftLocal, setDraftLocal] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const margenAlIniciarRef = useRef<number | null>(null);
  const tieneEdicion = celda.pxEdicion != null;

  const draft =
    draftLocal ??
    (margenPersistido != null
      ? porcentajeCentFromNumber(margenPersistido, MARGEN_PX_LISTA_MAX_CENTS, true)
      : "");

  function aplicarDraftEnVivo(next: string) {
    setDraftLocal(next);
    if (next.trim() === "") {
      onDraft(idLista, null);
      return;
    }
    const margen = parsePorcentajeCentNormalized(next, MARGEN_PX_LISTA_MAX_CENTS);
    if (margen !== undefined) {
      onDraft(idLista, margen);
    }
  }

  function commit() {
    if (draft.trim() === "") {
      if (!tieneEdicion) {
        onDraft(idLista, null);
        margenAlIniciarRef.current = null;
        setDraftLocal(null);
        return;
      }

      startTransition(async () => {
        const res = await guardarPxListaMargenEdicionAction({
          codTienda,
          idLista,
          margenManual: null,
        });
        if (res.ok) {
          onSaved(idLista, armarCeldaPrecioPxListas({
            idLista,
            costoCompra,
            pxDux: celda.pxDux,
            pxEdicion: null,
          }));
        } else {
          toast.error(res.error);
        }
        margenAlIniciarRef.current = null;
        setDraftLocal(null);
      });
      return;
    }

    const margen = parsePorcentajeCentNormalized(draft, MARGEN_PX_LISTA_MAX_CENTS);
    if (margen === undefined) {
      toast.error("Margen inválido.");
      setDraftLocal(null);
      onDraft(idLista, null);
      margenAlIniciarRef.current = null;
      return;
    }

    const margenInicial = margenAlIniciarRef.current;
    if (
      margenInicial != null &&
      !margenesPorcUtilidadDifieren(margen, margenInicial)
    ) {
      onDraft(idLista, null);
      margenAlIniciarRef.current = null;
      setDraftLocal(null);
      return;
    }

    startTransition(async () => {
      const res = await guardarPxListaMargenEdicionAction({
        codTienda,
        idLista,
        margenManual: margen,
      });
      if (res.ok) {
        onSaved(
          idLista,
          armarCeldaPrecioPxListas({
            idLista,
            costoCompra,
            pxDux: celda.pxDux,
            pxEdicion: res.data.pxEdicion,
          })
        );
      } else {
        toast.error(res.error);
        onDraft(idLista, null);
        setDraftLocal(null);
      }
      margenAlIniciarRef.current = null;
      setDraftLocal(null);
    });
  }

  if (!puedeEditar) {
    return (
      <PorcentajeCentInput
        valueNormalized={draft}
        onValueNormalizedChange={() => {}}
        readOnly
        maxCents={MARGEN_PX_LISTA_MAX_CENTS}
        placeholder="—"
        className={cn(
          INPUT_MARGEN_PX_LISTA_CLASS,
          "w-full cursor-default border-primary",
          tieneEdicion && "px-lista-input--edicion"
        )}
        aria-label="Porc. utilidad (solo lectura)"
        title="Solo lectura"
      />
    );
  }

  return (
    <PorcentajeCentInput
      valueNormalized={draft}
      maxCents={MARGEN_PX_LISTA_MAX_CENTS}
      onValueNormalizedChange={(next) => {
        if (draftLocal === null) {
          setDraftLocal(
            margenPersistido != null
              ? porcentajeCentFromNumber(margenPersistido, MARGEN_PX_LISTA_MAX_CENTS, true)
              : ""
          );
        }
        if (margenAlIniciarRef.current === null) {
          margenAlIniciarRef.current = celda.margenPct;
        }
        aplicarDraftEnVivo(next);
      }}
      onCommit={commit}
      disabled={saving}
      className={cn(
        INPUT_MARGEN_PX_LISTA_CLASS,
        "w-full border-primary",
        tieneEdicion && "px-lista-input--edicion"
      )}
      aria-label="Porc. utilidad"
      title="Editar porc. utilidad"
    />
  );
}

function CeldaCompetenciaRefGeneral({
  item,
  puedeEditar,
  idListaGeneral,
  onItemChange,
}: {
  item: ItemPxListasPreciosTabla;
  puedeEditar: boolean;
  idListaGeneral: number;
  onItemChange: (item: ItemPxListasPreciosTabla) => void;
}) {
  const [saving, startTransition] = useTransition();
  const value =
    item.competenciaIdPxListaGeneral ?? PX_LISTAS_COMP_REF_NINGUNO;

  function handleChange(next: string) {
    startTransition(async () => {
      const res = await guardarPxListaCompetenciaRefAction({
        codTienda: item.codTienda,
        competenciaId: next === PX_LISTAS_COMP_REF_NINGUNO ? null : next,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const competenciaId = res.data.competenciaIdPxListaGeneral;
      let nextItem: ItemPxListasPreciosTabla = {
        ...item,
        competenciaIdPxListaGeneral: competenciaId,
      };

      if (res.data.pxActualizado) {
        nextItem = actualizarCeldaEnItem(
          nextItem,
          idListaGeneral,
          armarCeldaPrecioPxListas({
            idLista: idListaGeneral,
            costoCompra: item.costoCompra,
            pxDux:
              item.preciosPorLista.find((c) => c.idLista === idListaGeneral)
                ?.pxDux ?? null,
            pxEdicion: res.data.pxEdicion,
          })
        );
      }

      onItemChange(nextItem);
    });
  }

  if (!puedeEditar) {
    const op = item.opcionesCompetenciaRef.find(
      (o) => o.competenciaId === value
    );
    const label = op?.etiqueta ?? PX_LISTAS_COMP_REF_NINGUNO;
    return (
      <span className="block truncate text-xs" title={op?.nombre ?? label}>
        {label}
      </span>
    );
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger
        className="input-filtro-unificado h-[calc(var(--tabla-body-row-min-height)-0.5rem)] min-h-0 w-full min-w-0 px-1.5 text-xs"
        aria-label="Competidor de referencia"
        size="sm"
      >
        <SelectValue placeholder="-" />
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align="start"
        className="select-content-filtro"
      >
        <SelectItem value={PX_LISTAS_COMP_REF_NINGUNO}>-</SelectItem>
        {item.opcionesCompetenciaRef.map((op) => (
          <SelectItem
            key={op.competenciaId}
            value={op.competenciaId}
            title={op.nombre}
          >
            {op.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilaPxListasPrecios({
  item,
  puedeEditar,
  onItemChange,
  categoriasMc,
  idListaGeneral,
}: {
  item: ItemPxListasPreciosTabla;
  puedeEditar: boolean;
  onItemChange: (item: ItemPxListasPreciosTabla) => void;
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
}) {
  const [draftPorLista, setDraftPorLista] = useState<
    Record<number, DraftCeldaPxListas>
  >({});

  const descripcionRequiereActualizar = item.preciosPorLista.some(
    (c) => c.requiereActualizar
  );

  const limpiarDraft = (idLista: number) => {
    setDraftPorLista((prev) => {
      if (!(idLista in prev)) return prev;
      const next = { ...prev };
      delete next[idLista];
      return next;
    });
  };

  const handleMargenDraft = (idLista: number, margen: number | null) => {
    if (margen == null) {
      limpiarDraft(idLista);
      return;
    }
    const px = calcPxListaDesdeMargenSinIvaPct(margen, item.costoCompra);
    setDraftPorLista((prev) => ({
      ...prev,
      [idLista]: { px, margen },
    }));
  };

  const handlePxDraft = (idLista: number, px: number | null) => {
    if (px == null) {
      limpiarDraft(idLista);
      return;
    }
    const margen = margenDesdePrecioDux(px, item.costoCompra);
    setDraftPorLista((prev) => ({
      ...prev,
      [idLista]: { px, margen },
    }));
  };

  const handleCeldaSaved = (
    idLista: number,
    patch: Partial<PrecioListaPxListasCelda>
  ) => {
    limpiarDraft(idLista);
    const updated = actualizarCeldaEnItem(item, idLista, patch);
    /** Edición manual en GENERAL → select vuelve a "-". */
    if (idListaGeneral != null && idLista === idListaGeneral) {
      onItemChange({ ...updated, competenciaIdPxListaGeneral: null });
      return;
    }
    onItemChange(updated);
  };

  const celdaGeneral =
    idListaGeneral == null
      ? null
      : item.preciosPorLista.find((c) => c.idLista === idListaGeneral) ?? null;
  const draftGeneral =
    idListaGeneral == null ? undefined : draftPorLista[idListaGeneral];
  const porcUtilidadGeneral = celdaGeneral
    ? aplicarDraftCelda(celdaGeneral, draftGeneral).margenPct
    : null;
  const categoriaMargen = resolverCategoriaMargenPxListas(
    porcUtilidadGeneral,
    categoriasMc
  );

  return (
    <TableRow>
      <TableCell
        className={cn(
          "celda-datos celda-px-listas-col-fija celda-px-listas-col-fija-desc",
          descripcionRequiereActualizar && "celda-px-listas-actualizar"
        )}
      >
        <span className="block truncate" title={item.descripcion}>
          {item.descripcion}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos whitespace-nowrap celda-px-listas-col-fija celda-px-listas-col-fija-cat",
          descripcionRequiereActualizar && "celda-px-listas-actualizar"
        )}
        title={categoriaMargen || undefined}
      >
        <span className="block truncate">{categoriaMargen}</span>
      </TableCell>
      {item.preciosPorLista.flatMap((celda) => {
        const draft = draftPorLista[celda.idLista];
        const celdaVista = aplicarDraftCelda(celda, draft);
        const listaActualizar = celda.requiereActualizar;
        const esGeneral =
          idListaGeneral != null && celda.idLista === idListaGeneral;

        const celdas: ReactElement[] = [];

        if (esGeneral && idListaGeneral != null) {
          celdas.push(
            <TableCell
              key={`${item.codTienda}-${celda.idLista}-ref`}
              className={cn(
                "celda-datos celda-px-lista-ref-col border-l border-border",
                listaActualizar && "celda-px-listas-actualizar"
              )}
            >
              <CeldaCompetenciaRefGeneral
                item={item}
                puedeEditar={puedeEditar}
                idListaGeneral={idListaGeneral}
                onItemChange={onItemChange}
              />
            </TableCell>
          );
        }

        celdas.push(
          <TableCell
            key={`${item.codTienda}-${celda.idLista}-px`}
            className={cn(
              "celda-datos celda-numero celda-px-lista-col",
              !esGeneral && "border-l border-border",
              listaActualizar && "celda-px-listas-actualizar"
            )}
          >
            <CeldaPxLista
              key={`${item.codTienda}-${celda.idLista}-px-${celda.pxEfectivo ?? "n"}-${celda.pxEdicion ?? "d"}`}
              codTienda={item.codTienda}
              idLista={celda.idLista}
              costoCompra={item.costoCompra}
              celda={celdaVista}
              puedeEditar={puedeEditar}
              onDraft={handlePxDraft}
              onSaved={handleCeldaSaved}
            />
          </TableCell>,
          <TableCell
            key={`${item.codTienda}-${celda.idLista}-mg`}
            className={cn(
              "celda-datos celda-numero celda-marcacion-col",
              listaActualizar && "celda-px-listas-actualizar"
            )}
          >
            <CeldaMargenLista
              key={`${item.codTienda}-${celda.idLista}-mg-${celda.margenPct ?? "n"}-${celda.pxEdicion ?? "d"}`}
              codTienda={item.codTienda}
              idLista={celda.idLista}
              costoCompra={item.costoCompra}
              celda={celdaVista}
              puedeEditar={puedeEditar}
              onDraft={handleMargenDraft}
              onSaved={handleCeldaSaved}
            />
          </TableCell>
        );

        return celdas;
      })}
    </TableRow>
  );
}

export default function TablaPxListasPrecios({
  items: inicial,
  listas,
  puedeEditar,
  categoriasMc,
  idListaGeneral,
  mensajeVacio,
}: Props) {
  const [items, setItems] = useState(inicial);

  useEffect(() => {
    setItems(inicial);
  }, [inicial]);

  const handleItemChange = useCallback((updated: ItemPxListasPreciosTabla) => {
    setItems((prev) =>
      prev.map((item) =>
        item.codTienda === updated.codTienda ? updated : item
      )
    );
  }, []);

  const tieneGeneral =
    idListaGeneral != null &&
    listas.some((l) => l.idLista === idListaGeneral);
  const subcolCount = listas.length * 2 + (tieneGeneral ? 1 : 0);
  const colCount = 2 + subcolCount;
  const pctSubcolLista =
    subcolCount > 0 ? PX_LISTAS_PCT_LISTAS / subcolCount : 0;
  const tablasListasMinWidthRem =
    listas.length * PX_LISTAS_MIN_ANCHO_SUBCOL_REM * 2 +
    (tieneGeneral ? PX_LISTAS_MIN_ANCHO_REF_REM : 0);

  return (
    <Table
      variant="compact"
      scrollX
      className="tabla-px-listas-listado tabla-px-listas-precios"
      style={{
        ["--px-listas-num-listas" as string]: String(listas.length),
        minWidth: `max(100cqw, calc(${PX_LISTAS_PCT_DESCRIPCION}cqw + ${PX_LISTAS_PCT_CATEGORIA_MC}cqw + max(${PX_LISTAS_PCT_LISTAS}cqw, ${tablasListasMinWidthRem}rem)))`,
        width: `max(100cqw, calc(${PX_LISTAS_PCT_DESCRIPCION}cqw + ${PX_LISTAS_PCT_CATEGORIA_MC}cqw + max(${PX_LISTAS_PCT_LISTAS}cqw, ${tablasListasMinWidthRem}rem)))`,
      }}
    >
      <colgroup>
        <col className="col-px-listas-desc" />
        <col className="col-px-listas-cat" />
        {listas.flatMap((lista) => {
          const esGeneral =
            idListaGeneral != null && lista.idLista === idListaGeneral;
          const cols: ReactElement[] = [];
          if (esGeneral) {
            cols.push(
              <col
                key={`${lista.idLista}-ref`}
                className="col-px-listas-lista col-px-listas-ref"
                style={{ width: `${pctSubcolLista}%` }}
              />
            );
          }
          cols.push(
            <col
              key={`${lista.idLista}-px`}
              className="col-px-listas-lista"
              style={{ width: `${pctSubcolLista}%` }}
            />,
            <col
              key={`${lista.idLista}-mg`}
              className="col-px-listas-lista"
              style={{ width: `${pctSubcolLista}%` }}
            />
          );
          return cols;
        })}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead
            rowSpan={2}
            className="align-middle celda-px-listas-col-fija celda-px-listas-col-fija-desc"
          >
            DESCRIPCIÓN
          </TableHead>
          <TableHead
            rowSpan={2}
            className="align-middle celda-px-listas-col-fija celda-px-listas-col-fija-cat"
          >
            CATEGORÍA M.C
          </TableHead>
          {listas.map((lista) => {
            const esGeneral =
              idListaGeneral != null && lista.idLista === idListaGeneral;
            return (
              <TableHead
                key={lista.idLista}
                colSpan={esGeneral ? 3 : 2}
                className="text-center border-l border-primary-foreground/25 tabla-px-listas-col-lista"
              >
                {lista.nombreLista.toUpperCase()}
              </TableHead>
            );
          })}
        </TableRow>
        <TableRow>
          {listas.flatMap((lista) => {
            const esGeneral =
              idListaGeneral != null && lista.idLista === idListaGeneral;
            const heads: ReactElement[] = [];
            if (esGeneral) {
              heads.push(
                <TableHead
                  key={`${lista.idLista}-ref-h`}
                  className="text-center border-l border-primary-foreground/25 tabla-px-listas-col-lista"
                >
                  REF.
                </TableHead>
              );
            }
            heads.push(
              <TableHead
                key={`${lista.idLista}-px-h`}
                className={cn(
                  "text-center tabla-px-listas-col-lista",
                  !esGeneral && "border-l border-primary-foreground/25"
                )}
              >
                PX
              </TableHead>,
              <TableHead
                key={`${lista.idLista}-mg-h`}
                className="text-center tabla-px-listas-col-lista"
              >
                PORC. UTILIDAD
              </TableHead>
            );
            return heads;
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <EmptyTableRow colSpan={colCount} message={mensajeVacio} />
        ) : (
          items.map((item) => (
            <FilaPxListasPrecios
              key={item.codTienda}
              item={item}
              puedeEditar={puedeEditar}
              onItemChange={handleItemChange}
              categoriasMc={categoriasMc}
              idListaGeneral={idListaGeneral}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}
