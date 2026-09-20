-- fin_tesoreria → tesoreria_cajas

DO $$
BEGIN
  IF to_regclass('public.tesoreria_cajas') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.fin_tesoreria') IS NOT NULL THEN
    ALTER TABLE "fin_tesoreria" RENAME TO "tesoreria_cajas";
  ELSE
    RAISE EXCEPTION 'No se encontró fin_tesoreria para renombrar a tesoreria_cajas';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_pkey') THEN
    ALTER TABLE "tesoreria_cajas" RENAME CONSTRAINT "fin_tesoreria_pkey" TO "tesoreria_cajas_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_entidad_id_fkey') THEN
    ALTER TABLE "tesoreria_cajas" RENAME CONSTRAINT "fin_tesoreria_entidad_id_fkey" TO "tesoreria_cajas_entidad_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_sucursal_id_fkey') THEN
    ALTER TABLE "tesoreria_cajas" RENAME CONSTRAINT "fin_tesoreria_sucursal_id_fkey" TO "tesoreria_cajas_sucursal_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_sucursal_cheque_chk') THEN
    ALTER TABLE "tesoreria_cajas" RENAME CONSTRAINT "fin_tesoreria_sucursal_cheque_chk" TO "tesoreria_cajas_sucursal_cheque_chk";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fin_tesoreria_tipo_caja_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_tipo_caja_idx" RENAME TO "tesoreria_cajas_tipo_caja_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_tipo_valor_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_tipo_valor_idx" RENAME TO "tesoreria_cajas_tipo_valor_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_entidad_id_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_entidad_id_idx" RENAME TO "tesoreria_cajas_entidad_id_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_sucursal_id_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_sucursal_id_idx" RENAME TO "tesoreria_cajas_sucursal_id_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_entidad_titular_sucursal_ux') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_entidad_titular_sucursal_ux" RENAME TO "tesoreria_cajas_entidad_titular_sucursal_ux";
  END IF;
  IF to_regclass('public.fin_tesoreria_entidad_titular_cheque_ux') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_entidad_titular_cheque_ux" RENAME TO "tesoreria_cajas_entidad_titular_cheque_ux";
  END IF;
END $$;

-- Trigger de cheques: apuntar a tesoreria_cajas
CREATE OR REPLACE FUNCTION tesoreria_cheques_assert_caja_cheque()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "tesoreria_cajas"
    WHERE "id" = NEW."caja_id"
      AND "tipo_caja" = 'CHEQUE'::"TipoCajaTesoreria"
  ) THEN
    RAISE EXCEPTION 'tesoreria_cheques: la caja debe existir y tener tipo_caja CHEQUE';
  END IF;
  RETURN NEW;
END;
$$;
