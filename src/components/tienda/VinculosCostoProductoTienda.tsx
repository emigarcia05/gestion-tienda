"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import SeleccionarProductoModal, {
  type ProductoConProveedor,
} from "@/components/tienda/SeleccionarProductoModal";
import { setProductoPropioTiendaAction } from "@/actions/tienda";
import {
  desvincularProducto,
  establecerCostoListaTiendaAction,
  getVinculos,
  vincularProducto,
} from "@/actions/vinculos";
import {
  calcPxBaseVinculosTienda,
  labelVariacionVsBase,
  ordenarFilasVinculosTienda,
  type ProductoVinculoTienda,
} from "@/lib/vinculosTiendaUi";
import { fmtPrecio } from "@/lib/format";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-8 w-8 min-h-8 max-h-8");

function TextoVariacion({ px, pxBase, esBase }: { px: number; pxBase: number | null; esBase: boolean }) {
  if (esBase) return <span className="variacion-costo--neutra text-xs">0%</span>;
  const v = labelVariacionVsBase(px, pxBase);
  const clase =
    v.kind === "up"
      ? "variacion-costo--positiva"
      : v.kind === "down"
        ? "variacion-costo--negativa"
        : "variacion-costo--neutra";
  return (
    <span className={cn(clase, "text-xs")} title={v.title}>
      {v.text}
    </span>
  );
}

/**
 * Editar producto · VINCULACIÓN CON COSTO: producto propio, vínculos con líneas de proveedor y cuál
 * define el CX COMPRA. Cada cambio se guarda al instante (mismas actions que usaba Cx Compra).
 */
