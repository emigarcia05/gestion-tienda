"use client";

import { useRef, useState, type ReactElement } from "react";
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
  celdaPxListasEnPantalla,
  claveCambioPxListas,
  precioListaMostradoDifiereDefinitivo,
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
  /**
   * REF. de GENERAL sin guardar. `null` = quitar el vínculo.
   * Ausente en el mapa = sigue el valor de la BD.
   */
  refsPendientes: ReadonlyMap<string, string | null>;
  onCambio: OnCambioPxListas;
  onRefPendiente: (codTienda: string, competenciaId: string | null) => void;
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

/** Fila cuyo precio en pantalla difiere del definitivo de Ventas (`prod_lista_precios`). */
const FILA_PENDIENTE_CLASS = "fila-px-listas-pendiente";

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
  /** Al salir de la celda: texto normalizado de la máscara (el pendiente ya se anotó al tipear). */
  onConfirmar: (idLista: number, texto: string) => void;
}) {
  const [draftLocal, setDraftLocal] = useState<string | null>(null);
  const draftLocalRef = useRef<string | null>(null);
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
        draftLocalRef.current = next;
        setDraftLocal(next);
        if (next.trim() === "") {
          onDraft(idLista, null);
          return;
        }
        const px = parsePxListaEnteroNormalized(next);
        if (px !== undefined) onDraft(idLista, px);
      }}
      onCommit={() => {
        const texto = draftLocalRef.current;
        if (texto === null) return;
        draftLocalRef.current = null;
        setDraftLocal(null);
        onConfirmar(idLista, texto);
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
  const draftLocalRef = useRef<string | null>(null);
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
        draftLocalRef.current = next;
        setDraftLocal(next);
        if (next.trim() === "") {
          onDraft(idLista, null);
          return;
        }
        const margen = parsePorcentajeCentNormalized(next, MARGEN_PX_LISTA_MAX_CENTS);
        if (margen !== undefined) onDraft(idLista, margen);
      }}
      onCommit={() => {
        const texto = draftLocalRef.current;
        if (texto === null) return;
        draftLocalRef.current = null;
        setDraftLocal(null);
        onConfirmar(idLista, texto);
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
  hayCambioGeneral,
  refPendiente,
  onRefPendiente,
}: {
  item: ItemPxListasPreciosTabla;
  puedeEditar: boolean;
  /** Con PX/PORC. de GENERAL editado a mano, al guardar se quita el competidor: se muestra "-". */
  hayCambioGeneral: boolean;
  /** `undefined` = sin pendiente; `null` = quitar el vínculo al guardar. */
  refPendiente: string | null | undefined;
  onRefPendiente: (codTienda: string, competenciaId: string | null) => void;
}) {
  const value = hayCambioGeneral
    ? PX_LISTAS_COMP_REF_NINGUNO
    : refPendiente !== undefined
      ? (refPendiente ?? PX_LISTAS_COMP_REF_NINGUNO)
      : (item.competenciaIdPxListaGeneral ?? PX_LISTAS_COMP_REF_NINGUNO);

  function handleChange(next: string) {
    onRefPendiente(
      item.codTienda,
      next === PX_LISTAS_COMP_REF_NINGUNO ? null : next
    );
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
    <Select value={value} onValueChange={handleChange}>
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
  refsPendientes,
  onCambio,
  onRefPendiente,
  categoriasMc,
  idListaGeneral,
}: {
  item: ItemPxListasPreciosTabla;
  puedeEditar: boolean;
  cambios: ReadonlyMap<string, CambioPxListas>;
  refsPendientes: ReadonlyMap<string, string | null>;
  onCambio: OnCambioPxListas;
  onRefPendiente: (codTienda: string, competenciaId: string | null) => void;
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
}) {
  const [draftPorLista, setDraftPorLista] = useState<
    Record<number, DraftCeldaPxListas>
  >({});

  const cambioDe = (idLista: number) =>
    cambios.get(claveCambioPxListas(item.codTienda, idLista));
  const tieneRefPendiente = refsPendientes.has(item.codTienda);
  const refPendiente = tieneRefPendiente
    ? (refsPendientes.get(item.codTienda) ?? null)
    : undefined;

  /** Celda en pantalla: la de la BD con el cambio pendiente aplicado (sin el borrador de tipeo). */
  const celdaEnPantalla = (celda: PrecioListaPxListasCelda) =>
    celdaPxListasEnPantalla(item, celda, cambios, refPendiente, idListaGeneral);

  const filaPendiente = item.preciosPorLista.some((celda) =>
    precioListaMostradoDifiereDefinitivo(
      aplicarDraftCelda(celdaEnPantalla(celda), draftPorLista[celda.idLista])
    )
  );

  const limpiarDraft = (idLista: number) => {
    setDraftPorLista((prev) => {
      if (!(idLista in prev)) return prev;
      const next = { ...prev };
      delete next[idLista];
      return next;
    });
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

  /** Anota el pendiente en cuanto el valor difiere de la BD, sin esperar a salir de la celda. */
  const registrarPx = (idLista: number, px: number | null) => {
    const bd = celdaBd(idLista);
    if (!bd) return;
    if (px == null || !(px > 0)) {
      registrarVaciado(idLista, bd, "px");
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

  const registrarMargen = (
    idLista: number,
    margen: number | null,
    avisarSinCosto: boolean
  ) => {
    const bd = celdaBd(idLista);
    if (!bd) return;
    if (margen == null) {
      registrarVaciado(idLista, bd, "margen");
      return;
    }
    if (bd.margenPct != null && !margenesPorcUtilidadDifieren(margen, bd.margenPct)) {
      onCambio(item.codTienda, idLista, null);
      return;
    }
    if (!(item.costoCompra > 0)) {
      if (avisarSinCosto) {
        toast.error("Sin costo de compra no se puede calcular el precio desde el margen.");
      }
      return;
    }
    onCambio(item.codTienda, idLista, {
      codTienda: item.codTienda,
      idLista,
      tipo: "margen",
      margenManual: margen,
    });
  };

  const handleMargenDraft = (idLista: number, margen: number | null) => {
    if (margen == null) {
      limpiarDraft(idLista);
      registrarMargen(idLista, null, false);
      return;
    }
    const px = calcPxListaDesdeMargenSinIvaPct(margen, item.costoCompra);
    setDraftPorLista((prev) => ({
      ...prev,
      [idLista]: { px, margen },
    }));
    registrarMargen(idLista, margen, false);
  };

  const handlePxDraft = (idLista: number, px: number | null) => {
    if (px == null) {
      limpiarDraft(idLista);
      registrarPx(idLista, null);
      return;
    }
    const margen = margenDesdePrecioDux(px, item.costoCompra);
    setDraftPorLista((prev) => ({
      ...prev,
      [idLista]: { px, margen },
    }));
    registrarPx(idLista, px);
  };

  const confirmarPx = (idLista: number, texto: string) => {
    limpiarDraft(idLista);
    if (texto.trim() === "") {
      registrarPx(idLista, null);
      return;
    }
    const px = parsePxListaEnteroNormalized(texto);
    if (px === undefined || !(px > 0)) {
      toast.error("Precio inválido.");
      return;
    }
    registrarPx(idLista, px);
  };

  const confirmarMargen = (idLista: number, texto: string) => {
    limpiarDraft(idLista);
    if (texto.trim() === "") {
      registrarMargen(idLista, null, false);
      return;
    }
    const margen = parsePorcentajeCentNormalized(texto, MARGEN_PX_LISTA_MAX_CENTS);
    if (margen === undefined) {
      toast.error("Margen inválido.");
      return;
    }
    registrarMargen(idLista, margen, true);
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
    <TableRow className={cn(filaPendiente && FILA_PENDIENTE_CLASS)}>
      <TableCell
        className="celda-datos celda-px-listas-col-fija celda-px-listas-col-fija-desc"
      >
        <span className="block truncate" title={item.descripcion}>
          {item.descripcion}
        </span>
      </TableCell>
      <TableCell
        className="celda-datos whitespace-nowrap celda-px-listas-col-fija celda-px-listas-col-fija-cat"
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
              className="celda-datos celda-px-lista-ref-col border-l border-border"
            >
              <CeldaCompetenciaRefGeneral
                item={item}
                puedeEditar={puedeEditar}
                hayCambioGeneral={pendiente}
                refPendiente={refPendiente}
                onRefPendiente={onRefPendiente}
              />
            </TableCell>
          );
        }

        celdas.push(
          <TableCell
            key={`${item.codTienda}-${celda.idLista}-px`}
            className={cn(
              "celda-datos celda-numero celda-px-lista-col",
              !esGeneral && "border-l border-border"
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
            className="celda-datos celda-numero celda-marcacion-col"
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
  refsPendientes,
  onCambio,
  onRefPendiente,
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
              refsPendientes={refsPendientes}
              onCambio={onCambio}
              onRefPendiente={onRefPendiente}
              categoriasMc={categoriasMc}
              idListaGeneral={idListaGeneral}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}
