-- Catálogo de formas de pago → cobros_opciones_pago
-- Origen según migraciones previas: cobros_forma_pago o fin_ana_cos_fina_pagos.

DO $$
BEGIN
  IF to_regclass('public.cobros_opciones_pago') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cobros_forma_pago') IS NOT NULL THEN
    ALTER TABLE "cobros_forma_pago" RENAME TO "cobros_opciones_pago";
  ELSIF to_regclass('public.fin_ana_cos_fina_pagos') IS NOT NULL THEN
    ALTER TABLE "fin_ana_cos_fina_pagos" RENAME TO "cobros_opciones_pago";
  ELSE
    RAISE EXCEPTION 'No se encontró cobros_forma_pago ni fin_ana_cos_fina_pagos para renombrar';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_forma_pago_pkey') THEN
    ALTER TABLE "cobros_opciones_pago" RENAME CONSTRAINT "cobros_forma_pago_pkey" TO "cobros_opciones_pago_pkey";
  ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_ana_cos_fina_pagos_pkey') THEN
    ALTER TABLE "cobros_opciones_pago" RENAME CONSTRAINT "fin_ana_cos_fina_pagos_pkey" TO "cobros_opciones_pago_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cobros_forma_pago_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cobros_forma_pago_nombre_key" RENAME TO "cobros_opciones_pago_nombre_key";
  ELSIF to_regclass('public.fin_ana_cos_fina_pagos_nombre_key') IS NOT NULL THEN
    ALTER INDEX "fin_ana_cos_fina_pagos_nombre_key" RENAME TO "cobros_opciones_pago_nombre_key";
  END IF;

  IF to_regclass('public.cobros_forma_pago_codigo_key') IS NOT NULL THEN
    ALTER INDEX "cobros_forma_pago_codigo_key" RENAME TO "cobros_opciones_pago_codigo_key";
  ELSIF to_regclass('public.fin_ana_cos_fina_pagos_codigo_key') IS NOT NULL THEN
    ALTER INDEX "fin_ana_cos_fina_pagos_codigo_key" RENAME TO "cobros_opciones_pago_codigo_key";
  END IF;

  IF to_regclass('public.cobros_forma_pago_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cobros_forma_pago_orden_idx" RENAME TO "cobros_opciones_pago_orden_idx";
  ELSIF to_regclass('public.fin_ana_cos_fina_pagos_orden_idx') IS NOT NULL THEN
    ALTER INDEX "fin_ana_cos_fina_pagos_orden_idx" RENAME TO "cobros_opciones_pago_orden_idx";
  END IF;
END $$;
