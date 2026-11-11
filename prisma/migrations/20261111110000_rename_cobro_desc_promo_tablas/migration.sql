-- Renombra tres tablas de descuentos (modelos Prisma sin cambios):
--   desc_promo                      → cobro_desc_promo                      (DescPromo)
--   desc_promo_items                → cobro_desc_promo_items                (DescPromoItem)
--   desc_forma_pago_en_presupuesto  → cobro_desc_forma_pago_en_presupuesto  (DescPromoLineaPdf)
-- En cada tabla, constraints e índices con el prefijo viejo pasan al prefijo nuevo.
-- Las FKs de otras tablas que apuntan acá conservan su nombre. Idempotente.

DO $$
DECLARE
  t RECORD;
  c RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('desc_forma_pago_en_presupuesto', 'cobro_desc_forma_pago_en_presupuesto'),
      ('desc_promo_items', 'cobro_desc_promo_items'),
      ('desc_promo', 'cobro_desc_promo')
    ) AS v(viejo, nuevo)
  LOOP
    IF to_regclass(format('public.%I', t.viejo)) IS NOT NULL
       AND to_regclass(format('public.%I', t.nuevo)) IS NULL THEN
      EXECUTE format('ALTER TABLE %I RENAME TO %I', t.viejo, t.nuevo);
    END IF;

    IF to_regclass(format('public.%I', t.nuevo)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR c IN
      SELECT con.conname AS nombre
      FROM pg_constraint con
      WHERE con.conrelid = format('public.%I', t.nuevo)::regclass
        AND left(con.conname, length(t.viejo) + 1) = t.viejo || '_'
    LOOP
      EXECUTE format(
        'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        t.nuevo, c.nombre, t.nuevo || substr(c.nombre, length(t.viejo) + 1)
      );
    END LOOP;

    FOR c IN
      SELECT ic.relname AS nombre
      FROM pg_index i
      JOIN pg_class ic ON ic.oid = i.indexrelid
      WHERE i.indrelid = format('public.%I', t.nuevo)::regclass
        AND left(ic.relname, length(t.viejo) + 1) = t.viejo || '_'
    LOOP
      EXECUTE format(
        'ALTER INDEX %I RENAME TO %I',
        c.nombre, t.nuevo || substr(c.nombre, length(t.viejo) + 1)
      );
    END LOOP;
  END LOOP;
END $$;
