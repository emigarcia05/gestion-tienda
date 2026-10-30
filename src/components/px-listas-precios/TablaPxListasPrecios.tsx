"use client";

import { useState, useTransition, type ReactElement } from "react";
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
import { guardarPxListaCompetenciaRefAction } from "@/actions/pxListasPrecios";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import PxListaEnteroInput from "@/components/shared/PxListaEnteroInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcPxListaDesdeMargenSinIvaPct } from "@/lib/calculos";
import {
  parsePorcentajeCentNormalized,
  porcentajeCentFromNumber,
} from "@/lib/porcentajeCentMask";
import { PX_LISTAS_COMP_REF_NINGUNO } from "@/lib/pxListasCompetenciaRef";
import {
  margenDesdePrecioDux,
  armarCeldaPrecioPxListas,
  celdaConCambioPxListas,
  claveCambioPxListas,
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
} from "@/lib/pxListasPreciosFormat";
import type {
  ItemPxListasPreciosTabla,
  ListaPrecioPxListasColumna,
  PrecioListaPxListasCelda,
} from "@/lib/pxListasPrecios";
import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";
import { resolverCategoriaMargenPxListas } from "@/lib/pxListasPreciosCategoria";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import { cn } from "@/lib/utils";

/** `null` descarta el pendiente (el valor en pantalla volvió a coincidir con la BD). */
export type OnCambioPxListas = (
  codTienda: string,
  idLista: number,
  cambio: CambioPxListas | null
) => void;

