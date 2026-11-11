-- Columnas de FORMA DE PAGO EN PRESUPUESTO en cobro_desc_promo
-- (campos Prisma enPresupuesto / incluyeDescuento, sin cambio de nombre):
--   en_presupuesto    → forma_pago_en_presp
--   incluye_descuento → forma_pago_en_presp_incluye_desc
-- Idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cobro_desc_promo'
      AND column_name = 'en_presupuesto'
  ) THEN
    ALTER TABLE "cobro_desc_promo"
      RENAME COLUMN "en_presupuesto" TO "forma_pago_en_presp";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cobro_desc_promo'
      AND column_name = 'incluye_descuento'
  ) THEN
    ALTER TABLE "cobro_desc_promo"
      RENAME COLUMN "incluye_descuento" TO "forma_pago_en_presp_incluye_desc";
  END IF;
END $$;
