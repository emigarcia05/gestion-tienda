-- tesoreria_movimientos.sucursal_id → sucursales.id
-- Sucursal del operador que creó el movimiento (no la sucursal de la caja).

ALTER TABLE "tesoreria_movimientos"
  ADD COLUMN IF NOT EXISTS "sucursal_id" TEXT;

CREATE INDEX IF NOT EXISTS "tesoreria_movimientos_sucursal_idx"
  ON "tesoreria_movimientos" ("sucursal_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tesoreria_movimientos_sucursal_id_fkey'
  ) THEN
    ALTER TABLE "tesoreria_movimientos"
      ADD CONSTRAINT "tesoreria_movimientos_sucursal_id_fkey"
      FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
