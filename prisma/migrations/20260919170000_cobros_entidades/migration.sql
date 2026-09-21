-- Catálogo de marcas Cx. Fin. Cobros: cobros_terminales → cobros_entidades

DO $$
BEGIN
  IF to_regclass('public.cobros_entidades') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cobros_terminales') IS NOT NULL THEN
    ALTER TABLE "cobros_terminales" RENAME TO "cobros_entidades";
  ELSE
    RAISE EXCEPTION 'No se encontró cobros_terminales para renombrar a cobros_entidades';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_terminales_pkey') THEN
    ALTER TABLE "cobros_entidades" RENAME CONSTRAINT "cobros_terminales_pkey" TO "cobros_entidades_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cobros_terminales_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cobros_terminales_nombre_key" RENAME TO "cobros_entidades_nombre_key";
  END IF;
  IF to_regclass('public.cobros_terminales_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cobros_terminales_orden_idx" RENAME TO "cobros_entidades_orden_idx";
  END IF;
END $$;
