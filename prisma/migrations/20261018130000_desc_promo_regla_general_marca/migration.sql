-- POR_FORMA_PAGO: cabecera `desc` = regla general; excepciones por marca / rubro / sub-rubro.

ALTER TABLE "desc_promo_reglas" ALTER COLUMN "id_rubro" DROP NOT NULL;
ALTER TABLE "desc_promo_reglas" ADD COLUMN "id_marca" TEXT;

DROP INDEX IF EXISTS "desc_promo_reglas_promo_rubro_todos_uidx";
DROP INDEX IF EXISTS "desc_promo_reglas_promo_rubro_sub_uidx";

ALTER TABLE "desc_promo_reglas"
  ADD CONSTRAINT "desc_promo_reglas_eje_chk"
  CHECK ("id_marca" IS NOT NULL OR "id_rubro" IS NOT NULL);

ALTER TABLE "desc_promo_reglas"
  ADD CONSTRAINT "desc_promo_reglas_sub_requiere_rubro_chk"
  CHECK ("id_sub_rubro" IS NULL OR "id_rubro" IS NOT NULL);

ALTER TABLE "desc_promo_reglas"
  ADD CONSTRAINT "desc_promo_reglas_id_marca_fkey"
  FOREIGN KEY ("id_marca") REFERENCES "prod_marcas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "desc_promo_reglas_id_marca_idx" ON "desc_promo_reglas"("id_marca");

CREATE UNIQUE INDEX "desc_promo_reglas_promo_marca_uidx"
  ON "desc_promo_reglas"("promo_id", "id_marca")
  WHERE "id_marca" IS NOT NULL AND "id_rubro" IS NULL AND "id_sub_rubro" IS NULL;

CREATE UNIQUE INDEX "desc_promo_reglas_promo_rubro_uidx"
  ON "desc_promo_reglas"("promo_id", "id_rubro")
  WHERE "id_marca" IS NULL AND "id_rubro" IS NOT NULL AND "id_sub_rubro" IS NULL;

CREATE UNIQUE INDEX "desc_promo_reglas_promo_rubro_sub_uidx"
  ON "desc_promo_reglas"("promo_id", "id_rubro", "id_sub_rubro")
  WHERE "id_marca" IS NULL AND "id_rubro" IS NOT NULL AND "id_sub_rubro" IS NOT NULL;

CREATE UNIQUE INDEX "desc_promo_reglas_promo_marca_rubro_uidx"
  ON "desc_promo_reglas"("promo_id", "id_marca", "id_rubro")
  WHERE "id_marca" IS NOT NULL AND "id_rubro" IS NOT NULL AND "id_sub_rubro" IS NULL;

CREATE UNIQUE INDEX "desc_promo_reglas_promo_marca_rubro_sub_uidx"
  ON "desc_promo_reglas"("promo_id", "id_marca", "id_rubro", "id_sub_rubro")
  WHERE "id_marca" IS NOT NULL AND "id_rubro" IS NOT NULL AND "id_sub_rubro" IS NOT NULL;
