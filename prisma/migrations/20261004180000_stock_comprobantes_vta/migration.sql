-- Vínculo stock_comprobantes → vtas_comprobantes (idempotencia y revertir al borrar).

ALTER TABLE "stock_comprobantes"
  ADD COLUMN IF NOT EXISTS "comprobante_vta_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_comprobante_vta_id_fkey'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_comprobante_vta_id_fkey"
      FOREIGN KEY ("comprobante_vta_id") REFERENCES "vtas_comprobantes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_comprobantes_comprobante_vta_key"
  ON "stock_comprobantes" ("comprobante_vta_id");
