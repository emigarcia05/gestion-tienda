-- Usuario que registró el comprobante de stock (columna USUARIO del listado).

ALTER TABLE "stock_comprobantes"
  ADD COLUMN IF NOT EXISTS "personal_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_personal_id_fkey'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_personal_id_fkey"
      FOREIGN KEY ("personal_id") REFERENCES "personal"("id_personal")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stock_comprobantes_personal_idx"
  ON "stock_comprobantes" ("personal_id");
