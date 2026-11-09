-- Texto libre de la sección DESC. EN PDF, una línea por renglón del recuadro.
CREATE TABLE "desc_promo_linea_pdf" (
  "id" TEXT NOT NULL,
  "promo_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "texto" VARCHAR(120) NOT NULL,
  CONSTRAINT "desc_promo_linea_pdf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "desc_promo_linea_pdf_promo_orden_key"
  ON "desc_promo_linea_pdf"("promo_id", "orden");

ALTER TABLE "desc_promo_linea_pdf"
  ADD CONSTRAINT "desc_promo_linea_pdf_promo_id_fkey"
  FOREIGN KEY ("promo_id") REFERENCES "desc_promo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
