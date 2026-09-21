-- fin_tesoreria: supervisión fiscal (boolean)

ALTER TABLE "fin_tesoreria"
  ADD COLUMN IF NOT EXISTS "supervision_fiscal" BOOLEAN NOT NULL DEFAULT false;
