-- fecha → fecha_registro + fecha_acreditacion (impacto de caja).
-- monto_acreditado = lo que suma/resta al saldo de caja (cobros: bruto − % costo financiero).

ALTER TABLE "tesoreria_movimientos"
  RENAME COLUMN "fecha" TO "fecha_registro";

ALTER TABLE "tesoreria_movimientos"
  ADD COLUMN "fecha_acreditacion" DATE;

UPDATE "tesoreria_movimientos"
SET "fecha_acreditacion" = "fecha_registro"
WHERE "fecha_acreditacion" IS NULL;

ALTER TABLE "tesoreria_movimientos"
  ALTER COLUMN "fecha_acreditacion" SET NOT NULL;

ALTER TABLE "tesoreria_movimientos"
  ADD COLUMN "monto_acreditado" INTEGER;

UPDATE "tesoreria_movimientos"
SET "monto_acreditado" = "monto"
WHERE "monto_acreditado" IS NULL;

ALTER TABLE "tesoreria_movimientos"
  ALTER COLUMN "monto_acreditado" SET NOT NULL;

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_monto_acreditado_chk"
  CHECK ("monto_acreditado" >= 0);

DROP INDEX IF EXISTS "tesoreria_movimientos_caja_fecha_idx";
DROP INDEX IF EXISTS "tesoreria_movimientos_fecha_idx";

CREATE INDEX "tesoreria_movimientos_caja_fecha_acred_idx"
  ON "tesoreria_movimientos" ("caja_id", "fecha_acreditacion");
CREATE INDEX "tesoreria_movimientos_fecha_registro_idx"
  ON "tesoreria_movimientos" ("fecha_registro");
CREATE INDEX "tesoreria_movimientos_fecha_acreditacion_idx"
  ON "tesoreria_movimientos" ("fecha_acreditacion");
