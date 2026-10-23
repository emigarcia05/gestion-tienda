-- cobros_vinc_cajas: discrimina_iva → genera_iva_credito (solo dato) y nueva costo_incluye_iva,
-- que decide el % de Cx Fin (TRUE = CX TOTAL C/ IVA, FALSE = S/ IVA). Backfill = NOT discrimina_iva
-- para que el % de cada vínculo no cambie.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cobros_vinc_cajas' AND column_name = 'discrimina_iva'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas" RENAME COLUMN "discrimina_iva" TO "genera_iva_credito";
  END IF;
END $$;

ALTER TABLE "cobros_vinc_cajas"
  ADD COLUMN IF NOT EXISTS "costo_incluye_iva" BOOLEAN NOT NULL DEFAULT true;

UPDATE "cobros_vinc_cajas" SET "costo_incluye_iva" = NOT "genera_iva_credito";
