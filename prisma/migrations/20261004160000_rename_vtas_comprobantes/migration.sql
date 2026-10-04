-- Rename comprobantes_vtas* → vtas_comprobantes*
-- Idempotente: no falla si ya se aplicó a mano.

DO $$
BEGIN
  IF to_regclass('public.comprobantes_vtas_items') IS NOT NULL
     AND to_regclass('public.vtas_comprobantes_items') IS NULL THEN
    ALTER TABLE "comprobantes_vtas_items" RENAME TO "vtas_comprobantes_items";
  END IF;

  IF to_regclass('public.comprobantes_vtas_historial_arca') IS NOT NULL
     AND to_regclass('public.vtas_comprobantes_historial_arca') IS NULL THEN
    ALTER TABLE "comprobantes_vtas_historial_arca" RENAME TO "vtas_comprobantes_historial_arca";
  END IF;

  IF to_regclass('public.comprobantes_vtas') IS NOT NULL
     AND to_regclass('public.vtas_comprobantes') IS NULL THEN
    ALTER TABLE "comprobantes_vtas" RENAME TO "vtas_comprobantes";
  END IF;
END $$;

DO $$
DECLARE
  r record;
  new_name text;
BEGIN
  FOR r IN
    SELECT c.conname, rel.relname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname IN (
        'vtas_comprobantes',
        'vtas_comprobantes_items',
        'vtas_comprobantes_historial_arca'
      )
      AND c.conname LIKE 'comprobantes_vtas%'
  LOOP
    new_name := 'vtas_comprobantes' || substr(r.conname, length('comprobantes_vtas') + 1);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = new_name) THEN
      EXECUTE format(
        'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        r.relname,
        r.conname,
        new_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
  new_name text;
BEGIN
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_class t ON t.oid = ix.indrelid
    WHERE n.nspname = 'public'
      AND t.relname IN (
        'vtas_comprobantes',
        'vtas_comprobantes_items',
        'vtas_comprobantes_historial_arca'
      )
      AND i.relname LIKE 'comprobantes_vtas%'
      AND NOT ix.indisprimary
  LOOP
    new_name := 'vtas_comprobantes' || substr(r.index_name, length('comprobantes_vtas') + 1);
    IF to_regclass(format('%I.%I', 'public', new_name)) IS NULL THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', r.index_name, new_name);
    END IF;
  END LOOP;
END $$;
