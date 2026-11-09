-- El DESC. pasa a ser un entero 0–100. El % de la pantalla es un sufijo fijo.
ALTER TABLE "presupuesto_formas_pago_texto" ADD COLUMN "descuento" INTEGER;

UPDATE "presupuesto_formas_pago_texto"
SET "descuento" = LEAST(
  100,
  GREATEST(
    0,
    COALESCE(NULLIF(regexp_replace("desc_texto", '[^0-9]', '', 'g'), '')::integer, 0)
  )
);

ALTER TABLE "presupuesto_formas_pago_texto" ALTER COLUMN "descuento" SET NOT NULL;

ALTER TABLE "presupuesto_formas_pago_texto"
  ADD CONSTRAINT "presupuesto_formas_pago_texto_descuento_chk"
  CHECK ("descuento" >= 0 AND "descuento" <= 100);

DROP INDEX "presupuesto_formas_pago_texto_desc_key";

CREATE UNIQUE INDEX "presupuesto_formas_pago_texto_descuento_key"
  ON "presupuesto_formas_pago_texto"("descuento");

ALTER TABLE "presupuesto_formas_pago_texto" DROP COLUMN "desc_texto";

-- Cuotas elegidas de cada forma. Solo si esa forma tiene cuotas en el catálogo.
CREATE TABLE "presupuesto_formas_pago_texto_cuota" (
  "texto_id" TEXT NOT NULL,
  "pago_id" TEXT NOT NULL,
  "cuota_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  CONSTRAINT "presupuesto_formas_pago_texto_cuota_pkey" PRIMARY KEY ("texto_id", "pago_id", "cuota_id")
);

CREATE INDEX "presupuesto_formas_pago_texto_cuota_cuota_idx"
  ON "presupuesto_formas_pago_texto_cuota"("cuota_id");

ALTER TABLE "presupuesto_formas_pago_texto_cuota"
  ADD CONSTRAINT "presupuesto_formas_pago_texto_cuota_forma_fkey"
  FOREIGN KEY ("texto_id", "pago_id")
  REFERENCES "presupuesto_formas_pago_texto_forma"("texto_id", "pago_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "presupuesto_formas_pago_texto_cuota"
  ADD CONSTRAINT "presupuesto_formas_pago_texto_cuota_cuota_id_fkey"
  FOREIGN KEY ("cuota_id") REFERENCES "cobros_cuotas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
