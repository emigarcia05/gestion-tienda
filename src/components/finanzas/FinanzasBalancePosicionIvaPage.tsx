import PosicionIvaBalanceClient from "@/components/finanzas/PosicionIvaBalanceClient";
import type { EstadoIvaComparacionPedido } from "@/actions/finBalPosicionIvaComparacionPedido";

interface Props {
  anio: number;
  esEditor: boolean;
  ivaDebitoPorMes: number[];
  ivaCreditoPorMes: number[];
  comparacionPedidos: EstadoIvaComparacionPedido;
}

export default function FinanzasBalancePosicionIvaPage({
  anio,
  esEditor,
  ivaDebitoPorMes,
  ivaCreditoPorMes,
  comparacionPedidos,
}: Props) {
  return (
    <PosicionIvaBalanceClient
      anio={anio}
      esEditor={esEditor}
      ivaDebitoPorMes={ivaDebitoPorMes}
      ivaCreditoPorMes={ivaCreditoPorMes}
      comparacionPedidos={comparacionPedidos}
    />
  );
}
