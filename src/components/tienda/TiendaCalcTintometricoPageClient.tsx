"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import EditarCoeficientesModal from "@/components/stock/EditarCoeficientesModal";
import MontoArInput from "@/components/shared/MontoArInput";
import { montoArNormalizedStringToPesosNumber, montoArPesosEnterosToDisplay } from "@/lib/montoArMask";
import { calcularPxTintometrico } from "@/lib/codColorTintometrico";

type ProveedorOption = {
  id: string;
  nombre: string;
  prefijo: string;
  codigoUnico: string;
  coeficienteTintometrico: number;
};

interface Props {
  proveedores: ProveedorOption[];
  esEditor: boolean;
}

export default function TiendaCalcTintometricoPageClient({
  proveedores,
  esEditor,
}: Props) {
  const router = useRouter();
  /** `id` del proveedor seleccionado. */
  const [proveedorId, setProveedorId] = useState<string>("");
  const [pxCompraNorm, setPxCompraNorm] = useState("");
  const [editarCoefOpen, setEditarCoefOpen] = useState(false);

  const proveedoresConCoefMayorAUno = useMemo(
    () => proveedores.filter((p) => p.coeficienteTintometrico > 1),
    [proveedores]
  );

  /**
   * Lista general: px. compra × coef. (si hay proveedor), redondeo a centenas.
   * Lista mayorista: 30 % menos que la general (70 % del valor general en pesos enteros).
   */
  const { pxListaGeneral, pxListaMayorista } = useMemo(() => {
    const coef = proveedorId
      ? (proveedoresConCoefMayorAUno.find((p) => p.id === proveedorId)?.coeficienteTintometrico ?? null)
      : null;
    const { general, mayorista } = calcularPxTintometrico(
      montoArNormalizedStringToPesosNumber(pxCompraNorm),
      coef
    );
    return {
      pxListaGeneral: montoArPesosEnterosToDisplay(general),
      pxListaMayorista: montoArPesosEnterosToDisplay(mayorista),
    };
  }, [pxCompraNorm, proveedorId, proveedoresConCoefMayorAUno]);

  return (
    <div className="area-page-shell">
      <EditarCoeficientesModal
        open={editarCoefOpen}
        onOpenChange={setEditarCoefOpen}
        proveedores={proveedores}
        onSaved={() => router.refresh()}
      />
      <ClassicFilteredTableLayout
        title="Precios"
        subtitle="Px Tintométricos"
        contentWidth="full"
        actions={
          esEditor ? (
            <Button type="button" onClick={() => setEditarCoefOpen(true)}>
              Editar Coeficientes
            </Button>
          ) : undefined
        }
      >
        <section className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card p-4">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-center text-sm font-semibold uppercase text-foreground">
                CÁLCULO DE PX TINTOMÉTRICO
              </h2>
              <span className="h-0.5 w-[70%] rounded-full bg-primary" aria-hidden />
            </div>

            <div className="mx-auto grid w-full max-w-xl grid-cols-[11rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              <span className="text-xs font-semibold uppercase text-foreground">
                Proveedor
              </span>
              <div className="min-w-0">
                <Select
                  value={proveedorId ?? ""}
                  onValueChange={(value) => setProveedorId(value)}
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "h-10")}>
                    <SelectValue placeholder="SELECCIONAR" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    {proveedoresConCoefMayorAUno.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.prefijo ? `[${item.prefijo}] ` : `[${item.codigoUnico}] `}
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-xs font-semibold uppercase text-foreground">
                Px. Compra
              </span>
              <MontoArInput
                valueNormalized={pxCompraNorm}
                onValueNormalizedChange={setPxCompraNorm}
                className="h-10"
                aria-label="Px. Compra"
              />

              <span className="text-xs font-semibold uppercase text-foreground">
                Tienda - Px Lista General
              </span>
              <div className="flex h-10 items-center justify-center rounded-md border border-border bg-background px-3 text-sm tabular-nums text-foreground">
                {pxListaGeneral}
              </div>

              <span className="text-xs font-semibold uppercase text-foreground">
                Tienda - Px Lista Mayorista
              </span>
              <div className="flex h-10 items-center justify-center rounded-md border border-border bg-background px-3 text-sm tabular-nums text-foreground">
                {pxListaMayorista}
              </div>
            </div>
          </div>
        </section>
      </ClassicFilteredTableLayout>
    </div>
  );
}
