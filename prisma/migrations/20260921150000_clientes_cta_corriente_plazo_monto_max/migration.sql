-- clientes.plazo_cuenta_corriente → cta_corriente_plazo + tope cta_corriente_monto_max

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'plazo_cuenta_corriente'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'cta_corriente_plazo'
  ) THEN
    ALTER TABLE "clientes" RENAME COLUMN "plazo_cuenta_corriente" TO "cta_corriente_plazo";
  END IF;
END $$;

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_plazo_cuenta_corriente_chk";

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_cta_corriente_plazo_chk";

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cta_corriente_plazo_chk"
  CHECK (
    "cta_corriente_plazo" IS NULL
    OR ("cta_corriente_plazo" >= 1 AND "cta_corriente_plazo" <= 365)
  );

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "cta_corriente_monto_max" DECIMAL(14, 2);

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_cta_corriente_monto_max_chk";

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cta_corriente_monto_max_chk"
  CHECK (
    "cta_corriente_monto_max" IS NULL
    OR "cta_corriente_monto_max" >= 0
  );
