"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import { toast } from "sonner";
import {
  getPxVentaItemModalAction,
  guardarPxVentaDesdeItemAction,
} from "@/actions/listaProductos";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPrecio } from "@/lib/format";
import {
  parsePorcentajeCentNormalized,
  porcentajeCentFromNumber,
} from "@/lib/porcentajeCentMask";
import { PX_LISTAS_COMP_REF_NINGUNO } from "@/lib/pxListasCompetenciaRef";
import {
  celdaPxListasEnPantalla,
  claveCambioPxListas,
} from "@/lib/pxListasPreciosCelda";
import { resolverCategoriaMargenPxListas } from "@/lib/pxListasPreciosCategoria";
import {
  MARGEN_PX_LISTA_MAX_CENTS,
  margenesPorcUtilidadDifieren,
} from "@/lib/pxListasPreciosFormat";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import type {
  ItemPxListasPreciosTabla,
  ListaPrecioPxListasColumna,
  PrecioListaPxListasCelda,
} from "@/lib/pxListasPrecios";
import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";
import { cn } from "@/lib/utils";

export type PxVentaItemHandle = {
  /** Persiste REF. y PORC. UTILIDAD. Sin cambios, no llama al servidor. */
  guardar: (codTienda: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

interface DatosPxListasItem {
  listas: ListaPrecioPxListasColumna[];
  idListaGeneral: number | null;
  categoriasMc: FinAnaMcCategoriaItem[];
  item: ItemPxListasPreciosTabla;
}

const INPUT_MARGEN_CLASS =
  "h-[calc(var(--tabla-body-row-min-height)-0.5rem)] min-w-0 max-h-full text-xs tabular-nums";

function textoPx(valor: number | null): string {
  if (valor == null || !(valor > 0)) return "";
  return `$${fmtPrecio(valor)}`;
}

function itemConCostoElegido(
  item: ItemPxListasPreciosTabla,
  costoElegido: number | null | undefined
): ItemPxListasPreciosTabla {
  if (costoElegido == null || !(costoElegido > 0)) return item;
  if (costoElegido === item.costoCompra) return item;
  return { ...item, costoCompra: costoElegido };
}

function PxListasItemEnProductoInner(
  {
    codTienda,
    costoCompra = null,
    disabled = false,
  }: {
    codTienda: string | null;
    /** Costo del ítem de proveedor elegido, antes de que exista el producto de tienda. */
    costoCompra?: number | null;
    disabled?: boolean;
  },
  ref: Ref<PxVentaItemHandle>
) {
  const [datos, setDatos] = useState<DatosPxListasItem | null>(null);
  const [cambios, setCambios] = useState<Map<string, CambioPxListas>>(new Map());
  const [refPendiente, setRefPendiente] = useState<string | null | undefined>(undefined);
  const cambiosRef = useRef(cambios);
  const refPendienteRef = useRef(refPendiente);
  const datosRef = useRef(datos);
  const costoElegidoRef = useRef(costoCompra);

  useEffect(() => {
    datosRef.current = datos;
  }, [datos]);

  useEffect(() => {
    costoElegidoRef.current = costoCompra;
  }, [costoCompra]);

  useEffect(() => {
    let cancelado = false;
    getPxVentaItemModalAction(codTienda).then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        setDatos(null);
        return;
      }
      const vacio = new Map<string, CambioPxListas>();
      cambiosRef.current = vacio;
      refPendienteRef.current = undefined;
      setDatos(res.data);
      setCambios(vacio);
      setRefPendiente(undefined);
    });
    return () => {
      cancelado = true;
    };
  }, [codTienda]);

  useImperativeHandle(ref, () => ({
    async guardar(cod) {
      const actual = datosRef.current;
      if (!actual) return { ok: true };
      const cambiosGuardar = [...cambiosRef.current.values()].map((cambio) => ({
        ...cambio,
        codTienda: cod,
      }));
      const pendiente = refPendienteRef.current;
      const enBd = actual.item.competenciaIdPxListaGeneral ?? null;
      const actualizarCompetencia = pendiente !== undefined && pendiente !== enBd;
      if (cambiosGuardar.length === 0 && !actualizarCompetencia) return { ok: true };
      const res = await guardarPxVentaDesdeItemAction({
        codTienda: cod,
        cambios: cambiosGuardar,
        competenciaId: pendiente === undefined ? null : pendiente,
        actualizarCompetencia,
      });
      if (!res.ok) return { ok: false, error: res.error };
      const vacio = new Map<string, CambioPxListas>();
      cambiosRef.current = vacio;
      refPendienteRef.current = undefined;
      setCambios(vacio);
      setRefPendiente(undefined);
      return { ok: true };
    },
  }));

  function registrarMargen(idLista: number, margen: number | null, avisarSinCosto: boolean) {
    const actual = datosRef.current;
    if (!actual) return;
    const item = itemConCostoElegido(actual.item, costoElegidoRef.current);
    const bd = item.preciosPorLista.find((c) => c.idLista === idLista);
    if (!bd) return;
    const cod = item.codTienda;
    const clave = claveCambioPxListas(cod, idLista);
    const esNuevoMargen =
      margen != null &&
      (bd.margenPct == null || margenesPorcUtilidadDifieren(margen, bd.margenPct));
    if (esNuevoMargen && !(item.costoCompra > 0)) {
      if (avisarSinCosto) {
        toast.error("Sin costo de compra no se puede calcular el precio desde el margen.");
      }
      return;
    }
    setCambios((prev) => {
      const next = new Map(prev);
      if (margen == null) {
        if (bd.pxEdicion == null) next.delete(clave);
        else next.set(clave, { codTienda: cod, idLista, tipo: "margen", margenManual: null });
      } else if (!esNuevoMargen) {
        next.delete(clave);
      } else {
        next.set(clave, { codTienda: cod, idLista, tipo: "margen", margenManual: margen });
      }
      cambiosRef.current = next;
      return next;
    });
    if (esNuevoMargen && actual.idListaGeneral != null && idLista === actual.idListaGeneral) {
      refPendienteRef.current = undefined;
      setRefPendiente(undefined);
    }
  }

  function elegirRef(competenciaId: string | null) {
    const actual = datosRef.current;
    if (!actual) return;
    const enBd = actual.item.competenciaIdPxListaGeneral ?? null;
    if (enBd === competenciaId) {
      refPendienteRef.current = undefined;
      setRefPendiente(undefined);
    } else {
      if (competenciaId != null) {
        const op = actual.item.opcionesCompetenciaRef.find(
          (o) => o.competenciaId === competenciaId
        );
        if (!op || !(op.px > 0)) {
          toast.error("No hay precio de referencia para este proveedor.");
          return;
        }
      }
      refPendienteRef.current = competenciaId;
      setRefPendiente(competenciaId);
    }
    const idGeneral = actual.idListaGeneral;
    if (idGeneral == null) return;
    setCambios((prev) => {
      const clave = claveCambioPxListas(actual.item.codTienda, idGeneral);
      if (!prev.has(clave)) return prev;
      const next = new Map(prev);
      next.delete(clave);
      cambiosRef.current = next;
      return next;
    });
  }

  if (!datos) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const { listas, idListaGeneral, categoriasMc } = datos;
  const item = itemConCostoElegido(datos.item, costoCompra);
  const refVista =
    refPendiente !== undefined
      ? refPendiente
      : (item.competenciaIdPxListaGeneral ?? null);
  const generalBd =
    idListaGeneral == null
      ? null
      : (item.preciosPorLista.find((c) => c.idLista === idListaGeneral) ?? null);
  const generalVista =
    generalBd == null
      ? null
      : celdaPxListasEnPantalla(item, generalBd, cambios, refPendiente, idListaGeneral);
  const hayCambioGeneral =
    idListaGeneral != null &&
    cambios.has(claveCambioPxListas(item.codTienda, idListaGeneral));
  const categoria = resolverCategoriaMargenPxListas(generalVista?.margenPct, categoriasMc);
  const columnas =
    1 + listas.reduce((acc, lista) => acc + (lista.idLista === idListaGeneral ? 3 : 2), 0);

  return (
    <div className="overflow-x-auto">
      <Table variant="compact" className="w-full min-w-[36rem]" scrollX={false}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="align-middle text-center">
              CAT. M.C.
            </TableHead>
            {listas.map((lista) => {
              const esGeneral = lista.idLista === idListaGeneral;
              return (
                <TableHead
                  key={lista.idLista}
                  colSpan={esGeneral ? 3 : 2}
                  className="border-l border-primary-foreground/25 text-center"
                >
                  {lista.nombreLista.toUpperCase()}
                </TableHead>
              );
            })}
          </TableRow>
          <TableRow>
            {listas.flatMap((lista) => {
              const esGeneral = lista.idLista === idListaGeneral;
              const heads: ReactElement[] = [];
              if (esGeneral) {
                heads.push(
                  <TableHead
                    key={`${lista.idLista}-ref`}
                    className="border-l border-primary-foreground/25 text-center"
                  >
                    REF.
                  </TableHead>
                );
              }
              heads.push(
                <TableHead
                  key={`${lista.idLista}-px`}
                  className={cn(
                    "text-center",
                    !esGeneral && "border-l border-primary-foreground/25"
                  )}
                >
                  PX
                </TableHead>,
                <TableHead key={`${lista.idLista}-mg`} className="text-center">
                  PORC. UTILIDAD
                </TableHead>
              );
              return heads;
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {listas.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnas}
                className="celda-datos text-center text-sm text-muted-foreground"
              >
                Sin listas de precios.
              </TableCell>
            </TableRow>
          ) : (
            <TableRow>
              <TableCell className="celda-datos whitespace-nowrap text-center" title={categoria || undefined}>
                {categoria}
              </TableCell>
              {listas.flatMap((lista) => {
                const esGeneral = lista.idLista === idListaGeneral;
                const bd = item.preciosPorLista.find((c) => c.idLista === lista.idLista) ?? null;
                const vista =
                  bd == null
                    ? null
                    : celdaPxListasEnPantalla(item, bd, cambios, refPendiente, idListaGeneral);
                const celdas: ReactElement[] = [];
                if (esGeneral) {
                  celdas.push(
                    <TableCell
                      key={`${lista.idLista}-ref`}
                      className="celda-datos border-l border-border"
                    >
                      <SelectRefProveedor
                        item={item}
                        value={hayCambioGeneral ? null : refVista}
                        disabled={disabled}
                        onChange={elegirRef}
                      />
                    </TableCell>
                  );
                }
                celdas.push(
                  <TableCell
                    key={`${lista.idLista}-px`}
                    className={cn(
                      "celda-datos celda-numero text-center",
                      !esGeneral && "border-l border-border"
                    )}
                  >
                    {textoPx(vista?.pxEfectivo ?? null)}
                  </TableCell>,
                  <TableCell key={`${lista.idLista}-mg`} className="celda-datos celda-numero">
                    <CeldaPorcUtilidad
                      idLista={lista.idLista}
                      celda={vista}
                      disabled={disabled}
                      onMargen={(margen, avisar) => registrarMargen(lista.idLista, margen, avisar)}
                    />
                  </TableCell>
                );
                return celdas;
              })}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const PxListasItemEnProducto = forwardRef(PxListasItemEnProductoInner);
PxListasItemEnProducto.displayName = "PxListasItemEnProducto";
export default PxListasItemEnProducto;

function SelectRefProveedor({
  item,
  value,
  disabled,
  onChange,
}: {
  item: ItemPxListasPreciosTabla;
  value: string | null;
  disabled: boolean;
  onChange: (competenciaId: string | null) => void;
}) {
  const seleccionado = value ?? PX_LISTAS_COMP_REF_NINGUNO;
  return (
    <Select
      value={seleccionado}
      disabled={disabled}
      onValueChange={(next) =>
        onChange(next === PX_LISTAS_COMP_REF_NINGUNO ? null : next)
      }
    >
      <SelectTrigger
        className="h-8 min-h-0 w-full min-w-0 px-1.5 text-xs"
        aria-label="Proveedor de referencia"
        size="sm"
      >
        <SelectValue placeholder="-" />
      </SelectTrigger>
      <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
        <SelectItem value={PX_LISTAS_COMP_REF_NINGUNO}>-</SelectItem>
        {item.opcionesCompetenciaRef.map((op) => (
          <SelectItem key={op.competenciaId} value={op.competenciaId} title={op.nombre}>
            {op.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CeldaPorcUtilidad({
  idLista,
  celda,
  disabled,
  onMargen,
}: {
  idLista: number;
  celda: PrecioListaPxListasCelda | null;
  disabled: boolean;
  onMargen: (margen: number | null, avisarSinCosto: boolean) => void;
}) {
  const [draftLocal, setDraftLocal] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const mostrado =
    draftLocal ??
    (celda?.margenPct != null
      ? porcentajeCentFromNumber(celda.margenPct, MARGEN_PX_LISTA_MAX_CENTS, true)
      : "");

  return (
    <PorcentajeCentInput
      valueNormalized={mostrado}
      maxCents={MARGEN_PX_LISTA_MAX_CENTS}
      disabled={disabled}
      onValueNormalizedChange={(next) => {
        draftRef.current = next;
        setDraftLocal(next);
        if (next.trim() === "") {
          onMargen(null, false);
          return;
        }
        const margen = parsePorcentajeCentNormalized(next, MARGEN_PX_LISTA_MAX_CENTS);
        if (margen !== undefined) onMargen(margen, false);
      }}
      onCommit={() => {
        const texto = draftRef.current;
        draftRef.current = null;
        setDraftLocal(null);
        if (texto == null) return;
        if (texto.trim() === "") {
          onMargen(null, false);
          return;
        }
        const margen = parsePorcentajeCentNormalized(texto, MARGEN_PX_LISTA_MAX_CENTS);
        if (margen === undefined) {
          toast.error("Margen inválido.");
          return;
        }
        onMargen(margen, true);
      }}
      className={cn(INPUT_MARGEN_CLASS, "w-full border-primary")}
      aria-label={`Porc. utilidad lista ${idLista}`}
      title="Porc. utilidad"
    />
  );
}
