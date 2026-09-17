"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { etiquetaNombreProyecto, type EnviosDireccionItem } from "@/lib/envios";
import { cn } from "@/lib/utils";

const SUBFILA_DETALLE_CLASS = "tabla-fila-detalle-competencia";
const SUBFILA_CELDA_BLOQUE_CLASS = "tabla-fila-detalle-competencia-celda";
const SUBFILA_CELDA_HUECA_CLASS = "tabla-fila-detalle-competencia-hueca";

interface Props {
  proyectos: EnviosDireccionItem[];
  onEditar: (item: EnviosDireccionItem) => void;
  onEliminar: (item: EnviosDireccionItem) => void;
  onCrear: () => void;
}

export default function FacturaClienteProyectosDetalle({
  proyectos,
  onEditar,
  onEliminar,
  onCrear,
}: Props) {
  return (
    <>
      {proyectos.map((proyecto) => {
        const nombre = etiquetaNombreProyecto(proyecto);
        return (
          <TableRow
            key={proyecto.id}
            className={cn(SUBFILA_DETALLE_CLASS, "hover:bg-transparent")}
          >
            <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
            <TableCell
              colSpan={5}
              className={cn("celda-datos max-w-0", SUBFILA_CELDA_BLOQUE_CLASS)}
            >
              <button
                type="button"
                className="block w-full truncate text-left text-xs text-foreground"
                title={nombre}
                onClick={() => onEditar(proyecto)}
              >
                {nombre}
              </button>
            </TableCell>
            <TableCell
              className={cn(
                "celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider",
                SUBFILA_CELDA_BLOQUE_CLASS
              )}
            >
              <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                  title="Eliminar"
                  aria-label={`Eliminar ${nombre}`}
                  onClick={() => onEliminar(proyecto)}
                >
                  <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
      <TableRow
        className={cn(
          SUBFILA_DETALLE_CLASS,
          "tabla-fila-detalle-competencia--cierre",
          "hover:bg-transparent"
        )}
      >
        <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
        <TableCell colSpan={5} className={cn("celda-datos", SUBFILA_CELDA_BLOQUE_CLASS)}>
          <button
            type="button"
            className="text-left text-xs font-medium text-foreground"
            onClick={onCrear}
          >
            CREAR PROYECTO
          </button>
        </TableCell>
        <TableCell
          className={cn(
            "celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider",
            SUBFILA_CELDA_BLOQUE_CLASS
          )}
        >
          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
              title="Crear Proyecto"
              aria-label="Crear proyecto"
              onClick={onCrear}
            >
              <Plus className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}
