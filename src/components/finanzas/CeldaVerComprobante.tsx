"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";

interface Props {
  /** `undefined`: el movimiento no tiene comprobante para mostrar (botón deshabilitado). */
  onVer?: () => void;
  /** Tooltip / aria del botón habilitado. */
  titulo?: string;
  /** Tooltip del botón deshabilitado. */
  tituloDeshabilitado?: string;
}

/** Celda **ACCIONES** con el botón **VER** del comprobante que generó el movimiento (Balance). */
export default function CeldaVerComprobante({
  onVer,
  titulo = "Ver Comprobante",
  tituloDeshabilitado = "Sin comprobante",
}: Props) {
  return (
    <TableCell className="celda-datos p-0">
      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
          aria-label={titulo}
          title={onVer ? titulo : tituloDeshabilitado}
          disabled={!onVer}
          onClick={onVer}
        >
          <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
        </Button>
      </div>
    </TableCell>
  );
}
