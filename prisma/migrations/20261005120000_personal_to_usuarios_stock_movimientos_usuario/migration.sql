-- Rename personal → usuarios.
-- stock_movimientos.usuario_id: quién registró cada línea del ledger.

DO $$
BEGIN
  IF to_regclass('public.personal') IS NOT NULL
     AND to_regclass('public.usuarios') IS NULL THEN
    ALTER TABLE "personal" RENAME TO "usuarios";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personal_pkey') THEN
    ALTER TABLE "usuarios" RENAME CONSTRAINT "personal_pkey" TO "usuarios_pkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personal_sucursal_por_defecto_fkey'
  ) THEN
    ALTER TABLE "usuarios"
      RENAME CONSTRAINT "personal_sucursal_por_defecto_fkey"
      TO "usuarios_sucursal_por_defecto_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personal_sucursal_por_defecto_check'
  ) THEN
    ALTER TABLE "usuarios"
      RENAME CONSTRAINT "personal_sucursal_por_defecto_check"
      TO "usuarios_sucursal_por_defecto_check";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personal_modulos_permitidos_check'
  ) THEN
    ALTER TABLE "usuarios"
      RENAME CONSTRAINT "personal_modulos_permitidos_check"
      TO "usuarios_modulos_permitidos_check";
  END IF;
END $$;

ALTER INDEX IF EXISTS "personal_id_dux_key"
  RENAME TO "usuarios_id_dux_key";
ALTER INDEX IF EXISTS "personal_sucursal_por_defecto_idx"
  RENAME TO "usuarios_sucursal_por_defecto_idx";

DO $$
BEGIN
  IF to_regclass('public.personal_id_personal_seq') IS NOT NULL
     AND to_regclass('public.usuarios_id_personal_seq') IS NULL THEN
    ALTER SEQUENCE "personal_id_personal_seq" RENAME TO "usuarios_id_personal_seq";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.usuarios_id_personal_seq') IS NOT NULL THEN
    ALTER TABLE "usuarios"
      ALTER COLUMN "id_personal" SET DEFAULT nextval('usuarios_id_personal_seq');
  END IF;
END $$;

ALTER TABLE "stock_movimientos"
  ADD COLUMN IF NOT EXISTS "usuario_id" INTEGER;

UPDATE "stock_movimientos" AS m
SET "usuario_id" = c."personal_id"
FROM "stock_comprobantes" AS c
WHERE m."comprobante_relacionado" = c."id"
  AND m."usuario_id" IS NULL
  AND c."personal_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movimientos_usuario_id_fkey'
  ) THEN
    ALTER TABLE "stock_movimientos"
      ADD CONSTRAINT "stock_movimientos_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id_personal")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stock_movimientos_usuario_idx"
  ON "stock_movimientos" ("usuario_id");
