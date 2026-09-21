-- Catálogo de tipos de caja: fin_tesoreria_tipo_caja → tesoreria_tipo_caja

DO $$
BEGIN
  IF to_regclass('public.tesoreria_tipo_caja') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.fin_tesoreria_tipo_caja') IS NOT NULL THEN
    ALTER TABLE "fin_tesoreria_tipo_caja" RENAME TO "tesoreria_tipo_caja";
  ELSE
    RAISE EXCEPTION 'No se encontró fin_tesoreria_tipo_caja para renombrar a tesoreria_tipo_caja';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_tipo_caja_pkey') THEN
    ALTER TABLE "tesoreria_tipo_caja" RENAME CONSTRAINT "fin_tesoreria_tipo_caja_pkey" TO "tesoreria_tipo_caja_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fin_tesoreria_tipo_caja_codigo_key') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_tipo_caja_codigo_key" RENAME TO "tesoreria_tipo_caja_codigo_key";
  END IF;

  IF to_regclass('public.fin_tesoreria_tipo_caja_orden_idx') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_tipo_caja_orden_idx" RENAME TO "tesoreria_tipo_caja_orden_idx";
  END IF;
END $$;
