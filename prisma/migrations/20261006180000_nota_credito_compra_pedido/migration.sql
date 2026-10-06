-- NC de compra desde Recepción Pedido: egreso de stock + comprobante aplicado al de la recepción.
ALTER TYPE "stock_movimiento_categoria" ADD VALUE IF NOT EXISTS 'nota_credito_compra';
ALTER TYPE "stock_comprobante_tipo" ADD VALUE IF NOT EXISTS 'nota_credito_compra';

ALTER TABLE "stock_movimientos" DROP CONSTRAINT IF EXISTS "stock_movimientos_tipo_categoria";
ALTER TABLE "stock_movimientos"
  ADD CONSTRAINT "stock_movimientos_tipo_categoria" CHECK (
    ("categoria_movimiento"::text = 'venta' AND "tipo_movimiento"::text = 'egreso')
    OR ("categoria_movimiento"::text = 'nota_credito' AND "tipo_movimiento"::text = 'ingreso')
    OR ("categoria_movimiento"::text = 'compra' AND "tipo_movimiento"::text = 'ingreso')
    OR ("categoria_movimiento"::text = 'nota_credito_compra' AND "tipo_movimiento"::text = 'egreso')
    OR ("categoria_movimiento"::text = 'transf_interna')
    OR ("categoria_movimiento"::text = 'ajuste_stock')
  );

ALTER TABLE "fin_compras_comprobante"
  ADD COLUMN IF NOT EXISTS "pedido_historia_id" TEXT,
  ADD COLUMN IF NOT EXISTS "comprobante_asoc_id" TEXT;

CREATE INDEX IF NOT EXISTS "fin_compras_comprobante_pedido_historia_idx"
  ON "fin_compras_comprobante" ("pedido_historia_id");
CREATE INDEX IF NOT EXISTS "fin_compras_comprobante_comprobante_asoc_idx"
  ON "fin_compras_comprobante" ("comprobante_asoc_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_compras_comprobante_pedido_historia_id_fkey'
  ) THEN
    ALTER TABLE "fin_compras_comprobante"
      ADD CONSTRAINT "fin_compras_comprobante_pedido_historia_id_fkey"
      FOREIGN KEY ("pedido_historia_id") REFERENCES "prod_ped_historial"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_compras_comprobante_comprobante_asoc_id_fkey'
  ) THEN
    ALTER TABLE "fin_compras_comprobante"
      ADD CONSTRAINT "fin_compras_comprobante_comprobante_asoc_id_fkey"
      FOREIGN KEY ("comprobante_asoc_id") REFERENCES "fin_compras_comprobante"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