export default function VinculosCostoProductoTienda({
  codTienda,
  descripcion,
  marca,
  rubro,
  subRubro,
  prefijoProveedor,
  esProductoPropioInicial,
  puedeVincular,
  puedeEditarCosto,
}: {
  codTienda: string;
  descripcion: string;
  marca: string | null;
  rubro: string | null;
  subRubro: string | null;
  prefijoProveedor: string | null;
  esProductoPropioInicial: boolean;
  puedeVincular: boolean;
  puedeEditarCosto: boolean;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [vinculados, setVinculados] = useState<ProductoVinculoTienda[]>([]);
  const [codExtBase, setCodExtBase] = useState<string | null>(null);
  const [esPropio, setEsPropio] = useState(esProductoPropioInicial);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let activo = true;
    void getVinculos(codTienda).then((result) => {
      if (!activo) return;
      if (result.success) {
        setVinculados(result.data.productos as ProductoVinculoTienda[]);
        setCodExtBase(result.data.costoCompraCodExt);
        setEsPropio(result.data.esProductoPropio);
      } else {
        toast.error(result.error);
      }
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [codTienda, recarga]);

  const filas = useMemo(
    () => ordenarFilasVinculosTienda(vinculados, prefijoProveedor ?? ""),
    [vinculados, prefijoProveedor]
  );
  const pxBase = calcPxBaseVinculosTienda(filas, codExtBase);
  const pxConValor = filas.map((f) => f.px).filter((px) => px > 0);
  const costoPromedio = pxConValor.length
    ? pxConValor.reduce((acc, px) => acc + px, 0) / pxConValor.length
    : null;
  const filaBase = filas.find((f) => f.producto.codigoExterno === codExtBase) ?? null;
  const costoCompra = filaBase ? filaBase.px : costoPromedio;

  function terminar(mensaje: string) {
    toast.success(mensaje);
    setRecarga((n) => n + 1);
    router.refresh();
  }

  function cambiarPropio(siguiente: boolean) {
    startTransition(async () => {
      const res = await setProductoPropioTiendaAction({ codTienda, esProductoPropio: siguiente });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEsPropio(res.data.esProductoPropio);
      terminar(res.data.esProductoPropio ? "Marcado como producto propio." : "Ya no es producto propio.");
    });
  }

  function vincular(producto: ProductoConProveedor) {
    startTransition(async () => {
      const res = await vincularProducto(codTienda, producto.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSelectorAbierto(false);
      terminar(`Vinculado: ${producto.codigoExterno}`);
    });
  }

  function desvincular(producto: ProductoVinculoTienda) {
    startTransition(async () => {
      const res = await desvincularProducto(codTienda, producto.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      terminar(`Desvinculado: ${producto.codigoExterno}`);
    });
  }

  function cambiarBase(producto: ProductoVinculoTienda) {
    const nuevo = codExtBase === producto.codigoExterno ? null : producto.codigoExterno;
    startTransition(async () => {
      const res = await establecerCostoListaTiendaAction(codTienda, nuevo);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCodExtBase(nuevo);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ModalSiNoChoice
        label="PROD. PROPIO"
        value={esPropio}
        onChange={cambiarPropio}
        disabled={!puedeVincular || isPending || cargando}
      />
      {esPropio ? (
        <p className="text-center text-sm text-muted-foreground">
          Producto propio TiendaColor: sin vínculos con proveedores.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium uppercase text-foreground">
              CX COMPRA:{" "}
              <span className="tabular-nums">{costoCompra != null ? `$${fmtPrecio(costoCompra)}` : "—"}</span>{" "}
              <span className="text-xs text-muted-foreground">
                {filaBase ? `(${filaBase.producto.proveedor.prefijo})` : costoPromedio != null ? "(CX. PROM.)" : ""}
              </span>
            </p>
            {puedeVincular ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={isPending || cargando}
                onClick={() => setSelectorAbierto(true)}
              >
                <Link2 aria-hidden />
                Vincular Proveedor
              </Button>
            ) : null}
          </div>
          <Table variant="compact" scrollX={false} className="table-fixed w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-center">PROV.</TableHead>
                <TableHead>DESCRIPCIÓN</TableHead>
                <TableHead className="w-28 text-center">COSTO</TableHead>
                <TableHead className="w-20 text-center">VAR.</TableHead>
                <TableHead className="w-16 text-center">CX</TableHead>
                <TableHead className="w-14 text-center" aria-label="Desvincular" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Cargando vínculos...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filas.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <TableEmptyState message="SIN VÍNCULOS CON PROVEEDORES." placement="panel" />
                  </TableCell>
                </TableRow>
              ) : (
                filas.map(({ producto, px }) => {
                  const esBase = codExtBase === producto.codigoExterno;
                  return (
                    <TableRow key={producto.id}>
                      <TableCell className="celda-datos celda-mono text-center text-xs font-medium">
                        {producto.proveedor.prefijo}
                      </TableCell>
                      <TableCell className="celda-datos min-w-0">
                        <span className="block truncate text-xs" title={producto.descripcion}>
                          {producto.descripcion}
                        </span>
                      </TableCell>
                      <TableCell className="celda-datos celda-numero tabular-nums text-center">
                        ${fmtPrecio(px)}
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        <TextoVariacion px={px} pxBase={pxBase} esBase={esBase} />
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        <input
                          type="checkbox"
                          checked={esBase}
                          onChange={() => cambiarBase(producto)}
                          disabled={!puedeEditarCosto || isPending}
                          className="cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={
                            esBase
                              ? `Quitar ${producto.proveedor.prefijo} como CX COMPRA (vuelve a CX. PROM.)`
                              : `Usar ${producto.proveedor.prefijo} como CX COMPRA`
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {puedeVincular ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ROW_ICON_BTN_CLASS}
                            aria-label={`Desvincular ${producto.proveedor.prefijo}`}
                            disabled={isPending}
                            onClick={() => desvincular(producto)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </>
      )}
      <SeleccionarProductoModal
        open={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
        onSeleccionar={vincular}
        excluirItemTiendaId={codTienda}
        idsProveedoresYaVinculados={vinculados.map((p) => p.proveedorId)}
        itemDescripcion={descripcion}
        marca={marca}
        rubro={rubro}
        subRubro={subRubro}
      />
    </div>
  );
}
