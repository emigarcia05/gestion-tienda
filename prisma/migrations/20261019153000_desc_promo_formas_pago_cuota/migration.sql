-- CANT. CUOTAS en desc_promo_formas_pago (sin tabla nueva).
ALTER TABLE "desc_promo_formas_pago" ADD COLUMN "id" TEXT;
ALTER TABLE "desc_promo_formas_pago" ADD COLUMN "cuota_id" TEXT;

UPDATE "desc_promo_formas_pago"
SET "id" = replace(gen_random_uuid()::text, '-', '')
WHERE "id" IS NULL;

ALTER TABLE "desc_promo_formas_pago" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "desc_promo_formas_pago" DROP CONSTRAINT "desc_promo_formas_pago_pkey";
ALTER TABLE "desc_promo_formas_pago" ADD CONSTRAINT "desc_promo_formas_pago_pkey" PRIMARY KEY ("id");

INSERT INTO "desc_promo_formas_pago" ("id", "promo_id", "pago_id", "cuota_id")
SELECT replace(gen_random_uuid()::text, '-', ''), f."promo_id", f."pago_id", d."cuota_id"
FROM "desc_promo_formas_pago" f
INNER JOIN (
  SELECT DISTINCT "pago_id", "cuota_id"
  FROM "cobros_cuota_vinculos"
) d ON d."pago_id" = f."pago_id"
WHERE f."cuota_id" IS NULL;

DELETE FROM "desc_promo_formas_pago" f
WHERE f."cuota_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "cobros_cuota_vinculos" v
    WHERE v."pago_id" = f."pago_id"
  );

ALTER TABLE "desc_promo_formas_pago"
  ADD CONSTRAINT "desc_promo_formas_pago_cuota_id_fkey"
  FOREIGN KEY ("cuota_id") REFERENCES "cobros_cuotas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "desc_promo_formas_pago_promo_pago_cuota_ux"
  ON "desc_promo_formas_pago" ("promo_id", "pago_id", "cuota_id")
  WHERE "cuota_id" IS NOT NULL;

CREATE UNIQUE INDEX "desc_promo_formas_pago_promo_pago_sin_cuota_ux"
  ON "desc_promo_formas_pago" ("promo_id", "pago_id")
  WHERE "cuota_id" IS NULL;
