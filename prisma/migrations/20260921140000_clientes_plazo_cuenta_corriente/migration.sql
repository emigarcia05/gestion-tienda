-- Plazo de cuenta corriente por cliente (ventas diferidas).

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "plazo_cuenta_corriente" INTEGER;

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_plazo_cuenta_corriente_chk";

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_plazo_cuenta_corriente_chk"
  CHECK (
    "plazo_cuenta_corriente" IS NULL
    OR ("plazo_cuenta_corriente" >= 1 AND "plazo_cuenta_corriente" <= 365)
  );
