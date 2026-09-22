-- Rename global_personal → personal + comprobantes_vtas.personal_id (quién generó el comprobante).

DO $$
BEGIN
  IF to_regclass('public.global_personal') IS NOT NULL
     AND to_regclass('public.personal') IS NULL THEN
    ALTER TABLE "global_personal" RENAME TO "personal";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_personal_pkey') THEN
    ALTER TABLE "personal" RENAME CONSTRAINT "global_personal_pkey" TO "personal_pkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_personal_sucursal_por_defecto_fkey'
  ) THEN
    ALTER TABLE "personal"
      RENAME CONSTRAINT "global_personal_sucursal_por_defecto_fkey"
      TO "personal_sucursal_por_defecto_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_personal_sucursal_por_defecto_check'
  ) THEN
    ALTER TABLE "personal"
      RENAME CONSTRAINT "global_personal_sucursal_por_defecto_check"
      TO "personal_sucursal_por_defecto_check";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_personal_modulos_permitidos_check'
  ) THEN
    ALTER TABLE "personal"
      RENAME CONSTRAINT "global_personal_modulos_permitidos_check"
      TO "personal_modulos_permitidos_check";
  END IF;
END $$;

ALTER INDEX IF EXISTS "global_personal_id_dux_key"
  RENAME TO "personal_id_dux_key";
ALTER INDEX IF EXISTS "global_personal_sucursal_por_defecto_idx"
  RENAME TO "personal_sucursal_por_defecto_idx";

DO $$
BEGIN
  IF to_regclass('public.global_personal_id_personal_seq') IS NOT NULL
     AND to_regclass('public.personal_id_personal_seq') IS NULL THEN
    ALTER SEQUENCE "global_personal_id_personal_seq" RENAME TO "personal_id_personal_seq";
  END IF;
END $$;

ALTER TABLE "personal"
  ALTER COLUMN "id_personal" SET DEFAULT nextval('personal_id_personal_seq');

ALTER TABLE "comprobantes_vtas"
  ADD COLUMN IF NOT EXISTS "personal_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comprobantes_vtas_personal_id_fkey'
  ) THEN
    ALTER TABLE "comprobantes_vtas"
      ADD CONSTRAINT "comprobantes_vtas_personal_id_fkey"
      FOREIGN KEY ("personal_id") REFERENCES "personal"("id_personal")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "comprobantes_vtas_personal_id_idx"
  ON "comprobantes_vtas" ("personal_id");
