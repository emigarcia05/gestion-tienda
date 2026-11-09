"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ImportarEstPorProdModal from "@/components/estadisticas-productos/ImportarEstPorProdModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import {
  etiquetaPeriodoCortoEstPorProd,
  listarPeriodosCargaEstPorProd,
} from "@/lib/estPorProdPeriodo";
import type {
  EstPorProdCeldaCarga,
  SucursalEstOption,
} from "@/lib/estPorProdTypes";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  sucursales: SucursalEstOption[];
  celdas: EstPorProdCeldaCarga[];
  esEditor: boolean;
  mesActual: number;
  anioActual: number;
}

type CeldaTarget = {
  sucursalId: string;
  mes: number;
  anio: number;
};

function celdaKey(sucursalId: string, mes: number, anio: number): string {
  return `${sucursalId}|${anio}|${mes}`;
}

export default function EstPorProdPageClient({
  sucursales,
  celdas,
  esEditor,
  mesActual,
  anioActual,
}: Props) {
  const router = useRouter();
  const [importTarget, setImportTarget] = useState<CeldaTarget | null>(null);
  const [borrandoKey, setBorrandoKey] = useState<string | null>(null);
  const [celdasLocal, setCeldasLocal] = useState(celdas);

  useEffect(() => {
    setCeldasLocal(celdas);
  }, [celdas]);

  const periodos = useMemo(
    () => listarPeriodosCargaEstPorProd({ mes: mesActual, anio: anioActual }),
    [mesActual, anioActual]
  );

  const cantidadPorCelda = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of celdasLocal) {
      map.set(celdaKey(c.sucursalId, c.mes, c.anio), c.cantidad);
    }
    return map;
  }, [celdasLocal]);

  async function handleEliminarPeriodo(target: CeldaTarget, etiqueta: string) {
    if (!esEditor) return;
    const key = celdaKey(target.sucursalId, target.mes, target.anio);
    if (
      !window.confirm(
        `¿Eliminar todo el periodo de ${etiqueta}? Se borrarán todos los productos de esa sucursal en ese mes/año. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBorrandoKey(key);
    try {
      const res = await fetch("/api/est-por-prod/eliminar-periodo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalId: target.sucursalId,
          mes: target.mes,
          anio: target.anio,
        }),
      });

      let payload: {
        ok?: boolean;
        error?: string;
        data?: { eliminados: number };
      } | null = null;
      try {
        payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: { eliminados: number };
        };
      } catch {
        payload = null;
      }

      if (!res.ok || !payload?.ok || !payload.data) {
        toast.error(payload?.error ?? "No se pudo eliminar el periodo.");
        return;
      }

      const { eliminados } = payload.data;
      setCeldasLocal((prev) =>
        prev.filter(
          (c) =>
            celdaKey(c.sucursalId, c.mes, c.anio) !== key
        )
      );
      toast.success(
        eliminados === 0
          ? "Periodo sin datos (nada que borrar)."
          : `Periodo eliminado (${eliminados.toLocaleString("es-AR")} producto(s)).`
      );
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar el periodo.", {
        description: "Revisá la conexión e intentá de nuevo.",
      });
    } finally {
      setBorrandoKey(null);
    }
  }

  const colSpan = Math.max(1, sucursales.length + 1);

  return (
    <>
      <ClassicFilteredTableLayout
        title="ESTADÍSTICAS PRODUCTOS"
        subtitle="Carga De Datos"
        contentWidth="full"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <section className="contenedor-tabla-gestion flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
            <div className="min-h-0 flex-1 overflow-auto">
              <Table className="tabla-est-carga-datos">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[14%] sticky left-0 z-30 bg-primary">
                      PERIODO
                    </TableHead>
                    {sucursales.map((s) => (
                      <TableHead key={s.id} className="min-w-[8.5rem] text-center">
                        {s.nombre}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sucursales.length === 0 ? (
                    <EmptyTableRow
                      colSpan={colSpan}
                      message="No hay sucursales."
                    />
                  ) : periodos.length === 0 ? (
                    <EmptyTableRow
                      colSpan={colSpan}
                      message="No hay periodos para mostrar."
                    />
                  ) : (
                    periodos.map((p) => {
                      const etiquetaPeriodo = etiquetaPeriodoCortoEstPorProd(
                        p.mes,
                        p.anio
                      ).toLocaleUpperCase("es-AR");
                      return (
                        <TableRow key={`${p.anio}-${p.mes}`}>
                          <TableCell className="celda-datos celda-est-carga-periodo">
                            {etiquetaPeriodo}
                          </TableCell>
                          {sucursales.map((s) => {
                            const key = celdaKey(s.id, p.mes, p.anio);
                            const cantidad = cantidadPorCelda.get(key) ?? 0;
                            const tieneDatos = cantidad > 0;
                            const target: CeldaTarget = {
                              sucursalId: s.id,
                              mes: p.mes,
                              anio: p.anio,
                            };
                            const etiquetaCelda = `${s.nombre} · ${etiquetaPeriodo}`;
                            return (
                              <TableCell
                                key={key}
                                className={cn(
                                  "celda-datos celda-datos--accion-relleno-fila",
                                  !tieneDatos && "celda-est-carga-pendiente"
                                )}
                              >
                                {esEditor ? (
                                  <div
                                    className={cn(
                                      TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS
                                    )}
                                  >
                                    {tieneDatos ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                        aria-label={`Borrar datos ${etiquetaCelda}`}
                                        title={`Borrar datos (${cantidad.toLocaleString("es-AR")})`}
                                        disabled={borrandoKey === key}
                                        onClick={() =>
                                          void handleEliminarPeriodo(
                                            target,
                                            etiquetaCelda
                                          )
                                        }
                                      >
                                        <Trash2
                                          className={TABLE_ROW_ACTION_ICON_CLASS}
                                          aria-hidden
                                        />
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                        aria-label={`Subir datos ${etiquetaCelda}`}
                                        title="Subir datos"
                                        onClick={() => setImportTarget(target)}
                                      >
                                        <FileUp
                                          className={TABLE_ROW_ACTION_ICON_CLASS}
                                          aria-hidden
                                        />
                                      </Button>
                                    )}
                                  </div>
                                ) : tieneDatos ? (
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {cantidad.toLocaleString("es-AR")}
                                  </span>
                                ) : (
                                  ""
                                )}
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
          </section>
        </div>
      </ClassicFilteredTableLayout>

      {importTarget ? (
        <ImportarEstPorProdModal
          open
          onOpenChange={(open) => {
            if (!open) setImportTarget(null);
          }}
          sucursales={sucursales}
          defaultMes={importTarget.mes}
          defaultAnio={importTarget.anio}
          lockedMes={importTarget.mes}
          lockedAnio={importTarget.anio}
          lockedSucursalId={importTarget.sucursalId}
        />
      ) : null}
    </>
  );
}
