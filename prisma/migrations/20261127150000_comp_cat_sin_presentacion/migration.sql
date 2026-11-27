-- Comp. Categorías: la presentación deja de existir.
-- Ítems y Px de referencia cuelgan de la subcategoría.
-- Si una subcategoría tenía varias presentaciones, se unen (se conserva una fila por producto y por referencia).

ALTER TABLE "prod_comp_sub_cat"
  ADD COLUMN "costo_compra_objetivo" DECIMAL(14, 4);

ALTER TABLE "prod_comp_item_comparados"
  ADD COLUMN "subcategoria_id" TEXT;

ALTER TABLE "prod_comp_item_referencia"
  ADD COLUMN "subcategoria_id" TEXT;

UPDATE "prod_comp_item_comparados" AS ic
SET "subcategoria_id" = p."subcategoria_id"
FROM "prod_comp_presentaciones" AS p
WHERE ic."presentacion_id" = p."id";

UPDATE "prod_comp_item_referencia" AS r
SET "subcategoria_id" = p."subcategoria_id"
FROM "prod_comp_presentaciones" AS p
WHERE r."presentacion_id" = p."id";

UPDATE "prod_comp_sub_cat" AS s
SET "costo_compra_objetivo" = src."costo"
FROM (
  SELECT DISTINCT ON ("subcategoria_id")
    "subcategoria_id",
    "costo_compra_objetivo" AS "costo"
  FROM "prod_comp_presentaciones"
  WHERE "costo_compra_objetivo" IS NOT NULL
  ORDER BY "subcategoria_id", "created_at" ASC
) AS src
WHERE s."id" = src."subcategoria_id";

DELETE FROM "prod_comp_item_comparados" AS ic
USING (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "subcategoria_id", "cod_ext_prod_precios_provee"
      ORDER BY
        (CASE WHEN "dto_extra" IS NOT NULL OR "dif_px_ref_manual" IS NOT NULL THEN 0 ELSE 1 END),
        "created_at" ASC,
        "id" ASC
    ) AS rn
  FROM "prod_comp_item_comparados"
  WHERE "subcategoria_id" IS NOT NULL
) AS ranked
WHERE ic."id" = ranked."id"
  AND ranked.rn > 1;

DELETE FROM "prod_comp_item_referencia" AS r
USING (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "subcategoria_id", "ref_cod_tienda", "ref_competencia_id"
      ORDER BY "orden" ASC, "created_at" ASC, "id" ASC
    ) AS rn
  FROM "prod_comp_item_referencia"
  WHERE "subcategoria_id" IS NOT NULL
) AS ranked
WHERE r."id" = ranked."id"
  AND ranked.rn > 1;

DELETE FROM "prod_comp_item_comparados" WHERE "subcategoria_id" IS NULL;
DELETE FROM "prod_comp_item_referencia" WHERE "subcategoria_id" IS NULL;

ALTER TABLE "prod_comp_item_comparados"
  ALTER COLUMN "subcategoria_id" SET NOT NULL;

ALTER TABLE "prod_comp_item_referencia"
  ALTER COLUMN "subcategoria_id" SET NOT NULL;

ALTER TABLE "prod_comp_item_comparados"
  DROP CONSTRAINT IF EXISTS "prod_comp_item_comparados_presentacion_id_fkey";

DROP INDEX IF EXISTS "prod_comp_item_comparados_present_cod_ext_ux";
DROP INDEX IF EXISTS "prod_comp_item_comparados_presentacion_id_idx";

ALTER TABLE "prod_comp_item_comparados"
  DROP COLUMN "presentacion_id";

ALTER TABLE "prod_comp_item_referencia"
  DROP CONSTRAINT IF EXISTS "prod_comp_item_referencia_presentacion_id_fkey";

DROP INDEX IF EXISTS "prod_comp_item_referencia_present_ref_ux";
DROP INDEX IF EXISTS "prod_comp_item_referencia_presentacion_id_idx";

ALTER TABLE "prod_comp_item_referencia"
  DROP COLUMN "presentacion_id";

ALTER TABLE "prod_comp_item_comparados"
  ADD CONSTRAINT "prod_comp_item_comparados_subcategoria_id_fkey"
  FOREIGN KEY ("subcategoria_id") REFERENCES "prod_comp_sub_cat" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "prod_comp_item_comparados_sub_cod_ext_ux"
  ON "prod_comp_item_comparados" ("subcategoria_id", "cod_ext_prod_precios_provee");

CREATE INDEX "prod_comp_item_comparados_subcategoria_id_idx"
  ON "prod_comp_item_comparados" ("subcategoria_id");

ALTER TABLE "prod_comp_item_referencia"
  ADD CONSTRAINT "prod_comp_item_referencia_subcategoria_id_fkey"
  FOREIGN KEY ("subcategoria_id") REFERENCES "prod_comp_sub_cat" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "prod_comp_item_referencia_sub_ref_ux"
  ON "prod_comp_item_referencia" ("subcategoria_id", "ref_cod_tienda", "ref_competencia_id");

CREATE INDEX "prod_comp_item_referencia_subcategoria_id_idx"
  ON "prod_comp_item_referencia" ("subcategoria_id");

DROP TABLE "prod_comp_presentaciones";
