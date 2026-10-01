-- Catálogo de entidades: `tesoreria_cobros_entidades` → `cobros_entidades`.
-- La forma de pago ya no declara `entidad_obligatoria`: el N:M puede quedar vacío.

ALTER TABLE "tesoreria_cobros_entidades" RENAME TO "cobros_entidades";

ALTER TABLE "cobros_entidades"
  RENAME CONSTRAINT "tesoreria_cobros_entidades_pkey" TO "cobros_entidades_pkey";

ALTER INDEX "tesoreria_cobros_entidades_nombre_key"
  RENAME TO "cobros_entidades_nombre_key";

ALTER INDEX "tesoreria_cobros_entidades_orden_idx"
  RENAME TO "cobros_entidades_orden_idx";

ALTER TABLE "cobros_forma_pago"
  DROP COLUMN IF EXISTS "entidad_obligatoria";
