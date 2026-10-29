-- cobros_vinc_cajas: la misma forma [× entidad] × sucursal puede repetirse si el ALIAS es distinto
-- (comparación sin mayúsculas; sin alias = '' → sigue siendo única).
DROP INDEX IF EXISTS "cobros_vinc_cajas_pago_entidad_sucursal_ux";
DROP INDEX IF EXISTS "cobros_vinc_cajas_pago_sucursal_sin_entidad_ux";

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_vinc_cajas_pago_entidad_sucursal_ux"
  ON "cobros_vinc_cajas" ("pago_id", "entidad_id", "sucursal_id", (LOWER(COALESCE("alias", ''))))
  WHERE "entidad_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_vinc_cajas_pago_sucursal_sin_entidad_ux"
  ON "cobros_vinc_cajas" ("pago_id", "sucursal_id", (LOWER(COALESCE("alias", ''))))
  WHERE "entidad_id" IS NULL;
