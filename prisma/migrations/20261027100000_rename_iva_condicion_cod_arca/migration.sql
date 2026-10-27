-- Renombra condicion_iva_cod_arca → iva_condicion_cod_arca (Prisma `PtoVentasCodArca`, sin cambios).
-- PK, índice único de `codigo` y secuencia de `id` pasan al prefijo nuevo. Las FKs que apuntan acá
-- (`clientes`, `ptos_vtas`, `vtas_comprobantes`) conservan su nombre. Idempotente.

DO $$
DECLARE
  c RECORD;
  seq TEXT;
BEGIN
  IF to_regclass('public.condicion_iva_cod_arca') IS NOT NULL
     AND to_regclass('public.iva_condicion_cod_arca') IS NULL THEN
    ALTER TABLE "condicion_iva_cod_arca" RENAME TO "iva_condicion_cod_arca";
  END IF;

  IF to_regclass('public.iva_condicion_cod_arca') IS NULL THEN
    RETURN;
  END IF;

  FOR c IN
    SELECT con.conname AS nombre
    FROM pg_constraint con
    WHERE con.conrelid = 'public.iva_condicion_cod_arca'::regclass
      AND left(con.conname, length('condicion_iva_cod_arca_')) = 'condicion_iva_cod_arca_'
  LOOP
    EXECUTE format(
      'ALTER TABLE "iva_condicion_cod_arca" RENAME CONSTRAINT %I TO %I',
      c.nombre, 'iva_condicion_cod_arca_' || substr(c.nombre, length('condicion_iva_cod_arca_') + 1)
    );
  END LOOP;

  FOR c IN
    SELECT ic.relname AS nombre
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE i.indrelid = 'public.iva_condicion_cod_arca'::regclass
      AND left(ic.relname, length('condicion_iva_cod_arca_')) = 'condicion_iva_cod_arca_'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      c.nombre, 'iva_condicion_cod_arca_' || substr(c.nombre, length('condicion_iva_cod_arca_') + 1)
    );
  END LOOP;

  seq := pg_get_serial_sequence('public.iva_condicion_cod_arca', 'id');
  IF seq IS NOT NULL
     AND seq <> 'public.iva_condicion_cod_arca_id_seq'
     AND to_regclass('public.iva_condicion_cod_arca_id_seq') IS NULL THEN
    EXECUTE format('ALTER SEQUENCE %s RENAME TO "iva_condicion_cod_arca_id_seq"', seq);
  END IF;
END $$;
