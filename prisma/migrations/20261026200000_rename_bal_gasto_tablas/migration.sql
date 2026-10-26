-- Renombra la jerarquía de gastos de Balance (modelos Prisma sin cambios):
--   fin_bal_gasto_tipo    → bal_gasto_tipo     (FinBalGastoTipo)
--   fin_bal_gasto_rubro   → bal_gasto_rubro    (FinBalGastoRubro)
--   fin_bal_cat_gasto     → bal_gasto_cat      (FinBalGasto)
--   fin_bal_gasto_final   → bal_gasto          (FinBalGastoFinal)
--   fin_bal_gasto_mensual → bal_gasto_mensual  (FinBalGastoMensual)
-- En cada tabla, los constraints (PK, FK, UNIQUE, CHECK) e índices con el prefijo viejo
-- pasan al prefijo nuevo. Las FKs de otras tablas que apuntan acá (p. ej. `bal_iva`)
-- conservan su nombre. Idempotente.

DO $$
DECLARE
  t RECORD;
  c RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('fin_bal_gasto_tipo', 'bal_gasto_tipo'),
      ('fin_bal_gasto_rubro', 'bal_gasto_rubro'),
      ('fin_bal_cat_gasto', 'bal_gasto_cat'),
      ('fin_bal_gasto_final', 'bal_gasto'),
      ('fin_bal_gasto_mensual', 'bal_gasto_mensual')
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

-- Ya eliminada en `20261026180000_drop_fin_bal_vtas`; se repite por si quedó en alguna base.
DROP TABLE IF EXISTS "fin_bal_vtas";
