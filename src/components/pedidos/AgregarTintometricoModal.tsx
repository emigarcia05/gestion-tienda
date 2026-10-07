"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  EmptyTableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getCatalogoAgregarTintometricoAction } from "@/actions/tintometrico";
import { upsertPedidoTintometricoItemsAction } from "@/actions/pedidos";
import { codigoCumpleFormatoCod, describirFormatoCod } from "@/lib/tintometricoFormatoCod";
import type {
  BaseTintometricaCatalogo,
  MarcaTintometricaCatalogo,
  ProveedorTintometrico,
} from "@/services/tintometrico.service";

type Catalogo = {
  proveedores: ProveedorTintometrico[];
  marcas: MarcaTintometricaCatalogo[];
  bases: BaseTintometricaCatalogo[];
};

const CAMPO_CLASS = "flex min-w-0 flex-col gap-1";

function descripcionConCodigo(base: string, codigo: string): string {
  return (codigo ? `${base} - COD. ${codigo}` : base).toUpperCase();
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursal: "" | "guaymallen" | "maipu";
  /** Proveedor del filtro de la página; se preselecciona si es tintométrico. */
  proveedorInicial: string;
  onAgregado: () => void;
}

export default function AgregarTintometricoModal({
  open,
  onOpenChange,
  sucursal,
  proveedorInicial,
  onAgregado,
}: Props) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [idMarca, setIdMarca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantPorCod, setCantPorCod] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setIdMarca("");
      setCodigo("");
      setCantPorCod({});
    });
    if (catalogo) {
      queueMicrotask(() =>
        setProveedorId(catalogo.proveedores.some((p) => p.id === proveedorInicial) ? proveedorInicial : "")
      );
      return;
    }
    let cancelado = false;
    queueMicrotask(() => setCargando(true));
    void getCatalogoAgregarTintometricoAction().then((res) => {
      if (cancelado) return;
      setCargando(false);
      if (!res.ok) {
        toast.error(res.error ?? "Error al cargar el catálogo tintométrico.");
        return;
      }
      setCatalogo(res.data);
      setProveedorId(res.data.proveedores.some((p) => p.id === proveedorInicial) ? proveedorInicial : "");
    });
    return () => {
      cancelado = true;
    };
  }, [open, catalogo, proveedorInicial]);

  const marca = useMemo(
    () => catalogo?.marcas.find((m) => m.idMarca === idMarca) ?? null,
    [catalogo, idMarca]
  );
  const basesMarca = useMemo(
    () => (catalogo && idMarca ? catalogo.bases.filter((b) => b.idMarca === idMarca) : []),
    [catalogo, idMarca]
  );

  const codigoTrim = codigo.trim();
  const formatoCod = marca?.formatoCod ?? null;
  const codigoValido =
    codigoTrim.length > 0 && (formatoCod === null || codigoCumpleFormatoCod(codigoTrim, formatoCod));
  const mostrarErrorCodigo = codigoTrim.length > 0 && !codigoValido;

  const cantidades = basesMarca
    .map((b) => ({ base: b, cant: Number.parseInt(cantPorCod[b.codTienda] ?? "", 10) }))
    .filter((x) => Number.isFinite(x.cant) && x.cant > 0);

  const puedeAgregar =
    !!sucursal && !!proveedorId && !!marca && codigoValido && cantidades.length > 0 && !guardando;

  async function handleAgregar() {
    if (!puedeAgregar || !sucursal) return;
    setGuardando(true);
    try {
      const res = await upsertPedidoTintometricoItemsAction(
        cantidades.map(({ base, cant }) => ({
          sucursalCodigo: sucursal,
          proveedorId,
          codTienda: base.codTienda,
          codTintometrico: codigoTrim,
          cantidad: cant,
          descripcion: descripcionConCodigo(base.descripcionTienda, codigoTrim),
        }))
      );
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar el tintométrico.");
        return;
      }
      toast.success(
        res.data.actualizados === 1
          ? "Se agregó 1 ítem tintométrico."
          : `Se agregaron ${res.data.actualizados} ítems tintométricos.`
      );
      onOpenChange(false);
      onAgregado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Agregar Tintométrico"
        size="lg"
        scrollBody={false}
        className="h-[85vh]"
        bodyClassName="flex min-h-0 flex-1 flex-col gap-4"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAgregar} disabled={!puedeAgregar}>
              {guardando ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        }
      >
        <div className={CAMPO_CLASS}>
          <ModalMicroLabel>PROVEEDOR</ModalMicroLabel>
          <Select value={proveedorId} onValueChange={setProveedorId} disabled={cargando || !catalogo}>
            <SelectTrigger className="h-10 w-full" aria-label="Proveedor">
              <SelectValue placeholder={cargando ? "Cargando..." : "PROVEEDOR"} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start">
              {(catalogo?.proveedores ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.prefijo ? `${p.prefijo} - ${p.nombre}` : p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr] items-start gap-3">
          <div className={CAMPO_CLASS}>
            <ModalMicroLabel>COD. COLOR (MARCA)</ModalMicroLabel>
            <Select
              value={idMarca}
              onValueChange={(v) => {
                setIdMarca(v);
                setCantPorCod({});
              }}
              disabled={!catalogo}
            >
              <SelectTrigger className="h-10 w-full" aria-label="Marca">
                <SelectValue placeholder="MARCA" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                {(catalogo?.marcas ?? []).map((m) => (
                  <SelectItem key={m.idMarca} value={m.idMarca}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={CAMPO_CLASS}>
            <ModalMicroLabel>FORMATO DEL CÓDIGO</ModalMicroLabel>
            <div
              className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/30 px-2 text-sm tabular-nums text-foreground"
              title={formatoCod ? describirFormatoCod(formatoCod) : undefined}
            >
              <span className="truncate">
                {!marca ? "—" : (formatoCod ?? "Sin formato (libre)")}
              </span>
            </div>
          </div>
          <div className={CAMPO_CLASS}>
            <ModalMicroLabel>COD. COLOR</ModalMicroLabel>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              disabled={!marca}
              placeholder={formatoCod ?? "CÓDIGO"}
              aria-invalid={mostrarErrorCodigo || undefined}
              className={cn("h-10 text-center tabular-nums", mostrarErrorCodigo && "border-destructive")}
              aria-label="Código de color"
            />
            {mostrarErrorCodigo ? (
              <span className="text-xs text-destructive">No cumple el formato de la marca.</span>
            ) : null}
          </div>
        </div>

        <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
          <Table variant="compact" scrollX={false} className="tabla-gestion-compacta w-full table-fixed">
            <colgroup>
              <col style={{ width: "82%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-0">DESCRIPCIÓN</TableHead>
                <TableHead className="text-center">CANT. A PEDIR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {basesMarca.length === 0 ? (
                <EmptyTableRow
                  colSpan={2}
                  message={marca ? "La marca no tiene ítems tintométricos." : "Elegí una marca para ver los ítems."}
                />
              ) : (
                basesMarca.map((b) => (
                  <TableRow key={b.codTienda}>
                    <TableCell className="celda-datos min-w-0 truncate" title={b.descripcionTienda}>
                      {descripcionConCodigo(b.descripcionTienda, codigoValido ? codigoTrim : "")}
                    </TableCell>
                    <TableCell className="celda-datos text-center">
                      <Input
                        inputMode="numeric"
                        value={cantPorCod[b.codTienda] ?? ""}
                        placeholder="0"
                        onChange={(e) =>
                          setCantPorCod((prev) => ({
                            ...prev,
                            [b.codTienda]: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="mx-auto h-7 w-16 px-1 text-center tabular-nums"
                        aria-label={`Cantidad ${b.descripcionTienda}`}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AppModal>
    </Dialog>
  );
}
