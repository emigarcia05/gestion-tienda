-- Catálogo de entidades: fin_tesoreria_entidades → tesoreria_entidades

DO $$
BEGIN
  IF to_regclass('public.tesoreria_entidades') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.fin_tesoreria_entidades') IS NOT NULL THEN
    ALTER TABLE "fin_tesoreria_entidades" RENAME TO "tesoreria_entidades";
  ELSE
    RAISE EXCEPTION 'No se encontró fin_tesoreria_entidades para renombrar a tesoreria_entidades';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_entidades_pkey') THEN
    ALTER TABLE "tesoreria_entidades" RENAME CONSTRAINT "fin_tesoreria_entidades_pkey" TO "tesoreria_entidades_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fin_tesoreria_entidades_nombre_key') IS NOT NULL THEN
    ALTER INDEX "fin_tesoreria_entidades_nombre_key" RENAME TO "tesoreria_entidades_nombre_key";
  END IF;
END $$;
