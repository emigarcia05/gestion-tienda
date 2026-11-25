-- Catálogo de familias. prod_lista solo guarda el vínculo, que puede ser nulo.

CREATE TABLE "prod_familias" (
  "id" TEXT NOT NULL,
  "familia_cod" VARCHAR(6) NOT NULL,
  "familia_nombre" VARCHAR(120) NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prod_familias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prod_familias_familia_cod_key" ON "prod_familias"("familia_cod");

ALTER TABLE "prod_familias"
  ADD CONSTRAINT "prod_familias_familia_cod_chk"
  CHECK ("familia_cod" ~ '^[0-9]{3,6}$');

INSERT INTO "prod_familias" ("id", "familia_cod", "familia_nombre", "created_at", "updated_at")
SELECT gen_random_uuid()::text,
       lpad(btrim("cod_familia"), 3, '0'),
       '',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT btrim("cod_familia") AS "cod_familia"
  FROM "prod_lista"
  WHERE "cod_familia" IS NOT NULL
    AND btrim("cod_familia") <> ''
    AND btrim("cod_familia") ~ '^[0-9]{1,6}$'
) AS "codigos";

ALTER TABLE "prod_lista" ADD COLUMN "familia_id" TEXT;

UPDATE "prod_lista" AS "p"
SET "familia_id" = "f"."id"
FROM "prod_familias" AS "f"
WHERE "p"."cod_familia" IS NOT NULL
  AND btrim("p"."cod_familia") ~ '^[0-9]{1,6}$'
  AND "f"."familia_cod" = lpad(btrim("p"."cod_familia"), 3, '0');

DROP INDEX IF EXISTS "prod_lista_cod_familia_idx";

ALTER TABLE "prod_lista" DROP COLUMN "cod_familia";

CREATE INDEX "prod_lista_familia_id_idx" ON "prod_lista"("familia_id");

ALTER TABLE "prod_lista"
  ADD CONSTRAINT "prod_lista_familia_id_fkey"
  FOREIGN KEY ("familia_id") REFERENCES "prod_familias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
