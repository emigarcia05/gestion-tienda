-- cobros_vinc_cajas: el seguimiento fiscal se asocia al TITULAR de los puntos de venta
-- (tesoreria_titulares), no a un punto de venta. Reemplaza pto_vta_id (se migra a su titular).
ALTER TABLE "cobros_vinc_cajas"
  ADD COLUMN IF NOT EXISTS "titular_id" TEXT;

UPDATE "cobros_vinc_cajas" AS c
SET "titular_id" = t."id"
FROM "ptos_vtas" AS p
JOIN "tesoreria_titulares" AS t ON t."nombre" = p."titular"
WHERE c."pto_vta_id" = p."id"
  AND c."titular_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_vinc_cajas_titular_id_fkey'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas"
      ADD CONSTRAINT "cobros_vinc_cajas_titular_id_fkey"
      FOREIGN KEY ("titular_id") REFERENCES "tesoreria_titulares"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cobros_vinc_cajas_titular_idx" ON "cobros_vinc_cajas"("titular_id");

ALTER TABLE "cobros_vinc_cajas" DROP CONSTRAINT IF EXISTS "cobros_vinc_cajas_pto_vta_id_fkey";
DROP INDEX IF EXISTS "cobros_vinc_cajas_pto_vta_idx";
ALTER TABLE "cobros_vinc_cajas" DROP COLUMN IF EXISTS "pto_vta_id";
