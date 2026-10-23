-- Renombra la tabla singleton de cotización USD: global_cotizacion_usd → cotizacion_usd.

DO $$
BEGIN
  IF to_regclass('public.global_cotizacion_usd') IS NOT NULL
     AND to_regclass('public.cotizacion_usd') IS NULL THEN
    ALTER TABLE "global_cotizacion_usd" RENAME TO "cotizacion_usd";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_cotizacion_usd_pkey') THEN
    ALTER TABLE "cotizacion_usd" RENAME CONSTRAINT "global_cotizacion_usd_pkey" TO "cotizacion_usd_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_cotizacion_usd_valor_check') THEN
    ALTER TABLE "cotizacion_usd" RENAME CONSTRAINT "global_cotizacion_usd_valor_check" TO "cotizacion_usd_valor_check";
  END IF;
END $$;
