-- Recepción de pedido → ingreso de stock (comprobante COMPRA) vinculado al pedido y al proveedor.
ALTER TABLE "stock_comprobantes"
  ADD COLUMN IF NOT EXISTS "pedido_historia_id" TEXT,
  ADD COLUMN IF NOT EXISTS "proveedor_id" TEXT;

CREATE INDEX IF NOT EXISTS "stock_comprobantes_pedido_historia_idx"
  ON "stock_comprobantes" ("pedido_historia_id");
CREATE INDEX IF NOT EXISTS "stock_comprobantes_proveedor_idx"
  ON "stock_comprobantes" ("proveedor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_pedido_historia_id_fkey'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_pedido_historia_id_fkey"
      FOREIGN KEY ("pedido_historia_id") REFERENCES "prod_ped_historial"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_proveedor_id_fkey'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_proveedor_id_fkey"
      FOREIGN KEY ("proveedor_id") REFERENCES "global_proveedores"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
