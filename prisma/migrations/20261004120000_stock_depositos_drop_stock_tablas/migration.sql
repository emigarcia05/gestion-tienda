-- Catálogo de depósitos: global_depositos → stock_depositos (id_deposito + sucursal).
-- Se eliminan prod_tienda_stock y stock_trasn_depositos.
-- El vínculo sucursal↔depósito pasa de sucursales.id_deposito a stock_depositos.sucursal.

DROP TABLE IF EXISTS "prod_tienda_stock";
DROP TABLE IF EXISTS "stock_trasn_depositos";

CREATE TABLE IF NOT EXISTS "stock_depositos" (
    "id_deposito" INTEGER NOT NULL,
    "sucursal" TEXT NOT NULL,
    CONSTRAINT "stock_depositos_pkey" PRIMARY KEY ("id_deposito")
);

INSERT INTO "stock_depositos" ("id_deposito", "sucursal")
SELECT s."id_deposito", s."id"
FROM "sucursales" s
WHERE s."id_deposito" IS NOT NULL
ON CONFLICT ("id_deposito") DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_depositos_sucursal_key"
    ON "stock_depositos"("sucursal");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_depositos_sucursal_fkey'
  ) THEN
    ALTER TABLE "stock_depositos"
      ADD CONSTRAINT "stock_depositos_sucursal_fkey"
      FOREIGN KEY ("sucursal") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "sucursales" DROP CONSTRAINT IF EXISTS "global_sucursales_id_deposito_fkey";
ALTER TABLE "sucursales" DROP CONSTRAINT IF EXISTS "sucursales_id_deposito_fkey";
ALTER TABLE "sucursales" DROP CONSTRAINT IF EXISTS "sucursales_id_deposito_key";
ALTER TABLE "sucursales" DROP CONSTRAINT IF EXISTS "global_sucursales_id_deposito_key";
ALTER TABLE "sucursales" DROP COLUMN IF EXISTS "id_deposito";

DROP TABLE IF EXISTS "global_depositos";
