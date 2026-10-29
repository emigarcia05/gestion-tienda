-- cobros_vinc_cajas: punto de venta asociado (obligatorio solo con seguimiento_fiscal = TRUE; si no, NULL).
ALTER TABLE "cobros_vinc_cajas"
  ADD COLUMN IF NOT EXISTS "pto_vta_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_vinc_cajas_pto_vta_id_fkey'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas"
      ADD CONSTRAINT "cobros_vinc_cajas_pto_vta_id_fkey"
      FOREIGN KEY ("pto_vta_id") REFERENCES "ptos_vtas"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cobros_vinc_cajas_pto_vta_idx" ON "cobros_vinc_cajas"("pto_vta_id");
