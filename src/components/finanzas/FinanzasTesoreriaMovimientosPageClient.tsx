"use client";

import { useMemo, useState } from "react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
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
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TesoreriaMovimientoFila } from "@/services/tesoreriaMovimientos.service";

const FILTRO_TODOS = "none";

interface Props {
  filas: TesoreriaMovimientoFila[];
}

export default function FinanzasTesoreriaMovimientosPageClient({ filas }: Props) {
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const sucursales = useMemo(
    () =>
      [...new Set(filas.map((f) => f.sucursalNombre))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [filas]
  );
  const tipos = useMemo(
    () =>
      [...new Set(filas.map((f) => f.tipoEtiqueta))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [filas]
  );
  const categorias = useMemo(
    () =>
      [...new Set(filas.map((f) => f.categoriaEtiqueta))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [filas]
  );

  const filasFiltradas = useMemo(
    () =>
      filas.filter((fila) => {
        if (filtroSucursal && fila.sucursalNombre !== filtroSucursal) return false;
        if (filtroTipo && fila.tipoEtiqueta !== filtroTipo) return false;
        if (filtroCategoria && fila.categoriaEtiqueta !== filtroCategoria) {
          return false;
        }
        return true;
      }),
    [filas, filtroSucursal, filtroTipo, filtroCategoria]
  );

  const hayFiltros = Boolean(filtroSucursal || filtroTipo || filtroCategoria);

  return (
    <ClassicFilteredTableLayout
      title="TESORERIA"
      subtitle="Movimientos"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <FilaFiltrosDesplegables columnas={5}>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroSucursal)}
              onLimpiar={() => setFiltroSucursal("")}
            >
              <Select
                value={filtroSucursal || FILTRO_TODOS}
                onValueChange={(v) =>
                  setFiltroSucursal(v === FILTRO_TODOS ? "" : v)
                }
              >
                <SelectTrigger
                  className="input-filtro-unificado"
                  aria-label="Sucursal"
                >
                  <SelectValue placeholder="SUCURSAL" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTRO_TODOS}>TODAS</SelectItem>
                  {sucursales.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroTipo)}
              onLimpiar={() => setFiltroTipo("")}
            >
              <Select
                value={filtroTipo || FILTRO_TODOS}
                onValueChange={(v) =>
                  setFiltroTipo(v === FILTRO_TODOS ? "" : v)
                }
              >
                <SelectTrigger className="input-filtro-unificado" aria-label="Tipo">
                  <SelectValue placeholder="TIPO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTRO_TODOS}>TODOS</SelectItem>
                  {tipos.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroCategoria)}
              onLimpiar={() => setFiltroCategoria("")}
            >
              <Select
                value={filtroCategoria || FILTRO_TODOS}
                onValueChange={(v) =>
                  setFiltroCategoria(v === FILTRO_TODOS ? "" : v)
                }
              >
                <SelectTrigger
                  className="input-filtro-unificado"
                  aria-label="Categoría"
                >
                  <SelectValue placeholder="CATEGORÍA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTRO_TODOS}>TODAS</SelectItem>
                  {categorias.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FilterRowSelection className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-2")}>
              <span className={FILTER_COUNT_CLASS}>
                {filasFiltradas.length}{" "}
                {filasFiltradas.length === 1 ? "MOVIMIENTO" : "MOVIMIENTOS"}
              </span>
              {hayFiltros ? (
                <LimpiarFiltrosButton
                  onClick={() => {
                    setFiltroSucursal("");
                    setFiltroTipo("");
                    setFiltroCategoria("");
                  }}
                />
              ) : null}
            </FilterRowSelection>
          </FilaFiltrosDesplegables>
        </FilterBar>
      }
    >
      <div className="contenedor-tabla-gestion">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>FECHA</TableHead>
              <TableHead>SUCURSAL</TableHead>
              <TableHead>TIPO</TableHead>
              <TableHead>CATEGORÍA</TableHead>
              <TableHead>CAJA</TableHead>
              <TableHead className="text-right">MONTO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.length === 0 ? (
              <EmptyTableRow colSpan={6} message="No hay movimientos." />
            ) : (
              filasFiltradas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell className="celda-datos">
                    {formatIsoYmdDdMmYyyyArgentina(fila.fechaIso)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.sucursalNombre)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.tipoEtiqueta)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.categoriaEtiqueta)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.cajaEtiqueta)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "celda-datos text-right tabular-nums",
                      fila.tipoMovimiento === "EGRESO" && "text-destructive"
                    )}
                  >
                    {fila.tipoMovimiento === "EGRESO" ? "−" : ""}
                    ${fmtPrecio(fila.monto)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ClassicFilteredTableLayout>
  );
}
