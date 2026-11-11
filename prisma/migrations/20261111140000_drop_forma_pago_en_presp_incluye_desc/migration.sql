-- El recuadro FORMAS DE PAGO usa cobro_desc_promo.desc:
--   desc > 0 muestra el %; desc = 0 imprime las líneas sin %.
-- Idempotente.

ALTER TABLE "cobro_desc_promo"
  DROP COLUMN IF EXISTS "forma_pago_en_presp_incluye_desc";
