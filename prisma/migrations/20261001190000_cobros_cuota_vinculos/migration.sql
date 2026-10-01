-- Una cuota (texto único) puede vincularse a varios pares forma de pago + entidad.

CREATE TABLE "cobros_cuota_vinculos" (
  "cuota_id" TEXT NOT NULL,
  "pago_id" TEXT NOT NULL,
  "entidad_id" TEXT NOT NULL,
  CONSTRAINT "cobros_cuota_vinculos_pkey" PRIMARY KEY ("cuota_id", "pago_id", "entidad_id")
);

INSERT INTO "cobros_cuota_vinculos" ("cuota_id", "pago_id", "entidad_id")
SELECT "id", "pago_id", "entidad_id"
FROM "cobros_cuotas";

CREATE TEMP TABLE "_cuota_canon" AS
SELECT "cuotas", MIN("id") AS id
FROM "cobros_cuotas"
GROUP BY "cuotas";

UPDATE "cobros_cuota_vinculos" v
SET "cuota_id" = c.id
FROM "cobros_cuotas" src
JOIN "_cuota_canon" c ON c."cuotas" = src."cuotas"
WHERE v."cuota_id" = src."id"
  AND v."cuota_id" <> c.id;

UPDATE "cobros_cx_fin" f
SET "cuota_id" = c.id
FROM "cobros_cuotas" src
JOIN "_cuota_canon" c ON c."cuotas" = src."cuotas"
WHERE f."cuota_id" = src."id"
  AND f."cuota_id" IS DISTINCT FROM c.id;

DELETE FROM "cobros_cuotas" src
USING "_cuota_canon" c
WHERE src."cuotas" = c."cuotas"
  AND src."id" <> c.id;

DROP TABLE "_cuota_canon";

ALTER TABLE "cobros_cuotas" DROP CONSTRAINT IF EXISTS "cobros_cuotas_pago_id_fkey";
ALTER TABLE "cobros_cuotas" DROP CONSTRAINT IF EXISTS "cobros_cuotas_entidad_id_fkey";
DROP INDEX IF EXISTS "cobros_cuotas_pago_entidad_cuotas_key";
DROP INDEX IF EXISTS "cobros_cuotas_entidad_id_idx";
ALTER TABLE "cobros_cuotas" DROP COLUMN IF EXISTS "pago_id";
ALTER TABLE "cobros_cuotas" DROP COLUMN IF EXISTS "entidad_id";

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_cuotas_cuotas_key"
  ON "cobros_cuotas" ("cuotas");

ALTER TABLE "cobros_cuota_vinculos"
  ADD CONSTRAINT "cobros_cuota_vinculos_cuota_id_fkey"
  FOREIGN KEY ("cuota_id") REFERENCES "cobros_cuotas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cobros_cuota_vinculos"
  ADD CONSTRAINT "cobros_cuota_vinculos_pago_id_fkey"
  FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cobros_cuota_vinculos"
  ADD CONSTRAINT "cobros_cuota_vinculos_entidad_id_fkey"
  FOREIGN KEY ("entidad_id") REFERENCES "cobros_entidades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "cobros_cuota_vinculos_pago_id_idx"
  ON "cobros_cuota_vinculos" ("pago_id");

CREATE INDEX IF NOT EXISTS "cobros_cuota_vinculos_entidad_id_idx"
  ON "cobros_cuota_vinculos" ("entidad_id");
