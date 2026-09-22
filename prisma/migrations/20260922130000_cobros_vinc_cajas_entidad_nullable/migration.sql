-- cobros_vinc_cajas.entidad_id nullable: formas de pago sin entidad

ALTER TABLE "cobros_vinc_cajas"
  DROP CONSTRAINT IF EXISTS "cobros_vinc_cajas_pago_entidad_fkey";

ALTER TABLE "cobros_vinc_cajas"
  ALTER COLUMN "entidad_id" DROP NOT NULL;

DROP INDEX IF EXISTS "cobros_vinc_cajas_pago_entidad_sucursal_ux";

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_vinc_cajas_pago_entidad_sucursal_ux"
  ON "cobros_vinc_cajas" ("pago_id", "entidad_id", "sucursal_id")
  WHERE "entidad_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_vinc_cajas_pago_sucursal_sin_entidad_ux"
  ON "cobros_vinc_cajas" ("pago_id", "sucursal_id")
  WHERE "entidad_id" IS NULL;

ALTER TABLE "cobros_vinc_cajas"
  DROP CONSTRAINT IF EXISTS "cobros_vinc_cajas_pago_id_fkey";

ALTER TABLE "cobros_vinc_cajas"
  ADD CONSTRAINT "cobros_vinc_cajas_pago_id_fkey"
  FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cobros_vinc_cajas"
  DROP CONSTRAINT IF EXISTS "cobros_vinc_cajas_entidad_id_fkey";

ALTER TABLE "cobros_vinc_cajas"
  ADD CONSTRAINT "cobros_vinc_cajas_entidad_id_fkey"
  FOREIGN KEY ("entidad_id") REFERENCES "tesoreria_cobros_entidades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
