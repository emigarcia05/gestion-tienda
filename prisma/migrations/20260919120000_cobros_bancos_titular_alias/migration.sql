-- cobros_bancos: titular (FK tesoreria_titulares.nombre) + alias (texto usuario)
-- Filas existentes: alias = nombre del banco; titular queda null hasta que el usuario lo asigne.

ALTER TABLE "cobros_bancos" ADD COLUMN IF NOT EXISTS "titular" TEXT;
ALTER TABLE "cobros_bancos" ADD COLUMN IF NOT EXISTS "alias" TEXT;

UPDATE "cobros_bancos"
SET "alias" = "nombre"
WHERE "alias" IS NULL OR trim("alias") = '';

ALTER TABLE "cobros_bancos" ALTER COLUMN "alias" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "cobros_bancos_titular_idx" ON "cobros_bancos"("titular");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_bancos_titular_fkey'
  ) THEN
    ALTER TABLE "cobros_bancos"
      ADD CONSTRAINT "cobros_bancos_titular_fkey"
      FOREIGN KEY ("titular") REFERENCES "tesoreria_titulares"("nombre")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
