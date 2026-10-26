"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VentasMensualesData } from "@/services/ventasMensuales.service";

const MESES: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "ENERO" },
  { valor: 2, etiqueta: "FEBRERO" },
  { valor: 3, etiqueta: "MARZO" },
  { valor: 4, etiqueta: "ABRIL" },
  { valor: 5, etiqueta: "MAYO" },
  { valor: 6, etiqueta: "JUNIO" },
  { valor: 7, etiqueta: "JULIO" },
  { valor: 8, etiqueta: "AGOSTO" },
  { valor: 9, etiqueta: "SEPTIEMBRE" },
  { valor: 10, etiqueta: "OCTUBRE" },
  { valor: 11, etiqueta: "NOVIEMBRE" },
  { valor: 12, etiqueta: "DICIEMBRE" },
];

const FILTRO_TODOS = "none";

interface Props {
  data: VentasMensualesData;
}

function fmtMonto(n: number) {
  return n < 0 ? `-$${fmtPrecio(-n)}` : `$${fmtPrecio(n)}`;
}

function etiquetaMes(mes: number): string {
  return MESES.find((m) => m.valor === mes)?.etiqueta ?? String(mes);
}

export default function VentasMensualesPageClient({ data }: Props) {
  const [filtMes, setFiltMes] = useState<string>(FILTRO_TODOS);
  const [filtAnio, setFiltAnio] = useState<string>(FILTRO_TODOS);
  const [filtSucursalId, setFiltSucursalId] = useState<string>(FILTRO_TODOS);

  const anios = useMemo(() => [...new Set(data.periodos.map((p) => p.anio))], [data.periodos]);
  const sucursales = useMemo(
    () =>
      filtSucursalId === FILTRO_TODOS
        ? data.sucursales
        : data.sucursales.filter((s) => s.id === filtSucursalId),
    [data.sucursales, filtSucursalId]
  );
  const periodos = useMemo(
    () =>
      data.periodos.filter(
        (p) =>
          (filtMes === FILTRO_TODOS || p.mes === Number(filtMes)) &&
          (filtAnio === FILTRO_TODOS || p.anio === Number(filtAnio))
      ),
    [data.periodos, filtMes, filtAnio]
  );

  const pctMes = 14;
  const pctTotal = 14;
  const pctSuc = sucursales.length > 0 ? (100 - pctMes - pctTotal) / sucursales.length : 0;

  function limpiarFiltros() {
    setFiltMes(FILTRO_TODOS);
    setFiltAnio(FILTRO_TODOS);
    setFiltSucursalId(FILTRO_TODOS);
  }

  return (
    <ClassicFilteredTableLayout
      title="FINANZAS"
      subtitle="Ventas Mensuales"
      contentWidth="full"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <FilterRowSelection className="w-full min-w-0">
            <FilaFiltrosDesplegables>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtMes !== FILTRO_TODOS}
                onLimpiar={() => setFiltMes(FILTRO_TODOS)}
              >
                <Select value={filtMes} onValueChange={setFiltMes}>
                  <SelectTrigger className="input-filtro-unificado" aria-label="Mes">
                    <SelectValue placeholder="MES" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro max-h-60"
                  >
                    <SelectItem value={FILTRO_TODOS}>MES</SelectItem>
                    {MESES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)}>
                        {m.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>

              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtAnio !== FILTRO_TODOS}
                onLimpiar={() => setFiltAnio(FILTRO_TODOS)}
              >
                <Select value={filtAnio} onValueChange={setFiltAnio}>
                  <SelectTrigger className="input-filtro-unificado" aria-label="Año">
                    <SelectValue placeholder="AÑO" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro max-h-60"
                  >
                    <SelectItem value={FILTRO_TODOS}>AÑO</SelectItem>
                    {anios.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>

              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtSucursalId !== FILTRO_TODOS}
                onLimpiar={() => setFiltSucursalId(FILTRO_TODOS)}
              >
                <Select value={filtSucursalId} onValueChange={setFiltSucursalId}>
                  <SelectTrigger className="input-filtro-unificado" aria-label="Sucursal">
                    <SelectValue placeholder="SUCURSAL" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    <SelectItem value={FILTRO_TODOS}>SUCURSAL</SelectItem>
                    {data.sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>

              <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-2 gap-2")}>
                <LimpiarFiltrosButton onClick={limpiarFiltros} />
              </div>
            </FilaFiltrosDesplegables>
          </FilterRowSelection>
        </FilterBar>
      }
    >
      <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
        <Table variant="compact" scrollX={false} className="tabla-gestion-compacta w-full table-fixed">
          <colgroup>
            <col style={{ width: `${pctMes}%` }} />
            <col style={{ width: `${pctTotal}%` }} />
            {sucursales.map((s) => (
              <col key={s.id} style={{ width: `${pctSuc}%` }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>MES</TableHead>
              <TableHead className="text-right">TOTAL</TableHead>
              {sucursales.map((s) => (
                <TableHead key={s.id} className="text-right">
                  {s.nombre}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {periodos.length === 0 ? (
              <EmptyTableRow
                colSpan={2 + sucursales.length}
                message="Ningún registro coincide con los filtros seleccionados."
              />
            ) : (
              periodos.map((p) => {
                const total = sucursales.reduce((acc, s) => acc + (p.porSucursalId[s.id] ?? 0), 0);
                return (
                  <TableRow key={`${p.anio}-${p.mes}`}>
                    <TableCell className="celda-datos font-medium">
                      {`${etiquetaMes(p.mes)} ${p.anio}`}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "celda-datos celda-numero celda-destacado tabular-nums text-right",
                        total < 0 && "text-destructive"
                      )}
                    >
                      {fmtMonto(total)}
                    </TableCell>
                    {sucursales.map((s) => {
                      const monto = p.porSucursalId[s.id] ?? 0;
                      return (
                        <TableCell
                          key={s.id}
                          className={cn(
                            "celda-datos celda-numero tabular-nums text-right",
                            monto < 0 && "text-destructive"
                          )}
                        >
                          {fmtMonto(monto)}
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
    </ClassicFilteredTableLayout>
  );
}
