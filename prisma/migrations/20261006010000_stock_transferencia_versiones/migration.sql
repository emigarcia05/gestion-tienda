-- Número de familia + versión (N° 0001 / 0001-2) y comentario de rectificación.
-- Aceptada puede no tener comprobante si esta versión no movió stock.

ALTER TABLE "stock_transferencias"
  ADD COLUMN IF NOT EXISTS "numero" INTEGER,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "comentario" TEXT;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS n
  FROM "stock_transferencias"
  WHERE "numero" IS NULL
)
UPDATE "stock_transferencias" t
SET "numero" = numbered.n
FROM numbered
WHERE t."id" = numbered.id;

ALTER TABLE "stock_transferencias"
  ALTER COLUMN "numero" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_transferencias_numero_version_key"
  ON "stock_transferencias" ("numero", "version");

ALTER TABLE "stock_transferencias"
  DROP CONSTRAINT IF EXISTS "stock_transferencias_aceptada_comprobante_chk";

ALTER TABLE "stock_transferencias"
  ADD CONSTRAINT "stock_transferencias_comprobante_aceptada_chk" CHECK (
    "comprobante_id" IS NULL OR "estado" = 'aceptada'
  );

ALTER TABLE "stock_transferencias"
  DROP CONSTRAINT IF EXISTS "stock_transferencias_numero_version_chk";

ALTER TABLE "stock_transferencias"
  ADD CONSTRAINT "stock_transferencias_numero_version_chk" CHECK (
    "numero" >= 1 AND "version" >= 1
  );
