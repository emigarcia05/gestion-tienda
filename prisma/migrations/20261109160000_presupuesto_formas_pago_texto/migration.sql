-- Textos de formas de pago que se imprimen en el presupuesto.
CREATE TABLE "presupuesto_formas_pago_texto" (
  "id" TEXT NOT NULL,
  "desc_texto" VARCHAR(80) NOT NULL,
  "orden" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "presupuesto_formas_pago_texto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "presupuesto_formas_pago_texto_desc_key" ON "presupuesto_formas_pago_texto"("desc_texto");
CREATE UNIQUE INDEX "presupuesto_formas_pago_texto_orden_key" ON "presupuesto_formas_pago_texto"("orden");

CREATE TABLE "presupuesto_formas_pago_texto_forma" (
  "texto_id" TEXT NOT NULL,
  "pago_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  CONSTRAINT "presupuesto_formas_pago_texto_forma_pkey" PRIMARY KEY ("texto_id", "pago_id")
);

CREATE INDEX "presupuesto_formas_pago_texto_forma_pago_idx" ON "presupuesto_formas_pago_texto_forma"("pago_id");

ALTER TABLE "presupuesto_formas_pago_texto_forma"
  ADD CONSTRAINT "presupuesto_formas_pago_texto_forma_texto_id_fkey"
  FOREIGN KEY ("texto_id") REFERENCES "presupuesto_formas_pago_texto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "presupuesto_formas_pago_texto_forma"
  ADD CONSTRAINT "presupuesto_formas_pago_texto_forma_pago_id_fkey"
  FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
