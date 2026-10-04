-- Cantidades de venta y stock: hasta 1 decimal.

ALTER TABLE "stock_movimientos"
  ALTER COLUMN "cantidad" TYPE DECIMAL(12,1)
  USING ("cantidad"::DECIMAL(12,1));

ALTER TABLE "comprobantes_vtas_items"
  ALTER COLUMN "cantidad" TYPE DECIMAL(12,1)
  USING (ROUND("cantidad", 1));
