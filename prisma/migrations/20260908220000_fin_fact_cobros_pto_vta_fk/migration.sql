-- Totales Fact & Cobros vinculados al catálogo `global_pto_vtas`.
ALTER TABLE "fin_fact_cobros_pto_vta_mes" ADD COLUMN "pto_vta_id" TEXT;

UPDATE "fin_fact_cobros_pto_vta_mes" AS f
SET "pto_vta_id" = g."id"
FROM "global_pto_vtas" AS g
WHERE f."nro_pto_vta" ~ '^[0-9]+$'
  AND g."pto_venta" = CAST(f."nro_pto_vta" AS INTEGER);

DELETE FROM "fin_fact_cobros_pto_vta_mes" WHERE "pto_vta_id" IS NULL;

DROP INDEX IF EXISTS "fin_fact_cobros_pto_vta_mes_ux";

ALTER TABLE "fin_fact_cobros_pto_vta_mes" DROP COLUMN "nro_pto_vta";

ALTER TABLE "fin_fact_cobros_pto_vta_mes" ALTER COLUMN "pto_vta_id" SET NOT NULL;

CREATE UNIQUE INDEX "fin_fact_cobros_pto_vta_mes_ux"
ON "fin_fact_cobros_pto_vta_mes" ("pto_vta_id", "mes", "anio");

CREATE INDEX "fin_fact_cobros_pto_vta_mes_pto_vta_idx"
ON "fin_fact_cobros_pto_vta_mes" ("pto_vta_id");

ALTER TABLE "fin_fact_cobros_pto_vta_mes"
  ADD CONSTRAINT "fin_fact_cobros_pto_vta_mes_pto_vta_id_fkey"
  FOREIGN KEY ("pto_vta_id") REFERENCES "global_pto_vtas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
