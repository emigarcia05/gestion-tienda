-- Catálogo de unidades de medida de presentaciones:
--   prod_presentaciones_unidades -> prod_un_medida
-- Las FK de prod_presentaciones (unidad_medida_id / conversion_a_unidad_id) siguen apuntando
-- a la tabla por OID; sus nombres no llevan el prefijo viejo.
DO $$
BEGIN
  IF to_regclass('public.prod_presentaciones_unidades') IS NOT NULL
     AND to_regclass('public.prod_un_medida') IS NULL THEN
    ALTER TABLE "prod_presentaciones_unidades" RENAME TO "prod_un_medida";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prod_presentaciones_unidades_pkey') THEN
    ALTER TABLE "prod_un_medida" RENAME CONSTRAINT "prod_presentaciones_unidades_pkey" TO "prod_un_medida_pkey";
  END IF;

  IF to_regclass('public.prod_presentaciones_unidades_unidad_key') IS NOT NULL THEN
    ALTER INDEX "prod_presentaciones_unidades_unidad_key" RENAME TO "prod_un_medida_unidad_key";
  END IF;
END $$;
