-- Un solo interruptor para el recuadro FORMAS DE PAGO y el cartel
-- DESCUENTO VÁLIDO ABONANDO CON.
--   forma_pago_en_presp → info_en_presp
--   se elimina forma_pago_valida_desc
-- Idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cobro_desc_promo'
      AND column_name = 'forma_pago_en_presp'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cobro_desc_promo'
      AND column_name = 'info_en_presp'
  ) THEN
    ALTER TABLE "cobro_desc_promo"
      RENAME COLUMN "forma_pago_en_presp" TO "info_en_presp";
  END IF;
END $$;

ALTER TABLE "cobro_desc_promo"
  DROP COLUMN IF EXISTS "forma_pago_valida_desc";
