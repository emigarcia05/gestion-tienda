-- La sucursal deja de ser obligatoria al crear o editar una caja.
-- CHEQUE sigue sin sucursal. El resto puede tener sucursal o quedar vacía.

ALTER TABLE "tesoreria_cajas"
  DROP CONSTRAINT IF EXISTS "tesoreria_cajas_sucursal_cheque_chk";

ALTER TABLE "tesoreria_cajas"
  ADD CONSTRAINT "tesoreria_cajas_sucursal_cheque_chk"
  CHECK (
    "tipo_caja" <> 'CHEQUE' OR "sucursal_id" IS NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS "tesoreria_cajas_entidad_titular_sin_sucursal_ux"
  ON "tesoreria_cajas" ("entidad_id", "titular")
  WHERE "sucursal_id" IS NULL
    AND "entidad_id" IS NOT NULL
    AND "tipo_caja" <> 'CHEQUE';

CREATE UNIQUE INDEX IF NOT EXISTS "tesoreria_cajas_sin_entidad_titular_sin_sucursal_ux"
  ON "tesoreria_cajas" ("titular")
  WHERE "sucursal_id" IS NULL
    AND "entidad_id" IS NULL
    AND "tipo_caja" <> 'CHEQUE';
