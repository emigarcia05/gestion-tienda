-- Renombre:
--   prod_propios_listas_precios         -> prod_listas_precios
--   prod_propios_listas_precios_edicion -> prod_listas_precios_edicion
--   prod_propios_listas_precios_nombres -> prod_listas_precios_nombres
-- RENAME conserva datos y FKs. Constraints e índices con el prefijo viejo se renombran
-- (renombrar la constraint PK renombra también su índice). Idempotente.

DO $$
DECLARE
  par TEXT[];
  viejo TEXT;
  nuevo TEXT;
  r RECORD;
BEGIN
  FOREACH par SLICE 1 IN ARRAY ARRAY[
    ARRAY['prod_propios_listas_precios', 'prod_listas_precios'],
    ARRAY['prod_propios_listas_precios_edicion', 'prod_listas_precios_edicion'],
    ARRAY['prod_propios_listas_precios_nombres', 'prod_listas_precios_nombres']
  ]
  LOOP
    viejo := par[1];
    nuevo := par[2];

    IF to_regclass('public.' || viejo) IS NOT NULL AND to_regclass('public.' || nuevo) IS NULL THEN
      EXECUTE format('ALTER TABLE %I RENAME TO %I', viejo, nuevo);
    END IF;

    IF to_regclass('public.' || nuevo) IS NULL THEN
      CONTINUE;
    END IF;

    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = ('public.' || quote_ident(nuevo))::regclass
        AND left(c.conname, length(viejo) + 1) = viejo || '_'
    LOOP
      EXECUTE format(
        'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        nuevo,
        r.conname,
        nuevo || substr(r.conname, length(viejo) + 1)
      );
    END LOOP;

    FOR r IN
      SELECT i.indexname
      FROM pg_indexes i
      WHERE i.schemaname = 'public'
        AND i.tablename = nuevo
        AND left(i.indexname, length(viejo) + 1) = viejo || '_'
    LOOP
      EXECUTE format(
        'ALTER INDEX %I RENAME TO %I',
        r.indexname,
        nuevo || substr(r.indexname, length(viejo) + 1)
      );
    END LOOP;
  END LOOP;
END $$;
