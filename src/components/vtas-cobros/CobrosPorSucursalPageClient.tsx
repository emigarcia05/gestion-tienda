"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FilterBar, {
  FILTER_COUNT_CLASS,
  INPUT_FILTER_CLASS,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { guardarCobroPorSucursalDestinoAction } from "@/actions/cobrosPorSucursal";
import { matchByMultiTerm } from "@/lib/busqueda";
import { cn } from "@/lib/utils";
import type {
  CobrosPorSucursalCajaOption,
  CobrosPorSucursalFila,
  CobrosPorSucursalSucursalCol,
} from "@/services/cobrosPorSucursal.service";

const SIN_CAJA = "none";

const TH_CLASS = "text-center text-xs font-bold uppercase tracking-wide";

interface Props {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
  esEditor: boolean;
}

function etiquetaMedio(fila: CobrosPorSucursalFila): string {
  return `${fila.pagoNombre} · ${fila.entidadNombre}`;
}

export default function CobrosPorSucursalPageClient({
  filas: filasIniciales,
  sucursales,
  cajas,
  esEditor,
}: Props) {
  const [filas, setFilas] = useState(filasIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return filas;
    return filas.filter((f) =>
      matchByMultiTerm([f.pagoNombre, f.entidadNombre], q)
    );
  }, [filas, busqueda]);

  function cajasParaEntidad(entidadId: string): CobrosPorSucursalCajaOption[] {
    return cajas.filter((c) => c.entidadId === entidadId);
  }

  function handleCambioDestino(
    pagoId: string,
    entidadId: string,
    sucursalId: string,
    value: string
  ) {
    if (!esEditor || isPending) return;
    const cajaDestinoId = value === SIN_CAJA ? null : value;
    const key = `${pagoId}:${entidadId}:${sucursalId}`;
    setPendingKey(key);

    startTransition(async () => {
      const res = await guardarCobroPorSucursalDestinoAction({
        pagoId,
        entidadId,
        sucursalId,
        cajaDestinoId,
      });
      setPendingKey(null);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      setFilas((prev) =>
        prev.map((fila) => {
          if (fila.pagoId !== pagoId || fila.entidadId !== entidadId) return fila;
          return {
            ...fila,
            destinosPorSucursalId: {
              ...fila.destinosPorSucursalId,
              [sucursalId]: cajaDestinoId,
            },
          };
        })
      );
    });
  }

  return (
    <ClassicFilteredTableLayout
      title="VTAS. & COBROS"
      subtitle="Cobros por sucursal"
      contentWidth="full"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <div className="flex items-center gap-3">
            <div className="relative min-w-0 max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="BUSCAR FORMA DE PAGO O ENTIDAD..."
                className={cn(INPUT_FILTER_CLASS, "pl-9")}
                aria-label="Buscar forma de pago o entidad"
              />
            </div>
            <p className={FILTER_COUNT_CLASS}>
              {filasFiltradas.length} / {filas.length}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Una fila por forma de pago × entidad. Todas las cuotas de esa combinación
            se acreditan en la caja elegida por sucursal.
          </p>
        </FilterBar>
      }
    >
      <div className="contenedor-tabla-gestion flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <Table variant="compact">
            <TableHeader>
              <TableRow>
                <TableHead className={cn("min-w-[12rem]", TH_CLASS)}>FORMA DE PAGO</TableHead>
                <TableHead className={cn("min-w-[10rem]", TH_CLASS)}>ENTIDAD</TableHead>
                {sucursales.map((suc) => (
                  <TableHead key={suc.id} className={cn("min-w-[14rem]", TH_CLASS)}>
                    {suc.nombre}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2 + sucursales.length}
                    className="celda-datos text-center text-muted-foreground"
                  >
                    {filas.length === 0
                      ? "No hay combinaciones habilitadas en Cx. Fin. Cobros."
                      : "Ninguna combinación coincide con la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filasFiltradas.map((fila) => {
                  const opciones = cajasParaEntidad(fila.entidadId);
                  return (
                    <TableRow key={`${fila.pagoId}:${fila.entidadId}`}>
                      <TableCell className="celda-datos text-left text-xs font-medium">
                        {fila.pagoNombre}
                      </TableCell>
                      <TableCell className="celda-datos text-center text-xs font-medium">
                        {fila.entidadNombre}
                      </TableCell>
                      {sucursales.map((suc) => {
                        const actual = fila.destinosPorSucursalId[suc.id] ?? null;
                        const cellKey = `${fila.pagoId}:${fila.entidadId}:${suc.id}`;
                        const disabled =
                          !esEditor || (isPending && pendingKey === cellKey);
                        return (
                          <TableCell key={suc.id} className="celda-datos">
                            <Select
                              value={actual ?? SIN_CAJA}
                              disabled={disabled}
                              onValueChange={(v) =>
                                handleCambioDestino(
                                  fila.pagoId,
                                  fila.entidadId,
                                  suc.id,
                                  v
                                )
                              }
                            >
                              <SelectTrigger
                                className={cn(SELECT_TRIGGER_FILTER_CLASS, "h-9 w-full")}
                                aria-label={`Destino ${suc.nombre} para ${etiquetaMedio(fila)}`}
                              >
                                <SelectValue placeholder="SIN DESTINO" />
                              </SelectTrigger>
                              <SelectContent
                                className="select-content-filtro"
                                position="popper"
                                side="bottom"
                                align="start"
                              >
                                <SelectItem value={SIN_CAJA}>SIN DESTINO</SelectItem>
                                {opciones.map((caja) => (
                                  <SelectItem key={caja.id} value={caja.id}>
                                    {caja.etiqueta}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ClassicFilteredTableLayout>
  );
}