interface Props {
  items: ItemPxListasPreciosTabla[];
  listas: ListaPrecioPxListasColumna[];
  puedeEditar: boolean;
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
  mensajeVacio: string;
  /** Cambios sin guardar (clave `claveCambioPxListas`); se graban con **Guardar Cambios**. */
  cambios: ReadonlyMap<string, CambioPxListas>;
  onCambio: OnCambioPxListas;
  onItemChange: (item: ItemPxListasPreciosTabla) => void;
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

/** Celda con valor en pantalla distinto al de la BD (pendiente de **Guardar Cambios**). */
const CELDA_PENDIENTE_CLASS = "celda-px-listas-pendiente";

function actualizarCeldaEnItem(
  item: ItemPxListasPreciosTabla,
  idLista: number,
  celdaNueva: PrecioListaPxListasCelda
): ItemPxListasPreciosTabla {
  return {
    ...item,
    preciosPorLista: item.preciosPorLista.map((c) =>
      c.idLista === idLista ? celdaNueva : c
    ),
  };
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
  idLista,
  celda,
  puedeEditar,
  onDraft,
  onConfirmar,
}: {
  idLista: number;
  celda: PrecioListaPxListasCelda;
  puedeEditar: boolean;
  onDraft: (idLista: number, px: number | null) => void;
  /** Al salir de la celda tras tipear: texto normalizado de la máscara. */
  onConfirmar: (idLista: number, texto: string) => void;
}) {
  const [draftLocal, setDraftLocal] = useState<string | null>(null);
  const tieneEdicion = celda.pxEdicion != null;
  const draft = draftLocal ?? pxListaEnteroFromNumber(celda.pxEfectivo);

  if (!puedeEditar) {
    return (
      <Input
        type="text"
        readOnly
        value={fmtPxListaTabla(celda.pxEfectivo)}
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
        setDraftLocal(next);
        if (next.trim() === "") {
          onDraft(idLista, null);
          return;
        }
        const px = parsePxListaEnteroNormalized(next);
        if (px !== undefined) onDraft(idLista, px);
      }}
      onCommit={() => {
        if (draftLocal === null) return;
        onConfirmar(idLista, draftLocal);
        setDraftLocal(null);
      }}
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
  idLista,
  celda,
  puedeEditar,
  onDraft,
  onConfirmar,
}: {
  idLista: number;
  celda: PrecioListaPxListasCelda;
  puedeEditar: boolean;
  onDraft: (idLista: number, margen: number | null) => void;
  onConfirmar: (idLista: number, texto: string) => void;
}) {
  const [draftLocal, setDraftLocal] = useState<string | null>(null);
  const tieneEdicion = celda.pxEdicion != null;
  const draft =
    draftLocal ??
    (celda.margenPct != null
      ? porcentajeCentFromNumber(celda.margenPct, MARGEN_PX_LISTA_MAX_CENTS, true)
      : "");

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
        setDraftLocal(next);
        if (next.trim() === "") {
          onDraft(idLista, null);
          return;
        }
        const margen = parsePorcentajeCentNormalized(next, MARGEN_PX_LISTA_MAX_CENTS);
        if (margen !== undefined) onDraft(idLista, margen);
      }}
      onCommit={() => {
        if (draftLocal === null) return;
        onConfirmar(idLista, draftLocal);
        setDraftLocal(null);
      }}
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
  hayCambioGeneral,
  onItemChange,
  onCambio,
}: {
  item: ItemPxListasPreciosTabla;
  puedeEditar: boolean;
  idListaGeneral: number;
  /** Con PX/PORC. de GENERAL editado sin guardar, al guardar se quita el competidor: se muestra "-". */
  hayCambioGeneral: boolean;
  onItemChange: (item: ItemPxListasPreciosTabla) => void;
  onCambio: OnCambioPxListas;
}) {
  const [saving, startTransition] = useTransition();
  const value = hayCambioGeneral
    ? PX_LISTAS_COMP_REF_NINGUNO
    : (item.competenciaIdPxListaGeneral ?? PX_LISTAS_COMP_REF_NINGUNO);

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

      let nextItem: ItemPxListasPreciosTabla = {
        ...item,
        competenciaIdPxListaGeneral: res.data.competenciaIdPxListaGeneral,
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
        /** El competidor ya grabó el PX de GENERAL: el pendiente de esa celda queda obsoleto. */
        onCambio(item.codTienda, idListaGeneral, null);
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
  cambios,
  onCambio,
  onItemChange,
  categoriasMc,
  idListaGeneral,
}: {
  item: ItemPxListasPreciosTabla;
  puedeEditar: boolean;
  cambios: ReadonlyMap<string, CambioPxListas>;
  onCambio: OnCambioPxListas;
  onItemChange: (item: ItemPxListasPreciosTabla) => void;
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
}) {
  const [draftPorLista, setDraftPorLista] = useState<
    Record<number, DraftCeldaPxListas>
  >({});

  const cambioDe = (idLista: number) =>
    cambios.get(claveCambioPxListas(item.codTienda, idLista));
  const filaPendiente = item.preciosPorLista.some((c) => cambioDe(c.idLista) != null);

  /** Celda en pantalla: la de la BD con el cambio pendiente aplicado (sin el borrador de tipeo). */
  const celdaEnPantalla = (celda: PrecioListaPxListasCelda) => {
    const cambio = cambioDe(celda.idLista);
    return cambio ? celdaConCambioPxListas(celda, item.costoCompra, cambio) : celda;
  };

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

  const celdaBd = (idLista: number) =>
    item.preciosPorLista.find((c) => c.idLista === idLista);

  /** Vaciar la celda = volver al precio DUX (si en la BD no hay edición, no hay nada que cambiar). */
  const registrarVaciado = (
    idLista: number,
    bd: PrecioListaPxListasCelda,
    tipo: CambioPxListas["tipo"]
  ) => {
    if (bd.pxEdicion == null) {
      onCambio(item.codTienda, idLista, null);
      return;
    }
    onCambio(
      item.codTienda,
      idLista,
      tipo === "px"
        ? { codTienda: item.codTienda, idLista, tipo: "px", pxEdicion: null }
        : { codTienda: item.codTienda, idLista, tipo: "margen", margenManual: null }
    );
  };

  const confirmarPx = (idLista: number, texto: string) => {
    limpiarDraft(idLista);
    const bd = celdaBd(idLista);
    if (!bd) return;
    if (texto.trim() === "") {
      registrarVaciado(idLista, bd, "px");
      return;
    }
    const px = parsePxListaEnteroNormalized(texto);
    if (px === undefined || !(px > 0)) {
      toast.error("Precio inválido.");
      return;
    }
    if (bd.pxEfectivo != null && preciosPxListaEnterosIguales(px, bd.pxEfectivo)) {
      onCambio(item.codTienda, idLista, null);
      return;
    }
    onCambio(item.codTienda, idLista, {
      codTienda: item.codTienda,
      idLista,
      tipo: "px",
      pxEdicion: px,
    });
  };

  const confirmarMargen = (idLista: number, texto: string) => {
    limpiarDraft(idLista);
    const bd = celdaBd(idLista);
    if (!bd) return;
    if (texto.trim() === "") {
      registrarVaciado(idLista, bd, "margen");
      return;
    }
    const margen = parsePorcentajeCentNormalized(texto, MARGEN_PX_LISTA_MAX_CENTS);
    if (margen === undefined) {
      toast.error("Margen inválido.");
      return;
    }
    if (bd.margenPct != null && !margenesPorcUtilidadDifieren(margen, bd.margenPct)) {
      onCambio(item.codTienda, idLista, null);
      return;
    }
    if (!(item.costoCompra > 0)) {
      toast.error("Sin costo de compra no se puede calcular el precio desde el margen.");
      return;
    }
    onCambio(item.codTienda, idLista, {
      codTienda: item.codTienda,
      idLista,
      tipo: "margen",
      margenManual: margen,
    });
  };

  const celdaGeneral =
    idListaGeneral == null
      ? null
      : item.preciosPorLista.find((c) => c.idLista === idListaGeneral) ?? null;
  const draftGeneral =
    idListaGeneral == null ? undefined : draftPorLista[idListaGeneral];
  const porcUtilidadGeneral = celdaGeneral
    ? aplicarDraftCelda(celdaEnPantalla(celdaGeneral), draftGeneral).margenPct
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
          filaPendiente && CELDA_PENDIENTE_CLASS
        )}
      >
        <span className="block truncate" title={item.descripcion}>
          {item.descripcion}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos whitespace-nowrap celda-px-listas-col-fija celda-px-listas-col-fija-cat",
          filaPendiente && CELDA_PENDIENTE_CLASS
        )}
        title={categoriaMargen || undefined}
      >
        <span className="block truncate">{categoriaMargen}</span>
      </TableCell>
      {item.preciosPorLista.flatMap((celda) => {
        const pendiente = cambioDe(celda.idLista) != null;
        const celdaPantalla = celdaEnPantalla(celda);
        const celdaVista = aplicarDraftCelda(celdaPantalla, draftPorLista[celda.idLista]);
        const esGeneral =
          idListaGeneral != null && celda.idLista === idListaGeneral;

        const celdas: ReactElement[] = [];

        if (esGeneral && idListaGeneral != null) {
          celdas.push(
            <TableCell
              key={`${item.codTienda}-${celda.idLista}-ref`}
              className={cn(
                "celda-datos celda-px-lista-ref-col border-l border-border",
                pendiente && CELDA_PENDIENTE_CLASS
              )}
            >
              <CeldaCompetenciaRefGeneral
                item={item}
                puedeEditar={puedeEditar}
                idListaGeneral={idListaGeneral}
                hayCambioGeneral={pendiente}
                onItemChange={onItemChange}
                onCambio={onCambio}
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
              pendiente && CELDA_PENDIENTE_CLASS
            )}
          >
            <CeldaPxLista
              key={`${item.codTienda}-${celda.idLista}-px`}
              idLista={celda.idLista}
              celda={celdaVista}
              puedeEditar={puedeEditar}
              onDraft={handlePxDraft}
              onConfirmar={confirmarPx}
            />
          </TableCell>,
          <TableCell
            key={`${item.codTienda}-${celda.idLista}-mg`}
            className={cn(
              "celda-datos celda-numero celda-marcacion-col",
              pendiente && CELDA_PENDIENTE_CLASS
            )}
          >
            <CeldaMargenLista
              key={`${item.codTienda}-${celda.idLista}-mg`}
              idLista={celda.idLista}
              celda={celdaVista}
              puedeEditar={puedeEditar}
              onDraft={handleMargenDraft}
              onConfirmar={confirmarMargen}
            />
          </TableCell>
        );

        return celdas;
      })}
    </TableRow>
  );
}

export default function TablaPxListasPrecios({
  items,
  listas,
  puedeEditar,
  categoriasMc,
  idListaGeneral,
  mensajeVacio,
  cambios,
  onCambio,
  onItemChange,
}: Props) {
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
              cambios={cambios}
              onCambio={onCambio}
              onItemChange={onItemChange}
              categoriasMc={categoriasMc}
              idListaGeneral={idListaGeneral}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}
