-- Catálogo de formas de pago: cobros_opciones_pago → cobros_forma_pago

DO $$
BEGIN
  IF to_regclass('public.cobros_forma_pago') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cobros_opciones_pago') IS NOT NULL THEN
    ALTER TABLE "cobros_opciones_pago" RENAME TO "cobros_forma_pago";
  ELSE
    RAISE EXCEPTION 'No se encontró cobros_opciones_pago para renombrar a cobros_forma_pago';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_opciones_pago_pkey') THEN
    ALTER TABLE "cobros_forma_pago" RENAME CONSTRAINT "cobros_opciones_pago_pkey" TO "cobros_forma_pago_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cobros_opciones_pago_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cobros_opciones_pago_nombre_key" RENAME TO "cobros_forma_pago_nombre_key";
  END IF;
  IF to_regclass('public.cobros_opciones_pago_codigo_key') IS NOT NULL THEN
    ALTER INDEX "cobros_opciones_pago_codigo_key" RENAME TO "cobros_forma_pago_codigo_key";
  END IF;
  IF to_regclass('public.cobros_opciones_pago_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cobros_opciones_pago_orden_idx" RENAME TO "cobros_forma_pago_orden_idx";
  END IF;
END $$;
