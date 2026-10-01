-- tesoreria_cajas.entidad_id deja de ser obligatorio.
-- Uniques parciales: con entidad (como hasta ahora) y sin entidad (titular + sucursal, o titular si CHEQUE).

ALTER TABLE "tesoreria_cajas" ALTER COLUMN "entidad_id" DROP NOT NULL;

DROP INDEX IF EXISTS "tesoreria_cajas_entidad_titular_sucursal_ux";
DROP INDEX IF EXISTS "tesoreria_cajas_entidad_titular_cheque_ux";

CREATE UNIQUE INDEX "tesoreria_cajas_entidad_titular_sucursal_ux"
  ON "tesoreria_cajas" ("entidad_id", "titular", "sucursal_id")
  WHERE "sucursal_id" IS NOT NULL AND "entidad_id" IS NOT NULL;

CREATE UNIQUE INDEX "tesoreria_cajas_entidad_titular_cheque_ux"
  ON "tesoreria_cajas" ("entidad_id", "titular")
  WHERE "tipo_caja" = 'CHEQUE' AND "entidad_id" IS NOT NULL;

CREATE UNIQUE INDEX "tesoreria_cajas_sin_entidad_titular_sucursal_ux"
  ON "tesoreria_cajas" ("titular", "sucursal_id")
  WHERE "sucursal_id" IS NOT NULL AND "entidad_id" IS NULL;

CREATE UNIQUE INDEX "tesoreria_cajas_sin_entidad_titular_cheque_ux"
  ON "tesoreria_cajas" ("titular")
  WHERE "tipo_caja" = 'CHEQUE' AND "entidad_id" IS NULL;
