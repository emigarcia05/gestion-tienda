"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import {
  PEDIDO_A_FABRICA_DIAS_CALENDARIO_POR_MES,
  PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES,
  PEDIDO_A_FABRICA_MESES_PROM_VTA,
  calcularFechaLlegadaPedidoIso,
  calcularFechaStockeoPedidoIso,
  etiquetaPeriodoMesAnio,
  normalizarFechaPedidoPedidoAFabrica,
  periodosUltimosDosMesesCompletos,
} from "@/lib/pedidoAFabricaPromVta";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `YYYY-MM-DD` del filtro **FECHA DE PEDIDO** (vacío → hoy AR en fórmulas). */
  fechaPedidoIso: string;
  tiempoEntregaEnDias?: number | null;
  tiempoStockeo?: number | null;
}

function FormulaLine({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <li className="flex flex-wrap gap-x-1">
      <span className="font-semibold shrink-0">{left}</span>
      <span className="font-normal text-foreground">= {right}</span>
    </li>
  );
}

/**
 * Modal **Info Formulas** (Pedido A Fáb.): PROM. VTA., fechas y cant. sugerida.
 */
export default function InfoPromedioPedidoAFabricaModal({
  open,
  onOpenChange,
  fechaPedidoIso,
  tiempoEntregaEnDias = null,
  tiempoStockeo = null,
}: Props) {
  const { anterior, reciente, actual } = periodosUltimosDosMesesCompletos();
  const fechaPedido = normalizarFechaPedidoPedidoAFabrica(fechaPedidoIso);
  const fechaLlegada = calcularFechaLlegadaPedidoIso(
    fechaPedido,
    tiempoEntregaEnDias
  );
  const fechaStockeo = calcularFechaStockeoPedidoIso(
    fechaPedido,
    tiempoEntregaEnDias,
    tiempoStockeo
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title="INFO FORMULAS"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-foreground">
          <section className="flex flex-col gap-2" aria-labelledby="info-formulas-prom-vta">
            <h3 id="info-formulas-prom-vta" className="font-semibold tracking-wide">
              PROM. VTA.
            </h3>
            <ul className="list-none space-y-1 pl-0">
              <FormulaLine
                left="Días en Mes"
                right={PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES}
              />
              <FormulaLine
                left="Prom. Vta P/ Día"
                right={
                  <>
                    (Cantidad Vendida últimos {PEDIDO_A_FABRICA_MESES_PROM_VTA}{" "}
                    meses) / (Días en Mes × {PEDIDO_A_FABRICA_MESES_PROM_VTA}),
                    redondeado a 1 decimal
                  </>
                }
              />
            </ul>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              <span className="font-semibold">Hoy (AR)</span>
              {" = "}
              {etiquetaPeriodoMesAnio(actual)}. Ventas de{" "}
              {etiquetaPeriodoMesAnio(anterior)} y{" "}
              {etiquetaPeriodoMesAnio(reciente)}.
            </p>
          </section>

          <hr className="border-border" />

          <section className="flex flex-col gap-2" aria-labelledby="info-formulas-fechas">
            <h3 id="info-formulas-fechas" className="font-semibold tracking-wide">
              FECHAS
            </h3>
            <ul className="list-none space-y-1 pl-0">
              <FormulaLine
                left="Fecha Pedido"
                right={
                  <>
                    filtro FECHA DE PEDIDO (
                    {formatIsoYmdDdMmYyyyArgentina(fechaPedido)}
                    {fechaPedidoIso.trim() === "" ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(fechaPedidoIso.trim())
                      ? "; vacío → hoy AR"
                      : ""}
                    )
                  </>
                }
              />
              <FormulaLine
                left="Fecha Llegada Pedido"
                right={
                  <>
                    Fecha Pedido + tiempo_entrega_en_dias (
                    {formatIsoYmdDdMmYyyyArgentina(fechaLlegada)})
                  </>
                }
              />
              <FormulaLine
                left="Días Provisión Hasta Llegada"
                right="días entre hoy (AR) y Fecha Llegada Pedido (mínimo 0)"
              />
              <FormulaLine
                left="Fecha Stockeo"
                right={
                  fechaStockeo != null ? (
                    <>
                      Fecha Llegada Pedido + Tiempo Stockeo en días calendario (
                      {formatIsoYmdDdMmYyyyArgentina(fechaStockeo)})
                    </>
                  ) : (
                    "Fecha Llegada Pedido + Tiempo Stockeo (días calendario)"
                  )
                }
              />
            </ul>
          </section>

          <hr className="border-border" />

          <section
            className="flex flex-col gap-2"
            aria-labelledby="info-formulas-stock"
          >
            <h3 id="info-formulas-stock" className="font-semibold tracking-wide">
              STOCK Y CANT. SUGERIDA
            </h3>
            <ul className="list-none space-y-1 pl-0">
              <FormulaLine
                left="Stock Actual En Días"
                right="Stock Actual En Unidades / Prom. Vta. P/ Día (redondeo; vacío si prom = 0)"
              />
              <FormulaLine
                left="Stock Hasta Llegada De Pedido"
                right="Stock Actual − (Días Provisión Hasta Llegada × Prom. Vta.)"
              />
              <FormulaLine
                left="Stock Quebrado"
                right="UN. ACT. ≤ 0 o Stock Hasta Llegada De Pedido ≤ 0 (filtro STOCK QUEBRADO)"
              />
              <FormulaLine
                left="Prod. Vinculado"
                right="Hay vínculo lista proveedor ↔ prod_propios por cod_tienda (filtro SI/NO)"
              />
              <FormulaLine
                left="Pedido"
                right="CANT. PED. > 0 (filtro PEDIDO SI/NO)"
              />
              <FormulaLine
                left="Tiempo Stockeo"
                right={
                  <>
                    días calendario (filtro TIEMPO STOCKEO).{" "}
                    {PEDIDO_A_FABRICA_DIAS_CALENDARIO_POR_MES} calendario ={" "}
                    {PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES} hábiles de venta
                  </>
                }
              />
              <FormulaLine
                left="Stock Para Tiempo Stockeo"
                right={
                  <>
                    (Tiempo Stockeo × {PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES} /{" "}
                    {PEDIDO_A_FABRICA_DIAS_CALENDARIO_POR_MES}) × Prom. Vta.
                    total
                  </>
                }
              />
            </ul>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">Cant. Sugerida:</p>
              <ul className="list-none space-y-1 pl-4">
                <li>
                  <span className="font-semibold">
                    Si Stock a Fecha Llegada ≤ 0
                  </span>
                  {" → "}
                  Stock Para Tiempo Stockeo
                </li>
                <li>
                  <span className="font-semibold">
                    Si Stock a Fecha Llegada &gt; 0
                  </span>
                  {" → "}
                  Stock Para Tiempo Stockeo − Stock a Fecha Llegada (piso 0)
                </li>
                <li>
                  <span className="font-semibold">UNIDAD</span>
                  {" → "}
                  techo al entero siguiente (6,7 → 7)
                </li>
                <li>
                  <span className="font-semibold">BULTO</span>
                  {" → "}
                  techo al próximo múltiplo del bulto (6,7 y bulto 12 → 12). Sin
                  bulto: vacío
                </li>
              </ul>
            </div>
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
