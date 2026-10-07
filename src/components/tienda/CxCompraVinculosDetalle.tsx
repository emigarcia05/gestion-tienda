"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { fmtPrecio } from "@/lib/format";
import {
  desvincularProducto,
  establecerCostoListaTiendaAction,
  getVinculos,
} from "@/actions/vinculos";
import {
  calcPxBaseVinculosTienda,
  labelVariacionVsBase,
  ordenarFilasVinculosTienda,
  type ProductoVinculoTienda,
} from "@/lib/vinculosTiendaUi";

const SUBFILA_DETALLE_CLASS = "tabla-fila-detalle-competencia";
const SUBFILA_CELDA_BLOQUE_CLASS = "tabla-fila-detalle-competencia-celda";
const SUBFILA_CELDA_HUECA_CLASS = "tabla-fila-detalle-competencia-hueca";
/** RUBRO · SUB-RUBRO · MARCA de `TablaTienda` (Lista Productos): la subfila los cubre con la descripción. */
const COLS_CATALOGO_LISTA_PRODUCTOS = 3;

function CeldaVariacion({ px, pxBase, esBase }: { px: number; pxBase: number | null; esBase: boolean }) {
  if (esBase) {
    return <span className="variacion-costo--neutra text-xs">0%</span>;
  }
  const v = labelVariacionVsBase(px, pxBase);
  if (v.kind === "empty") {
    return <span className="variacion-costo--neutra text-xs">—</span>;
  }
  if (v.kind === "neutral") {
    return <span className="variacion-costo--neutra text-xs">{v.text}</span>;
  }
  if (v.kind === "up") {
    return (
      <span
        className="variacion-costo--positiva flex items-center justify-center gap-0.5 text-xs"
        title={v.title}
      >
        <ArrowUp className="h-3.5 w-3.5 variacion-costo-icon--positiva shrink-0" aria-hidden />
        {v.text}
      </span>
    );
  }
  return (
    <span
      className="variacion-costo--negativa flex items-center justify-center gap-0.5 text-xs"
      title={v.title}
    >
      <ArrowDown className="h-3.5 w-3.5 variacion-costo-icon--negativa shrink-0" aria-hidden />
      {v.text}
    </span>
  );
}

function SubfilaVinculo({
  producto,
  px,
  pxBase,
  esBase,
  esUltima,
  puedeEditar,
  isPending,
  onToggleBase,
  onDesvincular,
}: {
  producto: ProductoVinculoTienda;
  px: number;
  pxBase: number | null;
  esBase: boolean;
  esUltima: boolean;
  puedeEditar: boolean;
  isPending: boolean;
  onToggleBase: (p: ProductoVinculoTienda) => void;
  onDesvincular: (p: ProductoVinculoTienda) => void;
}) {
  return (
    <TableRow
      className={cn(
        SUBFILA_DETALLE_CLASS,
        esUltima && "tabla-fila-detalle-competencia--cierre",
        "hover:bg-transparent"
      )}
    >
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
      <TableCell
        colSpan={1 + COLS_CATALOGO_LISTA_PRODUCTOS}
        className={cn("celda-datos max-w-0", SUBFILA_CELDA_BLOQUE_CLASS)}
      >
        <span className="block truncate text-xs" title={producto.descripcion}>
          {producto.descripcion}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos celda-mono text-center text-xs font-medium text-foreground",
          SUBFILA_CELDA_BLOQUE_CLASS
        )}
      >
        {producto.proveedor.prefijo}
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos p-1 min-w-0 tabla-bloque-secundario-cell-divider",
          SUBFILA_CELDA_BLOQUE_CLASS
        )}
      >
        <div className="cx-compra-subfila-cx-prod">
          <div className="cx-compra-subfila-cx-prod__meta">
            {puedeEditar ? (
              <input
                type="checkbox"
                checked={esBase}
                onChange={() => onToggleBase(producto)}
                disabled={isPending}
                className={cn(
                  "cursor-pointer accent-primary",
                  isPending && "cursor-not-allowed opacity-60"
                )}
                aria-label={
                  esBase
                    ? `Quitar base de comparación (${producto.proveedor.prefijo})`
                    : `Marcar ${producto.proveedor.prefijo} como base de comparación`
                }
                title={
                  esBase
                    ? "Esta fila es la base. Click para destildar (Cx. Prom.)."
                    : "Marcar como base para calcular variaciones del resto."
                }
              />
            ) : null}
            <CeldaVariacion px={px} pxBase={pxBase} esBase={esBase} />
          </div>
          <span
            className="cx-compra-subfila-cx-prod__precio-vinculo celda-numero tabular-nums text-center text-sm font-medium text-foreground"
            aria-label={`Costo ${producto.proveedor.prefijo}`}
          >
            ${fmtPrecio(px)}
          </span>
        </div>
      </TableCell>
      <TableCell className={cn("celda-datos celda-datos--accion-relleno-fila", SUBFILA_CELDA_HUECA_CLASS)}>
        {puedeEditar ? (
          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
              disabled={isPending}
              aria-label={`Desvincular ${producto.proveedor.prefijo}`}
              title="Desvincular"
              onClick={() => onDesvincular(producto)}
            >
              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          </div>
        ) : null}
      </TableCell>
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
    </TableRow>
  );
}

