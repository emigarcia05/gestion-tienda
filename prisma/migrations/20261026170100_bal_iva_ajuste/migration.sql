-- Balance IVA: el AJUSTE no tiene origen (las 4 FK en NULL); el resto sigue con exactamente una FK.
ALTER TABLE "bal_iva" DROP CONSTRAINT IF EXISTS "bal_iva_origen_chk";

ALTER TABLE "bal_iva"
  ADD CONSTRAINT "bal_iva_origen_chk" CHECK (
    ("origen" = 'AJUSTE'
      AND num_nonnulls("comprobante_vta_id", "comprobante_compra_id", "gasto_mensual_id", "tesoreria_movimiento_id") = 0)
    OR (
      num_nonnulls("comprobante_vta_id", "comprobante_compra_id", "gasto_mensual_id", "tesoreria_movimiento_id") = 1
      AND (
        ("origen" = 'VENTA' AND "comprobante_vta_id" IS NOT NULL)
        OR ("origen" = 'COMPRA_MERCADERIA' AND "comprobante_compra_id" IS NOT NULL)
        OR ("origen" = 'GASTO' AND "gasto_mensual_id" IS NOT NULL)
        OR ("origen" = 'CX_FINANCIERO' AND "tesoreria_movimiento_id" IS NOT NULL)
      )
    )
  );

-- El saldo manual para comparar costos en Pedir Mercadería se reemplaza por los AJUSTE del libro:
-- Pedir Mercadería usa siempre el saldo acumulado de bal_iva.
DROP TABLE IF EXISTS "fin_bal_posicion_iva_comparacion_pedido";
