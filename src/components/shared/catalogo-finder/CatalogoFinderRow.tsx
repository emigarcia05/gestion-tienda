import { ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS,
  CATALOGO_FINDER_ROW_INTERACTIVE_CLASS,
  CATALOGO_FINDER_ROW_SELECTED_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { Button } from "@/components/ui/button";

/** Layout de fila en columna GASTO FINAL (catálogo balance): 4 renglones + comentarios opcional. */
export interface CatalogoFinderGastoFinalDetalle {
  gastoNombre: string;
  sucursalNombre: string;
  proveedorNombre: string;
  gastoMensual: boolean;
  diaDevengado: number | null;
  /** Días hasta el pago (`fin_bal_gasto_final.plazo_pago_dias`). */
  vencimiento: number | null;
  /** Misma política que **GENERA IVA CRÉDITO** en el modal (`fin_bal_gasto_final.iva`). */
  ivaCredito: "SIEMPRE" | "NUNCA" | "PREGUNTA";
  comentarios: string | null;
}

export default function CatalogoFinderRow({
  nombre,
  meta,
  terceraLinea,
  gastoFinalDetalle,
  selected,
  onClick,
  mostrarAcciones,
  onVer,
  onEditar,
  onEliminar,
  nombreAccion,
  nombreSufijo,
  nombreCentrado = false,
  etiquetaIzquierda,
  iconoIzquierda,
  reservarEspacioIconoIzquierda = false,
  eliminarSiempreVisible = false,
  accionesSiempreVisibles = false,
  nombreLineas = 1,
  nombreContenido,
}: {
  nombre: string;
  meta?: string;
  /** Tercera fila bajo `meta` (tipos/rubros/gastos; no usar con `gastoFinalDetalle`). */
  terceraLinea?: string;
  /** Si está definido, sustituye `meta`/`terceraLinea` con el layout de gasto final. */
  gastoFinalDetalle?: CatalogoFinderGastoFinalDetalle;
  selected: boolean;
  onClick?: () => void;
  mostrarAcciones: boolean;
  /** Opcional: modal de solo lectura (p. ej. Marketing · Ideas). */
  onVer?: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  /** Adornment a la derecha del nombre (p. ej. ícono Maps). */
  nombreAccion?: ReactNode;
  /** Texto a la derecha del nombre (` - sufijo`), `font-normal` al 75 % del nombre. */
  nombreSufijo?: string;
  /** Centra el nombre (y el sufijo) en el espacio de la fila. */
  nombreCentrado?: boolean;
  /** Columna izquierda de etiqueta (p. ej. Envios · `DIRECCIÓN 1:`). */
  etiquetaIzquierda?: string;
  /** Ícono a la izquierda del nombre (p. ej. Envios · PINTOR). */
  iconoIzquierda?: ReactNode;
  /** Reserva el hueco de `iconoIzquierda` (size-7) aunque no haya ícono, para alinear nombres. */
  reservarEspacioIconoIzquierda?: boolean;
  /** Si true, el eliminar no va en el hover: queda fijo a la derecha de la fila. */
  eliminarSiempreVisible?: boolean;
  /** Si true, Maps / editar / borrar quedan fijos (sin hover). Envios · DIRECCIÓN. */
  accionesSiempreVisibles?: boolean;
  /** `2` permite hasta dos renglones (Envios · DIRECCIÓN). Default: una línea con ellipsis. */
  nombreLineas?: 1 | 2;
  /** Sustituye el texto de `nombre` (Envios · proyecto: 3 líneas). */
  nombreContenido?: ReactNode;
}) {
  const isClickable = typeof onClick === "function";
  const gastoFinalComentarios = gastoFinalDetalle?.comentarios?.trim() ?? "";
  const accionesFijas = eliminarSiempreVisible || accionesSiempreVisibles;
  const accionJuntoAEliminar = Boolean(accionesFijas && !nombreCentrado && nombreAccion);
  return (
    <div
      className={cn(
        "group relative flex gap-2 border-b px-3 py-2 text-sm transition-colors",
        nombreContenido ? "items-start" : "items-center",
        isClickable && CATALOGO_FINDER_ROW_INTERACTIVE_CLASS,
        !isClickable && "cursor-default",
        selected && CATALOGO_FINDER_ROW_SELECTED_CLASS
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        {gastoFinalDetalle ? (
          <>
            <div className="truncate text-center text-xs font-semibold uppercase tracking-wide text-foreground">
              {gastoFinalDetalle.gastoNombre}
            </div>
            <div className="h-px w-full bg-border" />
            <div className="min-w-0 truncate text-[11px] leading-tight">
              <span className="font-semibold uppercase tracking-wide text-foreground">
                SUCURSAL:{" "}
              </span>
              <span className="font-normal text-foreground">{gastoFinalDetalle.sucursalNombre}</span>
            </div>
            <div className="min-w-0 truncate text-[11px] leading-tight">
              <span className="font-semibold uppercase tracking-wide text-foreground">
                PROVEEDOR:{" "}
              </span>
              <span className="font-normal text-foreground">{gastoFinalDetalle.proveedorNombre}</span>
            </div>
            <div className="truncate text-[11px] leading-tight text-foreground">
              <span className="font-semibold uppercase tracking-wide text-foreground">DIA DEVENGADO: </span>
              <span className="font-normal text-foreground">{gastoFinalDetalle.diaDevengado ?? "-"}</span>
            </div>
            <div className="truncate text-[11px] leading-tight text-foreground">
              <span className="font-semibold uppercase tracking-wide text-foreground">PLAZO PAGO: </span>
              <span className="font-normal text-foreground">
                {gastoFinalDetalle.vencimiento == null ? "-" : `${gastoFinalDetalle.vencimiento} DIAS`}
              </span>
            </div>
            <div className="truncate text-[11px] leading-tight text-foreground">
              <span className="font-semibold uppercase tracking-wide text-foreground">IVA CRÉDITO: </span>
              <span className="font-normal text-foreground">{gastoFinalDetalle.ivaCredito}</span>
            </div>
            <div className="truncate text-[11px] leading-tight text-foreground">
              <span className="font-semibold uppercase tracking-wide text-foreground">TIPO: </span>
              <span className="font-normal text-foreground">
                {gastoFinalDetalle.gastoMensual ? "MENSUAL" : "EVENTUAL"}
              </span>
            </div>
            {gastoFinalComentarios ? (
              <div
                className="line-clamp-2 break-words text-[11px] font-normal leading-snug text-muted-foreground"
                title={gastoFinalComentarios}
              >
                ({gastoFinalComentarios})
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div
              className={cn(
                "relative flex min-w-0 items-center gap-1.5",
                nombreCentrado && !etiquetaIzquierda && "w-full justify-center"
              )}
            >
              {etiquetaIzquierda ? (
                <span className="w-[9rem] shrink-0 truncate font-semibold uppercase tracking-wide text-foreground">
                  {etiquetaIzquierda}
                </span>
              ) : null}
              {iconoIzquierda || reservarEspacioIconoIzquierda ? (
                <div
                  className="flex size-7 shrink-0 items-center justify-center"
                  onClick={iconoIzquierda ? (e) => e.stopPropagation() : undefined}
                  onKeyDown={iconoIzquierda ? (e) => e.stopPropagation() : undefined}
                >
                  {iconoIzquierda}
                </div>
              ) : null}
              {nombreContenido ? (
                <div className="min-w-0 flex-1">{nombreContenido}</div>
              ) : (
                <div
                  className={cn(
                    "min-w-0 font-medium",
                    nombreLineas === 2 ? "line-clamp-2 break-words leading-snug" : "truncate",
                    nombreCentrado && !etiquetaIzquierda ? "w-full text-center" : "flex-1",
                    nombreCentrado && nombreAccion && !etiquetaIzquierda ? "px-16" : null
                  )}
                  title={
                    [
                      etiquetaIzquierda,
                      nombreSufijo ? `${nombre} - ${nombreSufijo}` : nombre,
                    ]
                      .filter((s): s is string => Boolean(s))
                      .join(" ")
                  }
                >
                  {nombre}
                  {nombreSufijo ? (
                    <span className="font-normal text-[0.75em]"> - {nombreSufijo}</span>
                  ) : null}
                </div>
              )}
              {nombreAccion && !accionJuntoAEliminar ? (
                <div
                  className={cn("shrink-0", nombreCentrado && "absolute right-0 top-1/2 -translate-y-1/2")}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {nombreAccion}
                </div>
              ) : null}
            </div>
            {meta && <div className="truncate text-[11px] text-muted-foreground">{meta}</div>}
            {terceraLinea && (
              <div
                className="line-clamp-2 break-words text-[11px] text-muted-foreground"
                title={terceraLinea}
              >
                {terceraLinea}
              </div>
            )}
          </>
        )}
      </div>

      {mostrarAcciones && accionesFijas ? (
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {accionJuntoAEliminar ? <div className="shrink-0">{nombreAccion}</div> : null}
          {accionesSiempreVisibles ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
              title="Editar"
              aria-label={`Editar ${nombre}`}
              onClick={() => onEditar()}
            >
              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          ) : (
            <div className="relative flex shrink-0 items-center">
              {accionJuntoAEliminar ? (
                <div className="pointer-events-none mr-1 flex w-7 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "!h-7 !w-7 !p-1")}
                    title="Editar"
                    aria-label={`Editar ${nombre}`}
                    onClick={() => onEditar()}
                  >
                    <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                  </Button>
                </div>
              ) : (
                <div className="pointer-events-none absolute right-full mr-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  {onVer ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "!h-7 !w-7 !p-1")}
                      title="Ver"
                      aria-label={`Ver ${nombre}`}
                      onClick={() => onVer()}
                    >
                      <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "!h-7 !w-7 !p-1")}
                    title="Editar"
                    aria-label={`Editar ${nombre}`}
                    onClick={() => onEditar()}
                  >
                    <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
                title="Eliminar"
                aria-label={`Eliminar ${nombre}`}
                onClick={() => onEliminar()}
              >
                <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
              </Button>
            </div>
          )}
          {accionesSiempreVisibles ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
              title="Eliminar"
              aria-label={`Eliminar ${nombre}`}
              onClick={() => onEliminar()}
            >
              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}

      {mostrarAcciones && !accionesFijas ? (
        <div className="pointer-events-none absolute right-2 bottom-2 flex items-center justify-end gap-1 bg-card/75 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onVer ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "pointer-events-auto !h-7 !w-7 !p-1")}
              title="Ver"
              aria-label={`Ver ${nombre}`}
              onClick={(e) => {
                e.stopPropagation();
                onVer();
              }}
            >
              <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "pointer-events-auto !h-7 !w-7 !p-1")}
            title="Editar"
            aria-label={`Editar ${nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              onEditar();
            }}
          >
            <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "pointer-events-auto !h-7 !w-7 !p-1")}
            title="Eliminar"
            aria-label={`Eliminar ${nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              onEliminar();
            }}
          >
            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
        </div>
      ) : null}

      {isClickable && !accionesFijas ? (
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:opacity-0",
            selected && "text-primary"
          )}
        />
      ) : null}
    </div>
  );
}
