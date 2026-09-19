-- cobros_bancos: titular (FK tesoreria_titulares.nombre) + alias (texto usuario)

ALTER TABLE "cobros_bancos" ADD COLUMN "titular" TEXT;
ALTER TABLE "cobros_bancos" ADD COLUMN "alias" TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "cobros_bancos" WHERE "titular" IS NULL) THEN
    RAISE EXCEPTION 'cobros_bancos tiene filas: asigná titular de tesoreria_titulares antes de exigir NOT NULL';
  END IF;
END $$;

ALTER TABLE "cobros_bancos" ALTER COLUMN "titular" SET NOT NULL;
ALTER TABLE "cobros_bancos" ALTER COLUMN "alias" DROP DEFAULT;

CREATE INDEX "cobros_bancos_titular_idx" ON "cobros_bancos"("titular");

ALTER TABLE "cobros_bancos"
  ADD CONSTRAINT "cobros_bancos_titular_fkey"
  FOREIGN KEY ("titular") REFERENCES "tesoreria_titulares"("nombre")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
