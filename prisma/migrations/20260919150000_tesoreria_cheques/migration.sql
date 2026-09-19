-- Cheques de tesorería: fin_tesoreria_cheques → tesoreria_cheques

DO $$
BEGIN
  IF to_regclass('public.tesoreria_cheques') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.fin_tesoreria_cheques') IS NOT NULL THEN
    ALTER TABLE "fin_tesoreria_cheques" RENAME TO "tesoreria_cheques";
  ELSE
    RAISE EXCEPTION 'No se encontró fin_tesoreria_cheques para renombrar a tesoreria_cheques';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_cheques_pkey') THEN
    ALTER TABLE "tesoreria_cheques" RENAME CONSTRAINT "fin_tesoreria_cheques_pkey" TO "tesoreria_cheques_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_cheques_monto_check') THEN
    ALTER TABLE "tesoreria_cheques" RENAME CONSTRAINT "fin_tesoreria_cheques_monto_check" TO "tesoreria_cheques_monto_check";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_cheques_tenedor_check') THEN
    ALTER TABLE "tesoreria_cheques" RENAME CONSTRAINT "fin_tesoreria_cheques_tenedor_check" TO "tesoreria_cheques_tenedor_check";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_cheques_caja_id_fkey') THEN
    ALTER TABLE "tesoreria_cheques" RENAME CONSTRAINT "fin_tesoreria_cheques_caja_id_fkey" TO "tesoreria_cheques_caja_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_cheques_caja_destino_id_fkey') THEN
    ALTER TABLE "tesoreria_cheques" RENAME CONSTRAINT "fin_tesoreria_cheques_caja_destino_id_fkey" TO "tesoreria_cheques_caja_destino_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_cheques_proveedor_id_fkey') THEN
    ALTER TABLE "tesoreria_cheques" RENAME CONSTRAINT "fin_tesoreria_cheques_proveedor_id_fkey" TO "tesoreria_cheques_proveedor_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fin_tesoreria_cheques_caja_id_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_cheques_caja_id_idx" RENAME TO "tesoreria_cheques_caja_id_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_cheques_caja_id_fecha_acreditacion_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_cheques_caja_id_fecha_acreditacion_idx" RENAME TO "tesoreria_cheques_caja_id_fecha_acreditacion_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_cheques_caja_id_fecha_transferencia_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_cheques_caja_id_fecha_transferencia_idx" RENAME TO "tesoreria_cheques_caja_id_fecha_transferencia_idx";
  END IF;
  IF to_regclass('public.fin_tesoreria_cheques_proveedor_id_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_cheques_proveedor_id_idx" RENAME TO "tesoreria_cheques_proveedor_id_idx";
  END IF;
END $$;

DROP TRIGGER IF EXISTS "fin_tesoreria_cheques_assert_caja_cheque_trg" ON "tesoreria_cheques";
DROP TRIGGER IF EXISTS "tesoreria_cheques_assert_caja_cheque_trg" ON "tesoreria_cheques";
DROP FUNCTION IF EXISTS fin_tesoreria_cheques_assert_caja_cheque();
DROP FUNCTION IF EXISTS tesoreria_cheques_assert_caja_cheque();

CREATE OR REPLACE FUNCTION tesoreria_cheques_assert_caja_cheque()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "fin_tesoreria"
    WHERE "id" = NEW."caja_id"
      AND "tipo_caja" = 'CHEQUE'::"TipoCajaTesoreria"
  ) THEN
    RAISE EXCEPTION 'tesoreria_cheques: la caja debe existir y tener tipo_caja CHEQUE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "tesoreria_cheques_assert_caja_cheque_trg"
BEFORE INSERT OR UPDATE ON "tesoreria_cheques"
FOR EACH ROW
EXECUTE FUNCTION tesoreria_cheques_assert_caja_cheque();