export function CxCompraDetallePropio() {
  return (
    <TableRow
      className={cn(
        SUBFILA_DETALLE_CLASS,
        "tabla-fila-detalle-competencia--cierre",
        "hover:bg-transparent"
      )}
    >
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
      <TableCell
        colSpan={3 + COLS_CATALOGO_LISTA_PRODUCTOS}
        className={cn("celda-datos", SUBFILA_CELDA_BLOQUE_CLASS)}
      >
        <p className="truncate text-center text-xs text-muted-foreground">
          Producto propio TiendaColor — sin vínculos con proveedores.
        </p>
      </TableCell>
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
    </TableRow>
  );
}

export function CxCompraDetalleVacio({ codTienda }: { codTienda: string }) {
  return (
    <TableRow
      className={cn(
        SUBFILA_DETALLE_CLASS,
        "tabla-fila-detalle-competencia--cierre",
        "hover:bg-transparent"
      )}
    >
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
      <TableCell
        colSpan={3 + COLS_CATALOGO_LISTA_PRODUCTOS}
        className={cn("celda-datos", SUBFILA_CELDA_BLOQUE_CLASS)}
      >
        <p className="truncate text-center text-xs text-muted-foreground">
          Sin vínculos con proveedores para {codTienda}.
        </p>
      </TableCell>
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
      <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
    </TableRow>
  );
}

export default function CxCompraVinculosDetalle({
  itemTiendaId,
  prefijoProveedor,
  esProductoPropio = false,
  puedeEditar,
  onVinculosActualizados,
}: {
  itemTiendaId: string;
  prefijoProveedor: string | null;
  esProductoPropio?: boolean;
  puedeEditar: boolean;
  onVinculosActualizados?: () => void;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [vinculados, setVinculados] = useState<ProductoVinculoTienda[]>([]);
  const [codExtBase, setCodExtBase] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let activo = true;
    queueMicrotask(() => setCargando(true));
    getVinculos(itemTiendaId).then((result) => {
      if (!activo) return;
      if (result.success) {
        setVinculados(result.data.productos as ProductoVinculoTienda[]);
        setCodExtBase(result.data.costoCompraCodExt);
      } else {
        toast.error(result.error);
      }
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [itemTiendaId]);

  const filasOrdenadas = useMemo(
    () => ordenarFilasVinculosTienda(vinculados, prefijoProveedor ?? ""),
    [vinculados, prefijoProveedor]
  );
  const pxBase = useMemo(
    () => calcPxBaseVinculosTienda(filasOrdenadas, codExtBase),
    [filasOrdenadas, codExtBase]
  );

  function handleToggleBase(producto: ProductoVinculoTienda) {
    if (!puedeEditar) return;
    const yaEraBase = codExtBase === producto.codigoExterno;
    const nuevoValor = yaEraBase ? null : producto.codigoExterno;
    const previo = codExtBase;
    setCodExtBase(nuevoValor);
    startTransition(async () => {
      const res = await establecerCostoListaTiendaAction(itemTiendaId, nuevoValor);
      if (res.ok) {
        router.refresh();
        onVinculosActualizados?.();
      } else {
        setCodExtBase(previo);
        toast.error(res.error);
      }
    });
  }

  function handleDesvincular(producto: ProductoVinculoTienda) {
    startTransition(async () => {
      const res = await desvincularProducto(itemTiendaId, producto.id);
      if (res.ok) {
        setVinculados((prev) => prev.filter((p) => p.id !== producto.id));
        if (codExtBase === producto.codigoExterno) {
          setCodExtBase(null);
        }
        router.refresh();
        onVinculosActualizados?.();
        toast.success(`Desvinculado: ${producto.codigoExterno}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (esProductoPropio) {
    return <CxCompraDetallePropio />;
  }

  if (cargando) {
    return (
      <TableRow className={cn(SUBFILA_DETALLE_CLASS, "hover:bg-transparent")}>
        <TableCell
          colSpan={6 + COLS_CATALOGO_LISTA_PRODUCTOS}
          className={cn("celda-datos", SUBFILA_CELDA_BLOQUE_CLASS)}
        >
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            Cargando vínculos...
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (filasOrdenadas.length === 0) {
    return <CxCompraDetalleVacio codTienda={itemTiendaId} />;
  }

  return (
    <>
      {filasOrdenadas.map(({ producto, px }, idx) => (
        <SubfilaVinculo
          key={producto.id}
          producto={producto}
          px={px}
          pxBase={pxBase}
          esBase={codExtBase === producto.codigoExterno}
          esUltima={idx === filasOrdenadas.length - 1}
          puedeEditar={puedeEditar}
          isPending={isPending}
          onToggleBase={handleToggleBase}
          onDesvincular={handleDesvincular}
        />
      ))}
    </>
  );
}

/** Recarga vínculos tras vincular desde el modal de selección (expuesto para TablaTienda). */
export async function recargarVinculosItemTienda(itemTiendaId: string): Promise<{
  productos: ProductoVinculoTienda[];
  costoCompraCodExt: string | null;
} | null> {
  const result = await getVinculos(itemTiendaId);
  if (!result.success) {
    toast.error(result.error);
    return null;
  }
  return {
    productos: result.data.productos as ProductoVinculoTienda[],
    costoCompraCodExt: result.data.costoCompraCodExt,
  };
}
