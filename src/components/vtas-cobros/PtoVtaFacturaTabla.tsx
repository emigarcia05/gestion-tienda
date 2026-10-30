"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { guardarPtoVtaFacturaAction } from "@/actions/ptoVtaFactura";
import { ETIQUETA_GRUPO_FACTURA_PTO_VTA } from "@/lib/ptoVtaFactura";
import { cn } from "@/lib/utils";
import type {
  PtoVtaFacturaFila,
  PtoVtaFacturaOpcion,
} from "@/services/ptoVtaFactura.service";

const SIN_CONFIGURAR_VALUE = "__sin_configurar__";
const ETIQUETA_SIN_CONFIGURAR = "SIN CONFIGURAR";
const SELECT_TRIGGER_CELDA_CLASS = "input-filtro-unificado h-8 w-full text-xs font-semibold";

function etiquetaOpcion(opcion: PtoVtaFacturaOpcion): string {
  return `${opcion.ptoVenta} - ${opcion.titular}`;
}

function claveFila(fila: Pick<PtoVtaFacturaFila, "sucursalId" | "grupo">): string {
  return `${fila.sucursalId}|${fila.grupo}`;
}

function CeldaPtoVta({
  fila,
  esEditor,
  onGuardado,
}: {
  fila: PtoVtaFacturaFila;
  esEditor: boolean;
  onGuardado: (ptoVtaId: string | null) => void;
}) {
  const [saving, startTransition] = useTransition();
  const etiquetaFila = `${fila.sucursalNombre} ${ETIQUETA_GRUPO_FACTURA_PTO_VTA[fila.grupo]}`;
  const actual = fila.opciones.find((o) => o.id === fila.ptoVtaId) ?? null;

  if (!esEditor) {
    return (
      <span className={cn(!actual && "text-muted-foreground")}>
        {actual ? etiquetaOpcion(actual) : ETIQUETA_SIN_CONFIGURAR}
      </span>
    );
  }

  function handleChange(value: string) {
    const ptoVtaId = value === SIN_CONFIGURAR_VALUE ? null : value;
    if (ptoVtaId === fila.ptoVtaId) return;
    startTransition(async () => {
      const res = await guardarPtoVtaFacturaAction({
        sucursalId: fila.sucursalId,
        grupo: fila.grupo,
        ptoVtaId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onGuardado(res.data.ptoVtaId);
      toast.success(`Pto. vta. de ${etiquetaFila} guardado.`);
    });
  }

  return (
    <Select
      value={fila.ptoVtaId ?? SIN_CONFIGURAR_VALUE}
      onValueChange={handleChange}
      disabled={saving}
    >
      <SelectTrigger className={SELECT_TRIGGER_CELDA_CLASS} aria-label={`Pto. vta. ${etiquetaFila}`}>
        <SelectValue placeholder="PTO. VTA." />
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align="start"
        className="select-content-filtro max-h-60"
      >
        <SelectItem value={SIN_CONFIGURAR_VALUE}>{ETIQUETA_SIN_CONFIGURAR}</SelectItem>
        {fila.opciones.map((opcion) => (
          <SelectItem key={opcion.id} value={opcion.id}>
            {etiquetaOpcion(opcion)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Props {
  filasIniciales: PtoVtaFacturaFila[];
  esEditor: boolean;
}

/** Pto. vta. por sucursal × grupo de factura (A = cliente RI; B/C = resto). */
export default function PtoVtaFacturaTabla({ filasIniciales, esEditor }: Props) {
  const [filas, setFilas] = useState(filasIniciales);

  function actualizarFila(clave: string, ptoVtaId: string | null) {
    setFilas((prev) => prev.map((f) => (claveFila(f) === clave ? { ...f, ptoVtaId } : f)));
  }

  return (
    <Table variant="compact" className="tabla-gestion-compacta w-full">
      <colgroup>
        <col className="w-[30%]" />
        <col className="w-[18%]" />
        <col />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>SUCURSAL</TableHead>
          <TableHead className="text-center">FACT.</TableHead>
          <TableHead>PTO. VTA.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <EmptyTableRow colSpan={3} message="No hay sucursales con puntos de venta asociados." />
        ) : (
          filas.map((fila, i) => {
            const primeraDeSucursal = i === 0 || filas[i - 1]?.sucursalId !== fila.sucursalId;
            const filasSucursal = filas.filter((f) => f.sucursalId === fila.sucursalId).length;
            const ultimaSucursalId = filas[filas.length - 1]?.sucursalId;
            const separaSucursal = fila.sucursalId !== ultimaSucursalId;
            const ultimaDeSucursal =
              separaSucursal && filas[i + 1]?.sucursalId !== fila.sucursalId;
            const clave = claveFila(fila);
            return (
              <TableRow key={clave}>
                {primeraDeSucursal ? (
                  <TableCell
                    rowSpan={filasSucursal}
                    className={cn(
                      "celda-datos text-left align-middle font-medium",
                      separaSucursal && "tabla-grupo-fin"
                    )}
                  >
                    {fila.sucursalNombre}
                  </TableCell>
                ) : null}
                <TableCell
                  className={cn(
                    "celda-datos text-center font-semibold",
                    ultimaDeSucursal && "tabla-grupo-fin"
                  )}
                >
                  {ETIQUETA_GRUPO_FACTURA_PTO_VTA[fila.grupo]}
                </TableCell>
                <TableCell
                  className={cn("celda-datos text-left", ultimaDeSucursal && "tabla-grupo-fin")}
                >
                  <CeldaPtoVta
                    fila={fila}
                    esEditor={esEditor}
                    onGuardado={(ptoVtaId) => actualizarFila(clave, ptoVtaId)}
                  />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
