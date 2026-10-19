-- Una regla = un alcance + prioridad 1…N. Se elimina `desc_promo_reglas` y el tipo POR_ITEM / POR_FORMA_PAGO.

CREATE TYPE "desc_promo_alcance" AS ENUM ('TODOS', 'MARCA', 'RUBRO', 'MARCA_RUBRO', 'ITEMS');

ALTER TABLE "desc_promo"
  ADD COLUMN "alcance" "desc_promo_alcance",
  ADD COLUMN "prioridad" INTEGER,
  ADD COLUMN "id_marca" TEXT,
  ADD COLUMN "id_rubro" TEXT;

UPDATE "desc_promo"
SET "alcance" = 'ITEMS'
WHERE "tipo" = 'POR_ITEM';

UPDATE "desc_promo"
SET "alcance" = 'TODOS'
WHERE "tipo" = 'POR_FORMA_PAGO';

UPDATE "desc_promo"
SET "desc" = 0
WHERE "desc" IS NULL;

WITH orden AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM "desc_promo"
)
UPDATE "desc_promo" d
SET "prioridad" = orden.rn
FROM orden
WHERE d.id = orden.id;

CREATE TEMP TABLE "desc_promo_regla_mig" AS
SELECT
  gen_random_uuid()::text AS new_id,
  r.promo_id AS old_promo_id,
  CASE
    WHEN r.id_marca IS NOT NULL AND r.id_rubro IS NOT NULL THEN 'MARCA_RUBRO'::"desc_promo_alcance"
    WHEN r.id_marca IS NOT NULL THEN 'MARCA'::"desc_promo_alcance"
    ELSE 'RUBRO'::"desc_promo_alcance"
  END AS alcance,
  p.nombre AS nombre,
  r.desc AS desc,
  r.id_marca AS id_marca,
  r.id_rubro AS id_rubro,
  p.created_at AS created_at,
  ROW_NUMBER() OVER (ORDER BY p.prioridad ASC, r.id ASC) AS rn
FROM "desc_promo_reglas" r
INNER JOIN "desc_promo" p ON p.id = r.promo_id
WHERE r.id_marca IS NOT NULL OR r.id_rubro IS NOT NULL;

INSERT INTO "desc_promo" ("id", "alcance", "nombre", "desc", "prioridad", "id_marca", "id_rubro", "created_at", "updated_at")
SELECT
  m.new_id,
  m.alcance,
  m.nombre,
  m.desc,
  b.max_prio + m.rn,
  m.id_marca,
  m.id_rubro,
  m.created_at,
  CURRENT_TIMESTAMP
FROM "desc_promo_regla_mig" m
CROSS JOIN (SELECT COALESCE(MAX(prioridad), 0) AS max_prio FROM "desc_promo") b;

INSERT INTO "desc_promo_formas_pago" ("promo_id", "pago_id")
SELECT m.new_id, fp.pago_id
FROM "desc_promo_regla_mig" m
INNER JOIN "desc_promo_formas_pago" fp ON fp.promo_id = m.old_promo_id
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS "desc_promo_regla_mig";

ALTER TABLE "desc_promo" ALTER COLUMN "alcance" SET NOT NULL;
ALTER TABLE "desc_promo" ALTER COLUMN "prioridad" SET NOT NULL;
ALTER TABLE "desc_promo" ALTER COLUMN "desc" SET NOT NULL;

ALTER TABLE "desc_promo" DROP CONSTRAINT IF EXISTS "desc_promo_desc_chk";
ALTER TABLE "desc_promo" ADD CONSTRAINT "desc_promo_desc_chk" CHECK ("desc" >= 0 AND "desc" <= 100);

ALTER TABLE "desc_promo" ADD CONSTRAINT "desc_promo_alcance_ejes_chk" CHECK (
  (
    "alcance" = 'TODOS'
    AND "id_marca" IS NULL
    AND "id_rubro" IS NULL
  )
  OR (
    "alcance" = 'MARCA'
    AND "id_marca" IS NOT NULL
    AND "id_rubro" IS NULL
  )
  OR (
    "alcance" = 'RUBRO'
    AND "id_marca" IS NULL
    AND "id_rubro" IS NOT NULL
  )
  OR (
    "alcance" = 'MARCA_RUBRO'
    AND "id_marca" IS NOT NULL
    AND "id_rubro" IS NOT NULL
  )
  OR (
    "alcance" = 'ITEMS'
    AND "id_marca" IS NULL
    AND "id_rubro" IS NULL
  )
);

CREATE UNIQUE INDEX "desc_promo_prioridad_key" ON "desc_promo"("prioridad");
CREATE INDEX "desc_promo_alcance_idx" ON "desc_promo"("alcance");
CREATE INDEX "desc_promo_id_marca_idx" ON "desc_promo"("id_marca");
CREATE INDEX "desc_promo_id_rubro_idx" ON "desc_promo"("id_rubro");

ALTER TABLE "desc_promo"
  ADD CONSTRAINT "desc_promo_id_marca_fkey"
  FOREIGN KEY ("id_marca") REFERENCES "prod_marcas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "desc_promo"
  ADD CONSTRAINT "desc_promo_id_rubro_fkey"
  FOREIGN KEY ("id_rubro") REFERENCES "prod_rubros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE IF EXISTS "desc_promo_reglas";

DROP INDEX IF EXISTS "desc_promo_tipo_idx";
ALTER TABLE "desc_promo" DROP COLUMN "tipo";
DROP TYPE IF EXISTS "desc_promo_tipo";
