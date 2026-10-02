-- Usuario que registró el movimiento (`personal.id_personal`).
ALTER TABLE "tesoreria_movimientos"
  ADD COLUMN IF NOT EXISTS "personal_id" INTEGER;

CREATE INDEX IF NOT EXISTS "tesoreria_movimientos_personal_idx"
  ON "tesoreria_movimientos"("personal_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tesoreria_movimientos_personal_id_fkey'
  ) THEN
    ALTER TABLE "tesoreria_movimientos"
      ADD CONSTRAINT "tesoreria_movimientos_personal_id_fkey"
      FOREIGN KEY ("personal_id") REFERENCES "personal"("id_personal")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
