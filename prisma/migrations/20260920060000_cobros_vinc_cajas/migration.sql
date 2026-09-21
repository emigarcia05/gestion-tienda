-- Rename cobros_por_sucursal → cobros_vinc_cajas

ALTER TABLE IF EXISTS "cobros_por_sucursal" RENAME TO "cobros_vinc_cajas";

ALTER INDEX IF EXISTS "cobros_por_sucursal_pago_entidad_sucursal_ux"
  RENAME TO "cobros_vinc_cajas_pago_entidad_sucursal_ux";
ALTER INDEX IF EXISTS "cobros_por_sucursal_sucursal_idx"
  RENAME TO "cobros_vinc_cajas_sucursal_idx";
ALTER INDEX IF EXISTS "cobros_por_sucursal_caja_destino_idx"
  RENAME TO "cobros_vinc_cajas_caja_destino_idx";
ALTER INDEX IF EXISTS "cobros_por_sucursal_entidad_idx"
  RENAME TO "cobros_vinc_cajas_entidad_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_pkey'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas" RENAME CONSTRAINT "cobros_por_sucursal_pkey" TO "cobros_vinc_cajas_pkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_pago_entidad_fkey'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas"
      RENAME CONSTRAINT "cobros_por_sucursal_pago_entidad_fkey" TO "cobros_vinc_cajas_pago_entidad_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_sucursal_id_fkey'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas"
      RENAME CONSTRAINT "cobros_por_sucursal_sucursal_id_fkey" TO "cobros_vinc_cajas_sucursal_id_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_caja_destino_id_fkey'
  ) THEN
    ALTER TABLE "cobros_vinc_cajas"
      RENAME CONSTRAINT "cobros_por_sucursal_caja_destino_id_fkey" TO "cobros_vinc_cajas_caja_destino_id_fkey";
  END IF;
END $$;
