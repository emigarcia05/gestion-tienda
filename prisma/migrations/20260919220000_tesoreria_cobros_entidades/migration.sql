-- Unificar catálogos de entidades:
-- 1) cobros_entidades → tesoreria_cobros_entidades
-- 2) Absorber nombres de tesoreria_entidades
-- 3) Remapear fin_tesoreria.entidad_id (sin FK intermedia)
-- 4) Eliminar tesoreria_entidades

-- ─── 0. Soltar FK vieja (permite remapear a ids del catálogo cobros) ──────────
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'fin_tesoreria'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%entidad_id%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "fin_tesoreria" DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- ─── 1. Renombrar cobros_entidades ───────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.tesoreria_cobros_entidades') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cobros_entidades') IS NOT NULL THEN
    ALTER TABLE "cobros_entidades" RENAME TO "tesoreria_cobros_entidades";
  ELSE
    RAISE EXCEPTION 'No se encontró cobros_entidades para renombrar a tesoreria_cobros_entidades';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_entidades_pkey') THEN
    ALTER TABLE "tesoreria_cobros_entidades"
      RENAME CONSTRAINT "cobros_entidades_pkey" TO "tesoreria_cobros_entidades_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cobros_entidades_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cobros_entidades_nombre_key" RENAME TO "tesoreria_cobros_entidades_nombre_key";
  END IF;
  IF to_regclass('public.cobros_entidades_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cobros_entidades_orden_idx" RENAME TO "tesoreria_cobros_entidades_orden_idx";
  END IF;
END $$;

-- ─── 2. Insertar nombres de tesoreria_entidades que faltan ────────────────────
INSERT INTO "tesoreria_cobros_entidades" ("id", "nombre", "orden", "created_at", "updated_at")
SELECT
  t."id",
  t."nombre",
  COALESCE((SELECT MAX(c."orden") FROM "tesoreria_cobros_entidades" c), -1)
    + ROW_NUMBER() OVER (ORDER BY t."nombre"),
  t."created_at",
  t."updated_at"
FROM "tesoreria_entidades" t
WHERE to_regclass('public.tesoreria_entidades') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "tesoreria_cobros_entidades" c
    WHERE upper(c."nombre") = upper(t."nombre")
  );

-- ─── 3. Remapear cajas: id tesoreria → id unificado por nombre ────────────────
UPDATE "fin_tesoreria" ft
SET "entidad_id" = c."id"
FROM "tesoreria_entidades" t
INNER JOIN "tesoreria_cobros_entidades" c
  ON upper(c."nombre") = upper(t."nombre")
WHERE to_regclass('public.tesoreria_entidades') IS NOT NULL
  AND ft."entidad_id" = t."id"
  AND ft."entidad_id" IS DISTINCT FROM c."id";

-- ─── 4. Nueva FK → tesoreria_cobros_entidades ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_tesoreria_entidad_id_fkey'
  ) THEN
    ALTER TABLE "fin_tesoreria"
      ADD CONSTRAINT "fin_tesoreria_entidad_id_fkey"
      FOREIGN KEY ("entidad_id") REFERENCES "tesoreria_cobros_entidades"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 5. Eliminar catálogo viejo ───────────────────────────────────────────────
DROP TABLE IF EXISTS "tesoreria_entidades";
