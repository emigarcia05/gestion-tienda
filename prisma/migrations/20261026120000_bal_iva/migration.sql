-- Balance IVA: fin_bal_iva_deb_import (líneas TXT AFIP) pasa a ser el libro bal_iva.
-- Se descartan las filas importadas: el libro arranca vacío y solo registra movimientos nuevos.

DO $$
BEGIN
  IF to_regclass('public.fin_bal_iva_deb_import') IS NOT NULL
     AND to_regclass('public.bal_iva') IS NULL THEN
    ALTER TABLE "fin_bal_iva_deb_import" RENAME TO "bal_iva";
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fin_bal_iva_deb_import_pkey') THEN
      ALTER TABLE "bal_iva" RENAME CONSTRAINT "fin_bal_iva_deb_import_pkey" TO "bal_iva_pkey";
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "bal_iva" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bal_iva_pkey" PRIMARY KEY ("id")
);

DELETE FROM "bal_iva";

DROP INDEX IF EXISTS "fin_bal_iva_deb_import_dedupe_key_key";
DROP INDEX IF EXISTS "fin_bal_iva_deb_import_fecha_emision_idx";

ALTER TABLE "bal_iva"
  DROP COLUMN IF EXISTS "dedupe_key",
  DROP COLUMN IF EXISTS "fecha_emision",
  DROP COLUMN IF EXISTS "denominacion_receptor",
  DROP COLUMN IF EXISTS "imp_total",
  DROP COLUMN IF EXISTS "imp_iva";

ALTER TABLE "bal_iva"
  ADD COLUMN IF NOT EXISTS "fecha" DATE NOT NULL,
  ADD COLUMN IF NOT EXISTS "descripcion" VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS "debito" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credito" DECIMAL(14,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_importes_chk') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_importes_chk" CHECK ("debito" >= 0 AND "credito" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "bal_iva_fecha_idx" ON "bal_iva"("fecha");
