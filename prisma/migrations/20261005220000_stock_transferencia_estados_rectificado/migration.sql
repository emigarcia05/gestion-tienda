-- Estados emitido / rectificado + ítems con enviada 0 o recibida distinta.

ALTER TYPE "stock_transferencia_estado" ADD VALUE IF NOT EXISTS 'emitido_pendiente';
ALTER TYPE "stock_transferencia_estado" ADD VALUE IF NOT EXISTS 'rectificado_pendiente';

UPDATE "stock_transferencias"
SET "estado" = 'emitido_pendiente'
WHERE "estado" = 'pendiente';

ALTER TABLE "stock_transferencias"
  ALTER COLUMN "estado" SET DEFAULT 'emitido_pendiente';

ALTER TABLE "stock_transferencias_items"
  DROP CONSTRAINT IF EXISTS "stock_transferencias_items_cantidad_chk";
ALTER TABLE "stock_transferencias_items"
  ADD CONSTRAINT "stock_transferencias_items_cantidad_chk" CHECK ("cantidad" >= 0);

ALTER TABLE "stock_transferencias_items"
  DROP CONSTRAINT IF EXISTS "stock_transferencias_items_confirmada_chk";
ALTER TABLE "stock_transferencias_items"
  ADD CONSTRAINT "stock_transferencias_items_confirmada_chk" CHECK (
    "cantidad_confirmada" IS NULL OR "cantidad_confirmada" >= 0
  );
