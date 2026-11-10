-- Renombra las líneas de FORMA DE PAGO EN PRESUPUESTO (modelo Prisma sin cambios):
--   desc_promo_linea_pdf → desc_forma_pago_en_presupuesto (DescPromoLineaPdf)
-- Constraints e índices con el prefijo viejo pasan al prefijo nuevo. Idempotente.

DO $$
DECLARE
  viejo TEXT := 'desc_promo_linea_pdf';
  nuevo TEXT := 'desc_forma_pago_en_presupuesto';
  c RECORD;
BEGIN
  IF to_regclass(format('public.%I', viejo)) IS NOT NULL
     AND to_regclass(format('public.%I', nuevo)) IS NULL THEN
    EXECUTE format('ALTER TABLE %I RENAME TO %I', viejo, nuevo);
  END IF;

  IF to_regclass(format('public.%I', nuevo)) IS NULL THEN
    RETURN;
  END IF;

  FOR c IN
    SELECT con.conname AS nombre
    FROM pg_constraint con
    WHERE con.conrelid = format('public.%I', nuevo)::regclass
      AND left(con.conname, length(viejo) + 1) = viejo || '_'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
      nuevo, c.nombre, nuevo || substr(c.nombre, length(viejo) + 1)
    );
  END LOOP;

  FOR c IN
    SELECT ic.relname AS nombre
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE i.indrelid = format('public.%I', nuevo)::regclass
      AND left(ic.relname, length(viejo) + 1) = viejo || '_'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      c.nombre, nuevo || substr(c.nombre, length(viejo) + 1)
    );
  END LOOP;
END $$;
