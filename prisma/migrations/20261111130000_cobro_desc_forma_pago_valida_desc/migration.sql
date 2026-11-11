-- Formas con las que es válido el descuento en el presupuesto.
-- Columna en cobro_desc_promo y líneas de texto (misma forma que el recuadro, sin «incluye descuento»).

ALTER TABLE "cobro_desc_promo"
  ADD COLUMN "forma_pago_valida_desc" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "cobro_desc_forma_pago_valida_desc" (
  "id" TEXT NOT NULL,
  "promo_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "texto" VARCHAR(120) NOT NULL,
  CONSTRAINT "cobro_desc_forma_pago_valida_desc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cobro_desc_forma_pago_valida_desc_promo_orden_key"
  ON "cobro_desc_forma_pago_valida_desc"("promo_id", "orden");

ALTER TABLE "cobro_desc_forma_pago_valida_desc"
  ADD CONSTRAINT "cobro_desc_forma_pago_valida_desc_promo_id_fkey"
  FOREIGN KEY ("promo_id") REFERENCES "cobro_desc_promo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
