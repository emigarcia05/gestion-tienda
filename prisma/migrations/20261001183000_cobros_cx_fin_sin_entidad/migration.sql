-- Formas de pago sin entidades: una fila de cobros_cx_fin con terminal_id null.
ALTER TABLE "cobros_cx_fin"
  ALTER COLUMN "terminal_id" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_cx_fin_pago_sin_entidad_sin_cuota_ux"
  ON "cobros_cx_fin" ("pago_id")
  WHERE "terminal_id" IS NULL AND "cuota_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_cx_fin_pago_sin_entidad_cuota_ux"
  ON "cobros_cx_fin" ("pago_id", "cuota_id")
  WHERE "terminal_id" IS NULL AND "cuota_id" IS NOT NULL;
