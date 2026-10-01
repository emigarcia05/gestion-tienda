-- cobros_cuotas pertenece a una forma de pago y a una entidad de su N:M.
-- El texto deja de ser único global: unique (pago_id, entidad_id, cuotas).
-- Cada par que ya usaba la misma cuota en cobros_cx_fin queda con su propia fila.

ALTER TABLE "cobros_cuotas"
  ADD COLUMN IF NOT EXISTS "pago_id" TEXT,
  ADD COLUMN IF NOT EXISTS "entidad_id" TEXT;

DROP INDEX IF EXISTS "cobros_cuotas_cuotas_key";

CREATE TEMP TABLE "_cuota_remap" AS
WITH pares AS (
  SELECT DISTINCT "cuota_id", "pago_id", "terminal_id" AS entidad_id
  FROM "cobros_cx_fin"
  WHERE "cuota_id" IS NOT NULL
),
ranked AS (
  SELECT
    "cuota_id" AS old_id,
    "pago_id",
    entidad_id,
    ROW_NUMBER() OVER (
      PARTITION BY "cuota_id"
      ORDER BY "pago_id", entidad_id
    ) AS rn
  FROM pares
)
SELECT
  old_id,
  pago_id,
  entidad_id,
  CASE WHEN rn = 1 THEN old_id ELSE gen_random_uuid()::text END AS new_id
FROM ranked;

UPDATE "cobros_cuotas" c
SET "pago_id" = m.pago_id,
    "entidad_id" = m.entidad_id
FROM "_cuota_remap" m
WHERE m.old_id = c."id"
  AND m.new_id = c."id";

INSERT INTO "cobros_cuotas" (
  "id",
  "cuotas",
  "pago_id",
  "entidad_id",
  "created_at",
  "updated_at"
)
SELECT
  m.new_id,
  c."cuotas",
  m.pago_id,
  m.entidad_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_cuota_remap" m
JOIN "cobros_cuotas" c ON c."id" = m.old_id
WHERE m.new_id <> m.old_id;

UPDATE "cobros_cx_fin" f
SET "cuota_id" = m.new_id
FROM "_cuota_remap" m
WHERE f."cuota_id" = m.old_id
  AND f."pago_id" = m.pago_id
  AND f."terminal_id" = m.entidad_id
  AND f."cuota_id" IS DISTINCT FROM m.new_id;

-- Catálogo sin par forma+entidad: no se puede asignar. Se borra.
DELETE FROM "cobros_cuotas"
WHERE "pago_id" IS NULL
   OR "entidad_id" IS NULL;

DROP TABLE "_cuota_remap";

ALTER TABLE "cobros_cuotas"
  ALTER COLUMN "pago_id" SET NOT NULL,
  ALTER COLUMN "entidad_id" SET NOT NULL;

ALTER TABLE "cobros_cuotas"
  ADD CONSTRAINT "cobros_cuotas_pago_id_fkey"
  FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cobros_cuotas"
  ADD CONSTRAINT "cobros_cuotas_entidad_id_fkey"
  FOREIGN KEY ("entidad_id") REFERENCES "cobros_entidades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_cuotas_pago_entidad_cuotas_key"
  ON "cobros_cuotas" ("pago_id", "entidad_id", "cuotas");

CREATE INDEX IF NOT EXISTS "cobros_cuotas_entidad_id_idx"
  ON "cobros_cuotas" ("entidad_id");
