-- Renombre: proveedor_prod_lista -> proveedores_prod_lista.
-- RENAME conserva datos, FKs entrantes (cod_ext), triggers y columnas GENERATED.
-- Constraints e índices con prefijo `proveedor_prod_lista_` se renombran dinámicamente
-- (idempotente: si ya se aplicó, no hace nada).

DO $$
BEGIN
  IF to_regclass('public.proveedor_prod_lista') IS NOT NULL
     AND to_regclass('public.proveedores_prod_lista') IS NULL THEN
    ALTER TABLE "proveedor_prod_lista" RENAME TO "proveedores_prod_lista";
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.proveedores_prod_lista'::regclass
      AND c.conname LIKE 'proveedor\_prod\_lista\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE "proveedores_prod_lista" RENAME CONSTRAINT %I TO %I',
      r.conname,
      'proveedores_prod_lista_' || substr(r.conname, length('proveedor_prod_lista_') + 1)
    );
  END LOOP;

  FOR r IN
    SELECT i.indexname
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = 'proveedores_prod_lista'
      AND i.indexname LIKE 'proveedor\_prod\_lista\_%'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      r.indexname,
      'proveedores_prod_lista_' || substr(r.indexname, length('proveedor_prod_lista_') + 1)
    );
  END LOOP;
END $$;
