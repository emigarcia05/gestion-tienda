-- CHEQUE no tiene sucursal. Resto de tipos: sucursal_id obligatorio.
ALTER TABLE "fin_tesoreria" ALTER COLUMN "sucursal_id" DROP NOT NULL;

UPDATE "fin_tesoreria"
SET "sucursal_id" = NULL
WHERE "tipo_caja" = 'CHEQUE';

DROP INDEX IF EXISTS "fin_tesoreria_entidad_titular_sucursal_ux";

CREATE UNIQUE INDEX "fin_tesoreria_entidad_titular_sucursal_ux"
  ON "fin_tesoreria"("entidad_id", "titular", "sucursal_id")
  WHERE "sucursal_id" IS NOT NULL;

CREATE UNIQUE INDEX "fin_tesoreria_entidad_titular_cheque_ux"
  ON "fin_tesoreria"("entidad_id", "titular")
  WHERE "tipo_caja" = 'CHEQUE';

ALTER TABLE "fin_tesoreria" DROP CONSTRAINT IF EXISTS "fin_tesoreria_sucursal_cheque_chk";
ALTER TABLE "fin_tesoreria"
  ADD CONSTRAINT "fin_tesoreria_sucursal_cheque_chk"
  CHECK (
    ("tipo_caja" = 'CHEQUE' AND "sucursal_id" IS NULL)
    OR ("tipo_caja" <> 'CHEQUE' AND "sucursal_id" IS NOT NULL)
  );
