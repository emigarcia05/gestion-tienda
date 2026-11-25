-- La familia se identifica por id. familia_nombre es único y no vacío.
-- Las fichas FLIA {código} pasan a FLIA {id} mientras el código todavía existe.

UPDATE "consulta_tecnica_fichas" AS "ficha"
SET "clave" = 'FLIA ' || "familia"."id"
FROM "prod_familias" AS "familia"
WHERE "ficha"."clave" = 'FLIA ' || "familia"."familia_cod";

UPDATE "prod_familias"
SET "familia_nombre" = "familia_cod"
WHERE btrim("familia_nombre") = '';

WITH "duplicados" AS (
  SELECT
    "id",
    "familia_cod",
    row_number() OVER (PARTITION BY "familia_nombre" ORDER BY "familia_cod", "id") AS "n"
  FROM "prod_familias"
)
UPDATE "prod_familias" AS "familia"
SET "familia_nombre" = left("familia"."familia_nombre" || ' ' || "duplicados"."familia_cod", 120)
FROM "duplicados"
WHERE "familia"."id" = "duplicados"."id"
  AND "duplicados"."n" > 1;

ALTER TABLE "prod_familias" DROP CONSTRAINT IF EXISTS "prod_familias_familia_cod_chk";

DROP INDEX IF EXISTS "prod_familias_familia_cod_key";

ALTER TABLE "prod_familias" DROP COLUMN "familia_cod";

ALTER TABLE "prod_familias"
  ADD CONSTRAINT "prod_familias_familia_nombre_chk"
  CHECK (char_length(btrim("familia_nombre")) BETWEEN 1 AND 120);

CREATE UNIQUE INDEX "prod_familias_familia_nombre_key" ON "prod_familias" ("familia_nombre");
