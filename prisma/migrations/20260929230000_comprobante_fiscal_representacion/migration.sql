-- Snapshot fiscal para la representación gráfica (domicilio del receptor y condición IVA del emisor)
-- y evidencia de la solicitud ARCA sin token.

ALTER TABLE "comprobantes_vtas"
  ADD COLUMN "receptor_domicilio" TEXT,
  ADD COLUMN "emisor_condicion_iva" INTEGER;

ALTER TABLE "comprobantes_vtas"
  ADD CONSTRAINT "comprobantes_vtas_emisor_condicion_iva_fkey"
  FOREIGN KEY ("emisor_condicion_iva") REFERENCES "condicion_iva_cod_arca"("codigo")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "comprobantes_vtas_emisor_iva_idx"
  ON "comprobantes_vtas"("emisor_condicion_iva");

ALTER TABLE "comprobantes_vtas_historial_arca"
  ADD COLUMN "payload" TEXT;
