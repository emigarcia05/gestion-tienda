-- El recuadro del presupuesto sale de Descuentos.
ALTER TABLE "desc_promo"
  ADD COLUMN "en_presupuesto" BOOLEAN NOT NULL DEFAULT true;

DROP TABLE IF EXISTS "presupuesto_formas_pago_texto_linea";
DROP TABLE IF EXISTS "presupuesto_formas_pago_texto_cuota";
DROP TABLE IF EXISTS "presupuesto_formas_pago_texto_forma";
DROP TABLE IF EXISTS "presupuesto_formas_pago_texto";
